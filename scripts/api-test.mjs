// End-to-end API checks against the production server on a throwaway database.
const BASE = 'http://localhost:8799';
let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + detail}`);
};

function client() {
  const jar = new Map();
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(BASE + '/api' + path, {
      method,
      redirect: 'manual',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const cookies = res.headers.getSetCookie();
    for (const c of cookies) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i);
      if (/Max-Age=0/.test(c)) jar.delete(name);
      else jar.set(name, pair.slice(i + 1));
    }
    let data = null;
    try {
      data = await res.json();
    } catch {}
    const setCookie = cookies.find((c) => c.startsWith('sl_session=')) ?? cookies[0] ?? null;
    return { status: res.status, data, setCookie, location: res.headers.get('location') };
  };
  call.jar = jar;
  return call;
}

/** Stands in for Google's token endpoint, so the whole sign-in can run without a Google account. */
const fakeGoogle = new Map(); // code -> { nonce, challenge, aud, sub, email, name }
const { createServer } = await import('node:http');
const { createHash } = await import('node:crypto');
const tokenServer = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const form = new URLSearchParams(body);
  const grant = fakeGoogle.get(form.get('code'));
  const pkceOk = grant && createHash('sha256').update(form.get('code_verifier') ?? '').digest('base64url') === grant.challenge;
  res.setHeader('Content-Type', 'application/json');
  if (!grant || !pkceOk || form.get('grant_type') !== 'authorization_code') {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'invalid_grant' }));
  }
  fakeGoogle.delete(form.get('code'));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const claims = { iss: 'https://accounts.google.com', aud: grant.aud, exp: Math.floor(Date.now() / 1000) + 600, nonce: grant.nonce, sub: grant.sub, email: grant.email, email_verified: true, name: grant.name };
  res.end(JSON.stringify({ id_token: `${b64({ alg: 'none' })}.${b64(claims)}.sig`, access_token: 'x' }));
});
await new Promise((ok) => tokenServer.listen(8798, '127.0.0.1', ok));

/** Runs the browser's side of "Continue with Google" for `who`, as Google would answer. */
async function googleSignIn(c, who, next = '/tickets') {
  const start = await c('GET', `/auth/google/start?next=${encodeURIComponent(next)}`);
  const url = new URL(start.location);
  const code = 'code-' + Math.random().toString(36).slice(2);
  fakeGoogle.set(code, { nonce: url.searchParams.get('nonce'), challenge: url.searchParams.get('code_challenge'), aud: url.searchParams.get('client_id'), ...who });
  const back = await c('GET', `/auth/google/callback?state=${url.searchParams.get('state')}&code=${code}`);
  return { start, url, back, state: url.searchParams.get('state') };
}

// the date two days out in Delhi, where every cinema is, whatever clock this machine runs on
const IST = 330 * 60000;
const key = new Date(Date.now() + 2 * 86400000 + IST).toISOString().slice(0, 10).replaceAll('-', '');
const delhiStart = (k, hhmm) => Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8), +hhmm.slice(0, 2), +hhmm.slice(3, 5)) - IST;
// a large-screen show two days out, taken from the API's own schedule
const listing = await (await fetch(`${BASE}/api/movies/ramayana-rise-of-a-legend/shows?date=${key}`)).json();
const SHOW = (listing.shows.find((x) => x.hallId === 'h2') ?? listing.shows[0]).id;
const stamp = Date.now();
const mail = (n) => `tester${n}-${stamp}@example.com`;
const PW = 'correct horse battery';

const a = client();
const b = client();
const anon = client();

let r = await anon('GET', '/health');
check('health', r.status === 200 && r.data.ok);

check('schedule lists real cinemas with screen and hall model', listing.shows.length > 5 && listing.shows.every((x) => /~/.test(x.id) && x.cinemaId && x.screenId && /^h[123]$/.test(x.hallId)), JSON.stringify(listing).slice(0, 200));
check('show times are Delhi time on any server clock', listing.shows.every((x) => x.start === delhiStart(key, x.time)), JSON.stringify(listing.shows[0]));
r = await anon('GET', '/movies/no-such-movie/shows');
check('unknown movie has no schedule', r.status === 404);
r = await anon('GET', '/media');
check('poster endpoint answers without a TMDB key', r.status === 200 && typeof r.data.movies === 'object');

r = await anon('GET', '/auth/me');
check('me when signed out is null', r.status === 200 && r.data.user === null);

r = await a('POST', '/auth/signup', { name: 'A', email: mail(1), password: PW });
check('signup rejects short name', r.status === 400 && r.data.error.code === 'invalid_name');
r = await a('POST', '/auth/signup', { name: 'Alice Tester', email: 'not-an-email', password: PW });
check('signup rejects bad email', r.status === 400 && r.data.error.code === 'invalid_email');
r = await a('POST', '/auth/signup', { name: 'Alice Tester', email: mail(1), password: 'short' });
check('signup rejects short password', r.status === 400 && r.data.error.code === 'invalid_password');
r = await a('POST', '/auth/signup', { name: 'Alice Tester', email: mail(1), password: PW });
check('signup ok', r.status === 201 && r.data.user.email === mail(1), JSON.stringify(r.data));
check('session cookie is HttpOnly + SameSite', /HttpOnly/.test(r.setCookie) && /SameSite=Lax/.test(r.setCookie), r.setCookie);
check('signup response has no password fields', !JSON.stringify(r.data).includes('pass'));
r = await anon('POST', '/auth/signup', { name: 'Alice Again', email: mail(1).toUpperCase(), password: PW });
check('duplicate email (case-insensitive) rejected', r.status === 409 && r.data.error.code === 'email_in_use');
r = await a('GET', '/auth/me');
check('me returns the signed-in user', r.data.user?.name === 'Alice Tester');

r = await anon('POST', '/auth/login', { email: mail(1), password: 'wrong password!' });
check('login wrong password -> 401', r.status === 401 && r.data.error.code === 'wrong_credentials');
r = await anon('POST', '/auth/login', { email: 'nobody@example.com', password: PW });
check('login unknown email -> same 401', r.status === 401 && r.data.error.code === 'wrong_credentials');

r = await b('POST', '/auth/signup', { name: 'Bob Tester', email: mail(2), password: PW });
check('second user signup', r.status === 201);
check('a new account starts unconfirmed', r.data.user.emailVerified === false && r.data.user.hasPassword === true && r.data.user.google === false, JSON.stringify(r.data.user));

// email confirmation
r = await anon('GET', '/demo/outbox');
const verifyMail = r.data.emails.find((e) => e.kind === 'verify' && e.to === mail(2));
const verifyToken = verifyMail ? /verify\?token=([\w-]+)/.exec(verifyMail.html)?.[1] : null;
check('sign-up sends a confirmation link', !!verifyToken);
r = await anon('POST', '/auth/verify', { token: 'made-up-token' });
check('a made-up confirmation link is refused', r.status === 400 && r.data.error.code === 'verify_invalid');
r = await anon('POST', '/auth/verify', { token: verifyToken });
check('the emailed link confirms the address', r.status === 200);
r = await b('GET', '/auth/me');
check('the account now shows as confirmed', r.data.user.emailVerified === true);
r = await anon('POST', '/auth/verify', { token: verifyToken });
check('a confirmation link works only once', r.status === 400);
r = await b('POST', '/auth/verify/resend', {});
check('resend on a confirmed account sends nothing', r.status === 200 && r.data.alreadyVerified === true);

r = await anon('POST', `/shows/${SHOW}/hold`, { seats: ['A1'] });
check('hold requires sign-in', r.status === 401);
r = await a('POST', `/shows/nope.20260101.pvr-plaza~a1.1000/hold`, { seats: ['A1'] });
check('unknown show -> 404', r.status === 404);
r = await a('POST', `/shows/${SHOW}/hold`, { seats: ['ZZ99'] });
check('unknown seat rejected', r.status === 400 && r.data.error.code === 'unknown_seat');
r = await a('POST', `/shows/${SHOW}/hold`, { seats: ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'B3', 'B4'] });
check('more than 8 seats rejected', r.status === 400 && r.data.error.code === 'too_many_seats');

// find free seats
r = await a('GET', `/shows/${SHOW}/seats`);
const taken = new Set(r.data.taken);
check('seat availability lists the demo crowd', taken.size > 20, String(taken.size));
const rows = 'ABCDEFGHJKLMNPQ';
const free = [];
for (const row of rows) for (let n = 1; n <= 24 && free.length < 4; n++) if (!taken.has(row + n)) free.push(row + n);
const [s1, s2, s3] = free;
const takenSeat = [...taken][0];

r = await a('POST', `/shows/${SHOW}/hold`, { seats: [takenSeat] });
check('holding an already-taken seat -> 409', r.status === 409 && r.data.error.code === 'seats_taken');

r = await a('POST', `/shows/${SHOW}/hold`, { seats: [s1, s2] });
check('A holds two seats', r.status === 200 && r.data.hold.expiresAt > Date.now() + 6 * 60000, JSON.stringify(r.data));
r = await b('GET', `/shows/${SHOW}/seats`);
check("B sees A's held seats as taken", r.data.taken.includes(s1) && r.data.taken.includes(s2));
r = await a('GET', `/shows/${SHOW}/seats`);
check('A does not see own hold as taken, and gets hold info', !r.data.taken.includes(s1) && r.data.hold?.seats.length === 2);
const NO_SHOW = 'nope.20260101.pvr-plaza~a1.1000';
r = await b('GET', `/availability?shows=${SHOW},${NO_SHOW}`);
check("showtime availability lists A's held seats for others", r.status === 200 && r.data.seats[SHOW]?.includes(s1) && r.data.seats[SHOW]?.includes(s2), JSON.stringify(r.data));
check('showtime availability skips shows that do not exist', !(NO_SHOW in r.data.seats));
r = await a('GET', `/availability?shows=${SHOW}`);
check('showtime availability leaves out your own hold', r.status === 200 && !r.data.seats[SHOW].includes(s1), JSON.stringify(r.data));
r = await anon('GET', `/availability?shows=${Array.from({ length: 61 }, (_, i) => `${SHOW}${i}`).join(',')}`);
check('showtime availability takes at most 60 shows', r.status === 400 && r.data.error.code === 'too_many_shows');
r = await b('POST', `/shows/${SHOW}/hold`, { seats: [s2, s3] });
check('B cannot hold a seat A holds', r.status === 409 && r.data.error.seats?.includes(s2), JSON.stringify(r.data));

r = await b('POST', '/bookings', { showId: SHOW, seats: [s1], payment: { method: 'upi', upiId: 'bob@okbank' }, idempotencyKey: 'bob-key-000001' });
check('B cannot book seats without holding them', r.status === 409 && r.data.error.code === 'hold_expired', JSON.stringify(r.data));

r = await a('POST', '/bookings', { showId: SHOW, seats: [s1, s2], payment: { method: 'bitcoin' }, idempotencyKey: 'alice-key-00000' });
check('invalid payment method rejected', r.status === 400);
r = await a('POST', '/bookings', { showId: SHOW, seats: [s1, s2], payment: { method: 'card', number: '4111 1111 1111 1112', expiry: '12/34', cvv: '123' }, idempotencyKey: 'alice-key-bad01' });
check('invalid card number rejected', r.status === 400 && r.data.error.code === 'invalid_payment', JSON.stringify(r.data));
r = await a('POST', '/bookings', { showId: SHOW, seats: [s1, s2], payment: { method: 'card', number: '4111111111111111', expiry: '01/20', cvv: '123' }, idempotencyKey: 'alice-key-bad02' });
check('expired card rejected', r.status === 400);
r = await a('POST', '/bookings', { showId: SHOW, seats: [s1, s2], payment: { method: 'card', number: '4000 0000 0000 0002', expiry: '12/34', cvv: '123' }, idempotencyKey: 'alice-key-dec01' });
check('declined card -> 402 and no booking', r.status === 402 && r.data.error.code === 'payment_declined', JSON.stringify(r.data));
r = await a('POST', '/bookings', { showId: SHOW, seats: [s1, s2], payment: { method: 'upi', upiId: 'fail@okbank' }, idempotencyKey: 'alice-key-dec02' });
check('declined UPI -> 402', r.status === 402);
r = await a('GET', '/bookings');
check('declined payments created no booking', r.data.bookings.length === 0);
r = await a('GET', `/shows/${SHOW}/seats`);
check('seats still held after a declined payment', r.data.hold?.seats.length === 2);
// two identical confirms fired together: must yield exactly one booking
const [c1, c2] = await Promise.all([
  a('POST', '/bookings', { showId: SHOW, seats: [s1, s2], payment: { method: 'card', number: '4111 1111 1111 1111', expiry: '12/34', cvv: '123' }, idempotencyKey: 'alice-key-00001', subtotal: 1, total: 1 }),
  a('POST', '/bookings', { showId: SHOW, seats: [s1, s2], payment: { method: 'card', number: '4111 1111 1111 1111', expiry: '12/34', cvv: '123' }, idempotencyKey: 'alice-key-00001', subtotal: 1, total: 1 }),
]);
const ok12 = [c1, c2].filter((x) => x.status === 200 || x.status === 201);
check('double-submit returns the same booking', ok12.length === 2 && c1.data.booking.id === c2.data.booking.id, `${c1.status} ${c2.status} ${JSON.stringify(c2.data)}`);
const booking = (c1.data ?? c2.data).booking;
check('server computes the price (client total ignored)', booking.subtotal >= 2 * 180 && booking.subtotal !== 1 && booking.total === booking.subtotal + booking.fees, JSON.stringify(booking));
check('fees are 30 per seat', booking.fees === 60 && booking.total === booking.subtotal + 60);
check('booking is marked paid with a masked card', booking.paymentStatus === 'paid' && booking.instrument === 'Card •••• 1111' && !JSON.stringify(booking).includes('4111'), JSON.stringify(booking));
r = await anon('GET', '/config');
check('config reports demo mode', r.status === 200 && r.data.demo === true);
r = await anon('GET', '/demo/outbox');
const ticketMail = r.data.emails.find((e) => e.kind === 'ticket' && e.to === mail(1));
check('ticket email written to the outbox', !!ticketMail && ticketMail.html.includes(booking.id), JSON.stringify(r.data).slice(0, 200));

r = await a('GET', '/bookings');
check('A has exactly one booking', r.data.bookings.length === 1);
r = await b('GET', `/bookings/${booking.id}`);
check("B cannot read A's ticket", r.status === 404);
r = await b('DELETE', `/bookings/${booking.id}`);
check("B cannot cancel A's ticket", r.status === 404);
r = await b('POST', `/shows/${SHOW}/hold`, { seats: [s1] });
check('booked seat cannot be held by B', r.status === 409);

r = await a('DELETE', `/bookings/${booking.id}`);
check('A cancels the booking', r.status === 200);
r = await b('POST', `/shows/${SHOW}/hold`, { seats: [s1] });
check('cancelled seat is free again', r.status === 200, JSON.stringify(r.data));
r = await anon('GET', '/demo/outbox');
check('cancellation email mentions the refund', r.data.emails.some((e) => e.kind === 'cancelled' && e.to === mail(1) && e.html.includes('refund')));

// password reset
r = await anon('POST', '/auth/forgot', { email: 'nobody-here@example.com' });
check('forgot for unknown email looks the same', r.status === 200 && r.data.ok);
r = await anon('POST', '/auth/forgot', { email: mail(2) });
check('forgot for a real account', r.status === 200);
r = await anon('GET', '/demo/outbox');
const resetMail = r.data.emails.find((e) => e.kind === 'reset' && e.to === mail(2));
const token = resetMail ? /reset\?token=([\w-]+)/.exec(resetMail.html)?.[1] : null;
check('reset email carries a link', !!token);
r = await anon('POST', '/auth/reset', { token: 'not-a-real-token', password: 'brand new password' });
check('bad reset token rejected', r.status === 400 && r.data.error.code === 'reset_invalid');
r = await anon('POST', '/auth/reset', { token, password: 'brand new password' });
check('reset with the emailed token works', r.status === 200, JSON.stringify(r.data));
r = await anon('POST', '/auth/reset', { token, password: 'another password 2' });
check('reset link works only once', r.status === 400);
r = await b('GET', '/bookings');
check('reset signs out existing sessions', r.status === 401);
const b2 = client();
r = await b2('POST', '/auth/login', { email: mail(2), password: 'brand new password' });
check('can sign in with the new password', r.status === 200);
r = await b2('POST', '/auth/login', { email: mail(2), password: PW });
check('old password no longer works', r.status === 401);

// demo account
const demo = client();
r = await demo('POST', '/auth/demo', {});
check('one-click demo account signs in', r.status === 200 && !!r.data.user?.email);
r = await demo('GET', '/bookings');
check('demo account comes with tickets', r.data.bookings.length === 3, String(r.data.bookings?.length));

// signed-in devices
const demo2 = client();
await demo2('POST', '/auth/demo', {}, { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1' });
r = await demo('GET', '/auth/sessions');
const mine = r.data.sessions?.find((x) => x.current);
const phone = r.data.sessions?.find((x) => x.device === 'Safari on iPhone');
check('devices list shows this device first and the phone', r.status === 200 && r.data.sessions[0].current && !!phone, JSON.stringify(r.data));
check('device ids do not expose session tokens', mine && /^[0-9a-f]{16}$/.test(mine.id));
r = await a('DELETE', `/auth/sessions/${phone.id}`);
check("someone else cannot sign out your device", r.status === 404);
r = await demo('DELETE', `/auth/sessions/${phone.id}`);
check('sign out a single device', r.status === 200 && r.data.current === false);
r = await demo2('GET', '/auth/me');
check('that device is signed out', r.data.user === null);
await demo2('POST', '/auth/demo', {});
r = await demo('DELETE', '/auth/sessions');
check('sign out all other devices', r.status === 200 && r.data.removed >= 1, JSON.stringify(r.data));
r = await demo('GET', '/auth/me');
check('this device stays signed in', !!r.data.user);

// CSRF-style request: wrong origin, and a non-JSON body
r = await a('POST', '/auth/logout', {}, { Origin: 'https://evil.example' });
check('cross-origin write blocked', r.status === 403);
let raw = await fetch(BASE + '/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
check('non-JSON write rejected', raw.status === 415, String(raw.status));

r = await a('POST', '/auth/password', { currentPassword: 'nope nope nope', newPassword: 'another good one' });
check('password change needs the current password', r.status === 401);
r = await a('PATCH', '/auth/me', { name: 'Alice Renamed' });
check('rename works', r.status === 200 && r.data.user.name === 'Alice Renamed');
r = await a('POST', '/auth/logout', {});
check('logout', r.status === 200);
r = await a('GET', '/bookings');
check('signed-out session is rejected', r.status === 401);

// Sign in with Google
r = await anon('GET', '/config');
if (!r.data.google) {
  r = await anon('GET', '/auth/google/start');
  check('Google sign-in, when not set up, returns to sign-in with a reason', r.status === 302 && r.location.includes('error=google_unavailable'), r.location);
  console.log('      (Google checks skipped: start the server with GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_TOKEN_URL=http://127.0.0.1:8798/token)');
} else {
  const g = client();
  const who = { sub: 'g-' + stamp, email: `gina-${stamp}@gmail.com`, name: 'Gina Google' };
  const run = await googleSignIn(g, who, '/tickets');
  check('start sends the browser to Google', run.start.status === 302 && run.url.origin === 'https://accounts.google.com', run.start.location);
  check('start uses PKCE (S256), a nonce and openid scopes', run.url.searchParams.get('code_challenge_method') === 'S256' && !!run.url.searchParams.get('nonce') && run.url.searchParams.get('scope') === 'openid email profile');
  check('state is bound to an HttpOnly cookie', /^sl_oauth=[\w-]+;.*HttpOnly/.test(run.start.setCookie ?? ''), run.start.setCookie);
  check('callback signs in and returns to the page asked for', run.back.status === 302 && run.back.location === '/#/tickets', run.back.location);
  r = await g('GET', '/auth/me');
  check('a new Google account is confirmed and has no password', r.data.user?.google && r.data.user.emailVerified && !r.data.user.hasPassword && r.data.user.name === 'Gina Google', JSON.stringify(r.data));
  const gid = r.data.user?.id;
  r = await anon('GET', '/demo/outbox');
  check('a new Google account gets a welcome email', r.data.emails.some((e) => e.kind === 'welcome' && e.to === who.email));

  // the same Google account again: same user, no duplicate
  const g2 = client();
  await googleSignIn(g2, who);
  r = await g2('GET', '/auth/me');
  check('signing in again finds the same account', r.data.user?.id === gid);

  // a callback without the state cookie (someone else's link) is refused
  const stranger = client();
  const s1 = await g('GET', '/auth/google/start');
  const st = new URL(s1.location).searchParams.get('state');
  r = await stranger('GET', `/auth/google/callback?state=${st}&code=whatever`);
  check('callback without the matching state cookie is refused', r.status === 302 && r.location.includes('error=google_failed'), r.location);
  // replaying a used state
  stranger.jar.set('sl_oauth', run.state);
  r = await stranger('GET', `/auth/google/callback?state=${run.state}&code=whatever`);
  check('a used state cannot be replayed', r.status === 302 && r.location.includes('error=google_expired'), r.location);
  r = await g('GET', '/auth/google/callback?error=access_denied');
  check('cancelling at Google returns to sign-in', r.location?.includes('error=google_cancelled'));
  const evil = await googleSignIn(client(), who, '//evil.example');
  check('an outside return address is ignored', evil.back.location === '/#/', evil.back.location);

  // Alice signed up with a password but never confirmed her email. Google proves who owns it.
  const ga = client();
  await googleSignIn(ga, { sub: 'a-' + stamp, email: mail(1), name: 'Alice Google' });
  r = await ga('GET', '/auth/me');
  check('Google links to the existing account with that email', r.data.user?.email === mail(1) && r.data.user.google && r.data.user.emailVerified, JSON.stringify(r.data));
  check('an unconfirmed password is cleared when Google proves ownership', r.data.user?.hasPassword === false);
  r = await ga('DELETE', '/auth/google');
  check('Google cannot be removed while it is the only way in', r.status === 409 && r.data.error.code === 'needs_password');
  r = await ga('POST', '/auth/password', { newPassword: 'a fresh password 1' });
  check('a Google-only account can add a password', r.status === 200, JSON.stringify(r.data));
  r = await ga('DELETE', '/auth/google');
  check('with a password, Google can be disconnected', r.status === 200 && r.data.user.google === false);

  // connecting Google while signed in attaches it to this account, even with a different email
  const linked = await googleSignIn(ga, { sub: 'other-' + stamp, email: `work-${stamp}@gmail.com`, name: 'Alice Work' });
  check('connecting while signed in returns to the account page', linked.back.location === '/#/account?google=connected', linked.back.location);
  r = await ga('GET', '/auth/me');
  check('the Google account is now attached to the signed-in user', r.data.user?.email === mail(1) && r.data.user.google === true);
  const taken = await googleSignIn(demo, { sub: 'other-' + stamp, email: `work-${stamp}@gmail.com`, name: 'Alice Work' });
  check('a Google account already used by someone else is refused', taken.back.location === '/#/account?google=in_use', taken.back.location);
}

// the Demo Inbox, seen from anywhere but the server's own machine
const outside = { 'X-Forwarded-For': '203.0.113.9' };
r = await anon('GET', '/config', undefined, outside);
check('visitors from outside get the reserved-address inbox', r.data.inbox === 'reserved');
await anon('POST', '/auth/forgot', { email: 'demo@sightline.test' });
r = await anon('GET', '/demo/outbox', undefined, outside);
const reservedOnly = r.data.emails.every((e) => /@(example\.(com|net|org)|[\w.-]+\.(test|example|invalid|localhost))$/i.test(e.to));
check('outside visitors only see mail to example.com and .test addresses', r.data.scope === 'reserved' && reservedOnly, JSON.stringify(r.data.emails.map((e) => e.to)));
r = await anon('GET', '/demo/outbox');
check('the presenter on this machine sees every email', r.data.scope === 'all');
r = await anon('POST', '/demo/reset', {}, outside);
check('demo reset is refused from outside', r.status === 403);

// account deletion (Bob, signed in on b2)
r = await b2('DELETE', '/auth/me', { confirm: 'someone@else.com' });
check('deleting needs the account email typed exactly', r.status === 400 && r.data.error.code === 'confirm_mismatch');
r = await b2('DELETE', '/auth/me', { confirm: mail(2).toUpperCase() });
check('account deleted', r.status === 200, JSON.stringify(r.data));
r = await b2('GET', '/auth/me');
check('deleted account is signed out', r.data.user === null);
r = await anon('GET', '/demo/outbox');
check('deletion is confirmed by email', r.data.emails.some((e) => e.kind === 'deleted' && e.to === mail(2)));
r = await anon('POST', '/auth/signup', { name: 'Bob Returns', email: mail(2), password: PW });
check('the email can be used again after deletion', r.status === 201 || r.status === 429, String(r.status));

// live shows play in the same auditoriums
let liveShows = 0;
for (let i = 0; i < 7 && !liveShows; i++) {
  const day = new Date(Date.now() + i * 86400000);
  const k = `${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}${String(day.getDate()).padStart(2, '0')}`;
  for (const id of ['delhi-comedy-night', 'bollywood-live', 'jazz-after-dark', 'the-last-train-from-daryaganj']) {
    liveShows += (await anon('GET', `/movies/${id}/shows?date=${k}`)).data.shows.length;
  }
}
check('live shows are on the programme', liveShows > 0);

// cinema staff
const cust = client();
await cust('POST', '/auth/demo', {}); // sign-up is rate limited by now, so use the demo customer
r = await anon('GET', '/admin/overview');
check('admin pages need sign-in', r.status === 401);
r = await cust('GET', '/admin/overview');
check('a customer cannot open the admin pages', r.status === 403 && r.data.error.code === 'admin_only');
const staff = client();
r = await staff('POST', '/auth/demo', { as: 'admin' });
check('demo admin signs in with the admin role', r.status === 200 && r.data.user.role === 'admin', JSON.stringify(r.data));
r = await staff('GET', '/admin/overview');
check('admin overview reports sales', r.status === 200 && r.data.totals.bookings > 0 && r.data.daily.length === 14, JSON.stringify(r.data).slice(0, 200));
r = await staff('GET', '/admin/bookings?when=all');
check('admin lists every customer’s bookings', r.status === 200 && new Set(r.data.bookings.map((x) => x.customer.email)).size > 1);

r = await staff('GET', `/admin/shows?cinema=pvr-plaza&date=${key}`);
const audi = r.data.screens?.[0];
const first = audi?.shows.find((x) => !x.cancelled);
check('admin sees one cinema’s day by auditorium', r.status === 200 && audi?.shows.length > 2 && !!first, JSON.stringify(r.data).slice(0, 200));
r = await staff('POST', '/admin/shows/cancel', { showId: first.id });
check('admin cancels a show', r.status === 200, JSON.stringify(r.data));
r = await anon('GET', `/movies/${first.movieId}/shows?date=${key}`);
check('a cancelled show leaves the public listing', !r.data.shows.some((x) => x.id === first.id));
r = await cust('POST', `/shows/${first.id}/hold`, { seats: ['A1'] });
check('a cancelled show cannot be booked', r.status === 404);
r = await anon('GET', '/schedule');
check('the schedule feed lists the change', r.data.changes.some((x) => x.action === 'cancel' && x.time === first.time));
r = await staff('POST', '/admin/shows/restore', { showId: first.id });
r = await anon('GET', `/movies/${first.movieId}/shows?date=${key}`);
check('a restored show is back on sale', r.data.shows.some((x) => x.id === first.id));

await staff('POST', '/admin/shows/cancel', { showId: first.id });
const next = audi.shows.find((x) => x.time > first.time && !x.cancelled);
r = await staff('POST', '/admin/shows', { movieId: 'delhi-comedy-night', cinemaId: 'pvr-plaza', screenId: audi.id, date: key, time: next.time });
check('a show that clashes with another is refused', r.status === 409 && r.data.error.code === 'screen_busy', JSON.stringify(r.data));
r = await staff('POST', '/admin/shows', { movieId: 'delhi-comedy-night', cinemaId: 'pvr-plaza', screenId: audi.id, date: key, time: first.time });
check('admin adds a live show in the free slot', r.status === 201, JSON.stringify(r.data));
const added = r.data.showId;
r = await anon('GET', `/movies/delhi-comedy-night/shows?date=${key}`);
check('the added show is on sale', r.data.shows.some((x) => x.id === added));
r = await cust('POST', `/shows/${added}/hold`, { seats: ['K8', 'K9'] });
r = await cust('POST', '/bookings', { showId: added, seats: ['K8', 'K9'], payment: { method: 'upi', upiId: 'chitra@bank' }, idempotencyKey: 'chitra-added-show' });
check('a customer books the added show', r.status === 201, JSON.stringify(r.data));
r = await staff('POST', '/admin/shows/cancel', { showId: added });
check('cancelling a show cancels its bookings', r.status === 200 && r.data.cancelledBookings === 1, JSON.stringify(r.data));
r = await cust('GET', '/bookings');
check('the customer’s booking is gone', !r.data.bookings.some((x) => x.showId === added));
r = await anon('GET', '/demo/outbox');
check('the customer is told the cinema cancelled', r.data.emails.some((e) => e.kind === 'cancelled' && e.to === 'demo@sightline.test' && e.html.includes('cinema has cancelled')));

r = await staff('GET', '/admin/users');
const chitra = r.data.users?.find((u) => u.email === 'demo@sightline.test');
const me = r.data.users?.find((u) => u.role === 'admin');
check('admin lists accounts with their bookings', r.status === 200 && !!chitra && typeof chitra.bookings === 'number');
r = await staff('PATCH', `/admin/users/${me.id}`, { role: 'user' });
check('an admin cannot change their own role', r.status === 409);
r = await staff('PATCH', `/admin/users/${chitra.id}`, { role: 'admin' });
check('admin promotes a customer', r.status === 200 && r.data.user.role === 'admin');
r = await cust('GET', '/admin/overview');
check('the promoted account can open the admin pages', r.status === 200);
await staff('PATCH', `/admin/users/${chitra.id}`, { role: 'user' });
r = await cust('GET', '/admin/overview');
check('and loses access when demoted', r.status === 403);

// staff-added titles and prices
r = await cust('POST', '/admin/titles', { kind: 'comedy', title: 'Sneaky', genres: 'Stand-up', runtime: 90, language: 'Hindi', synopsis: 'Long enough summary for the show.' });
check('a customer cannot add titles', r.status === 403);
r = await staff('POST', '/admin/titles', { kind: 'comedy', title: 'Late Laughs', genres: 'Stand-up', runtime: 90, language: 'Hindi', synopsis: 'x' });
check('a title needs a proper summary', r.status === 400 && r.data.error.code === 'invalid_synopsis');
r = await staff('POST', '/admin/titles', { kind: 'comedy', title: 'Late Laughs', genres: 'Stand-up', runtime: 90, language: 'Hindi', synopsis: 'A midnight set of new material.', image: 'https://evil.example/x.jpg' });
check('title images must come from an allowed host', r.status === 400 && r.data.error.code === 'invalid_image');
r = await staff('POST', '/admin/titles', { kind: 'comedy', title: 'Late Laughs', tagline: 'After hours', genres: 'Stand-up, Late night', runtime: 90, language: 'Hindi, English', cast: 'Three comics', synopsis: 'A midnight set of new material from three club comics.' });
check('admin adds a live show title', r.status === 201 && r.data.title.id === 'late-laughs', JSON.stringify(r.data));
r = await anon('GET', '/schedule');
check('the site feed carries the new title', r.data.titles.some((t) => t.id === 'late-laughs'));
r = await staff('POST', '/admin/shows', { movieId: 'late-laughs', cinemaId: 'pvr-plaza', screenId: audi.id, date: key, time: first.time });
check('the new title can be scheduled', r.status === 201, JSON.stringify(r.data));
const lateShow = r.data.showId;
r = await anon('GET', `/movies/late-laughs/shows?date=${key}`);
check('the new title’s show is on sale', r.data.shows.some((x) => x.id === lateShow));
r = await staff('GET', '/admin/titles');
check('admin lists built-in and added titles', r.data.titles.some((t) => t.id === 'late-laughs' && t.custom) && r.data.titles.some((t) => t.id === 'jailer-2' && !t.custom));
r = await staff('DELETE', '/admin/titles/jailer-2');
check('built-in titles cannot be removed', r.status === 409);

r = await staff('GET', '/admin/prices');
const std = r.data.halls?.find((h) => h.hallId === 'h1');
check('admin sees prices by auditorium type', r.status === 200 && std?.zones.length === 3);
r = await staff('PUT', '/admin/prices', { prices: [{ hallId: 'h1', zoneId: std.zones[0].id, price: 20 }] });
check('a price below ₹50 is refused', r.status === 400 && r.data.error.code === 'invalid_price');
r = await staff('PUT', '/admin/prices', { prices: [{ hallId: 'h1', zoneId: std.zones[0].id, price: 210 }] });
check('admin changes a price', r.status === 200);
r = await anon('GET', '/schedule');
check('the site feed carries the new price', r.data.prices.some((p) => p.hallId === 'h1' && p.price === 210));
const frontSeat = 'A5';
r = await cust('POST', `/shows/${lateShow}/hold`, { seats: [frontSeat] });
r = await cust('POST', '/bookings', { showId: lateShow, seats: [frontSeat], payment: { method: 'counter' }, idempotencyKey: 'late-laughs-1' });
check('new bookings are charged the new price', r.status === 201 && r.data.booking.subtotal === 210, JSON.stringify(r.data));
r = await staff('DELETE', '/admin/titles/late-laughs');
check('a title with upcoming bookings cannot be removed', r.status === 409 && r.data.error.code === 'has_bookings');
await staff('POST', '/admin/shows/cancel', { showId: lateShow });
r = await staff('DELETE', '/admin/titles/late-laughs');
check('once its shows are cancelled the title can be removed', r.status === 200);
r = await anon('GET', '/movies/late-laughs/shows');
check('a removed title is gone', r.status === 404);
r = await staff('PUT', '/admin/prices', { prices: [{ hallId: 'h1', zoneId: std.zones[0].id, price: std.zones[0].defaultPrice }] });
r = await anon('GET', '/schedule');
check('setting the default price clears the change', r.status === 200 && !r.data.prices.length);

// brute-force limit
let limited = false;
for (let i = 0; i < 14; i++) {
  const x = await anon('POST', '/auth/login', { email: mail(1), password: 'guess' + i });
  if (x.status === 429) limited = true;
}
check('repeated login attempts are rate limited', limited);

// static site + headers
raw = await fetch(BASE + '/');
const html = await raw.text();
check('site shell served', raw.status === 200 && html.includes('<div id="root">'));
check('security headers on pages', !!raw.headers.get('content-security-policy') && raw.headers.get('x-frame-options') === 'DENY');
raw = await fetch(BASE + '/../../package.json');
check('path traversal does not leak files', !(await raw.text()).includes('"dependencies"'));

tokenServer.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
