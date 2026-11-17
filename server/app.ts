// HTTP API. No framework: the same handler runs under Vite in dev, in
// server/index.ts in production and in api/handler.ts on Vercel.
//
// Seats can't be double-booked: holds and booking_seats both have a
// UNIQUE (show_id, seat_id) and every write runs in a transaction.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { BOOKING_FEE, MAX_SEATS, MOVIES, crowdFor, dateKey, formatDate, formatTime, getMovie, money, parseShow, showsFor, type Show } from '../src/data/movies.js';
import { findBestSeats, getHall, getLayout, type HallLayout } from '../src/lib/hall.js';
import { getDb, isUniqueViolation, type Database, type Query } from './db.js';
import { charge } from './gateway.js';
import { GoogleError, googleAuthUrl, googleConfigured, googleProfile } from './google.js';
import { deliver, renderMail, smtpConfigured, type MailContent } from './mail.js';

const HOLD_MS = 7 * 60 * 1000;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const COOKIE = 'sl_session';
const OAUTH_COOKIE = 'sl_oauth';
const MAX_BODY = 400 * 1024;
const MAX_SNAPSHOT = 300 * 1024;
const RESET_MS = 30 * 60 * 1000;
const VERIFY_MS = 24 * 60 * 60 * 1000;
const OAUTH_MS = 10 * 60 * 1000;

// demo inbox, one-click demo account and reset; SIGHTLINE_DEMO=0 turns them off
const demoEnabled = () => process.env.SIGHTLINE_DEMO !== '0';
const DEMO_USER = { name: 'Demo Viewer', email: 'demo@sightline.test', password: 'sightline-demo-2026' };

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}
const bad = (code: string, message: string) => new ApiError(400, code, message);

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((ok, fail) =>
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? fail(err) : ok(key.toString('hex')))),
  );
}

const sameHash = (a: string, b: string) => a.length === b.length && a.length > 0 && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

function readCookie(req: IncomingMessage, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

const isHttps = (req: IncomingMessage) => req.headers['x-forwarded-proto'] === 'https' || process.env.PUBLIC_URL?.startsWith('https://');

function addCookie(res: ServerResponse, cookie: string) {
  const prev = res.getHeader('Set-Cookie');
  const list = prev === undefined ? [] : Array.isArray(prev) ? prev : [String(prev)];
  res.setHeader('Set-Cookie', [...list, cookie]);
}

function sessionCookie(req: IncomingMessage, token: string, maxAgeSec: number): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${isHttps(req) ? '; Secure' : ''}`;
}

interface User {
  id: number;
  email: string;
  name: string;
  emailVerified: boolean;
  hasPassword: boolean;
  google: boolean;
  createdAt: number;
}

const USER_COLS = `u.id, u.email, u.name, u.email_verified_at, u.created_at,
  CASE WHEN u.pass_hash <> '' THEN 1 ELSE 0 END AS has_password,
  CASE WHEN u.google_sub IS NULL THEN 0 ELSE 1 END AS has_google`;

interface UserRow {
  id: number;
  email: string;
  name: string;
  email_verified_at: number | null;
  created_at: number;
  has_password: number;
  has_google: number;
}

const userJson = (r: UserRow): User => ({
  id: Number(r.id),
  email: r.email,
  name: r.name,
  emailVerified: r.email_verified_at != null,
  hasPassword: !!Number(r.has_password),
  google: !!Number(r.has_google),
  createdAt: Number(r.created_at),
});

async function loadUser(db: Query, id: number): Promise<User> {
  const row = await db.get<UserRow>(`SELECT ${USER_COLS} FROM users u WHERE u.id = ?`, id);
  if (!row) throw new ApiError(401, 'not_signed_in', 'Sign in to continue.');
  return userJson(row);
}

async function currentSession(db: Database, req: IncomingMessage): Promise<{ user: User; tokenHash: string } | null> {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const hash = sha256(token);
  const now = Date.now();
  const row = await db.get<UserRow & { last_seen_at: number | null }>(
    `SELECT ${USER_COLS}, s.last_seen_at FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    hash,
    now,
  );
  if (!row) return null;
  // "last active" for the devices list, written at most every five minutes
  if (!row.last_seen_at || now - Number(row.last_seen_at) > 5 * 60_000) {
    await db.run('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?', now, hash);
  }
  return { user: userJson(row), tokenHash: hash };
}

const currentUser = async (db: Database, req: IncomingMessage) => (await currentSession(db, req))?.user ?? null;

async function requireSession(db: Database, req: IncomingMessage) {
  const s = await currentSession(db, req);
  if (!s) throw new ApiError(401, 'not_signed_in', 'Sign in to continue.');
  return s;
}
const requireUser = async (db: Database, req: IncomingMessage) => (await requireSession(db, req)).user;

async function startSession(db: Query, req: IncomingMessage, res: ServerResponse, userId: number) {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  const agent = String(req.headers['user-agent'] ?? '').slice(0, 300) || null;
  await db.run(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
    sha256(token),
    userId,
    now + SESSION_MS,
    now,
    now,
    agent,
  );
  addCookie(res, sessionCookie(req, token, Math.floor(SESSION_MS / 1000)));
}

/** "Chrome on macOS" from a user-agent string; enough to recognise your own devices. */
function describeAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : /node|curl|undici|python/i.test(ua)
              ? 'Script'
              : 'Browser';
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'macOS'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux/.test(ua)
              ? 'Linux'
              : '';
  return os ? `${browser} on ${os}` : browser;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanEmail(v: unknown): string {
  const email = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!EMAIL.test(email) || email.length > 254) throw bad('invalid_email', 'Enter an email like name@example.com.');
  return email;
}
function cleanName(v: unknown): string {
  const name = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 2 || name.length > 60) throw bad('invalid_name', 'Enter your name (2 to 60 characters).');
  return name;
}
function cleanPassword(v: unknown): string {
  const password = typeof v === 'string' ? v : '';
  if (password.length < 8 || password.length > 200) throw bad('invalid_password', 'Use a password of at least 8 characters.');
  return password;
}

/** Only same-site paths are allowed as a place to return to after signing in. */
function safeNext(v: string | null): string {
  if (!v || v.length > 200 || !v.startsWith('/') || v.startsWith('//') || !/^[\w\-/?=&.%]*$/.test(v)) return '/';
  return v;
}

// In-memory per process. With several app servers this would move to Redis.
const buckets = new Map<string, { count: number; resetAt: number }>();

function limit(req: IncomingMessage, group: string, max: number, windowMs = 60_000) {
  const ip = req.socket.remoteAddress ?? 'unknown';
  const key = `${group}:${ip}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    return;
  }
  if (++b.count > max) {
    throw new ApiError(429, 'too_many_requests', 'Too many attempts. Wait a minute and try again.', {
      retryAfter: Math.ceil((b.resetAt - now) / 1000),
    });
  }
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
    throw new ApiError(415, 'json_required', 'Send the request as JSON.');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new ApiError(413, 'too_large', 'That request is too large.');
    chunks.push(chunk as Buffer);
  }
  if (!size) return {};
  try {
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (data && typeof data === 'object' && !Array.isArray(data)) return data as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw bad('invalid_json', 'The request body is not valid JSON.');
}

/** Cross-site form posts cannot set a JSON content type; this also rejects a mismatched Origin. */
function checkOrigin(req: IncomingMessage) {
  const origin = req.headers.origin;
  if (!origin) return;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    throw new ApiError(403, 'bad_origin', 'Request blocked.');
  }
  if (host !== req.headers.host) throw new ApiError(403, 'bad_origin', 'Request blocked.');
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

function redirect(res: ServerResponse, location: string) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

/** The site's public address: PUBLIC_URL when set (production), else the address this request came in on. */
function siteUrl(req: IncomingMessage): string {
  const configured = process.env.PUBLIC_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  const origin = req.headers.origin;
  if (origin) return origin;
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${proto}://${req.headers.host ?? 'localhost'}`;
}

const googleRedirectUri = (req: IncomingMessage) => `${siteUrl(req)}/api/auth/google/callback`;

function loadShow(showId: string): { show: Show; layout: HallLayout } {
  const show = parseShow(showId);
  if (!show) throw new ApiError(404, 'show_not_found', 'That showtime does not exist.');
  return { show, layout: getLayout(show.hallId) };
}

const purgeExpiredHolds = (db: Query) => db.run('DELETE FROM holds WHERE expires_at <= ?', Date.now());

/** Every seat nobody else can take right now: the demo crowd, confirmed bookings and other people's holds. */
async function unavailableSeats(db: Query, show: Show, layout: HallLayout, exceptUserId?: number): Promise<Set<string>> {
  const taken = crowdFor(show, layout);
  for (const r of await db.all<{ seat_id: string }>('SELECT seat_id FROM booking_seats WHERE show_id = ?', show.id)) {
    taken.add(r.seat_id);
  }
  const holds = await db.all<{ seat_id: string; user_id: number }>(
    'SELECT seat_id, user_id FROM holds WHERE show_id = ? AND expires_at > ?',
    show.id,
    Date.now(),
  );
  for (const h of holds) if (Number(h.user_id) !== exceptUserId) taken.add(h.seat_id);
  return taken;
}

function cleanSeats(v: unknown, layout: HallLayout): string[] {
  if (!Array.isArray(v) || v.length === 0) throw bad('no_seats', 'Choose at least one seat.');
  const seats = [...new Set(v.map(String))];
  if (seats.length > MAX_SEATS) throw bad('too_many_seats', `You can book up to ${MAX_SEATS} seats at once.`);
  for (const id of seats) if (!layout.byId.has(id)) throw bad('unknown_seat', `Seat ${id} does not exist in this hall.`);
  return seats;
}

async function heldSeats(db: Query, showId: string, userId: number): Promise<Set<string>> {
  const rows = await db.all<{ seat_id: string }>('SELECT seat_id FROM holds WHERE show_id = ? AND user_id = ?', showId, userId);
  return new Set(rows.map((r) => r.seat_id));
}

interface BookingRow {
  id: string;
  show_id: string;
  movie_id: string;
  hall_id: string;
  subtotal: number;
  fees: number;
  total: number;
  payment: string;
  payment_status: string;
  payment_ref: string | null;
  instrument: string | null;
  view_seat: string | null;
  snapshot?: string | null;
  created_at: number;
}

const BOOKING_COLS = 'id, show_id, movie_id, hall_id, subtotal, fees, total, payment, payment_status, payment_ref, instrument, view_seat, created_at';

function bookingJson(row: BookingRow, seats: string[], withSnapshot: boolean) {
  return {
    id: row.id,
    showId: row.show_id,
    movieId: row.movie_id,
    hallId: row.hall_id,
    seats,
    subtotal: Number(row.subtotal),
    fees: Number(row.fees),
    total: Number(row.total),
    payment: row.payment,
    paymentStatus: row.payment_status,
    paymentRef: row.payment_ref,
    instrument: row.instrument,
    viewSeat: row.view_seat,
    snapshot: withSnapshot ? (row.snapshot ?? null) : null,
    createdAt: Number(row.created_at),
  };
}

async function seatsOf(db: Query, bookingId: string): Promise<string[]> {
  return (await db.all<{ seat_id: string }>('SELECT seat_id FROM booking_seats WHERE booking_id = ?', bookingId)).map((r) => r.seat_id);
}

function newBookingId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'SL-' + Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join('');
}

const newPaymentId = () => 'pay_' + randomBytes(9).toString('base64url');

async function recordPayment(
  db: Query,
  p: { id: string; userId: number; showId: string; amount: number; method: string; instrument: string; status: string; bookingId: string | null },
) {
  await db.run(
    'INSERT INTO payments (id, user_id, show_id, amount, method, instrument, status, booking_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    p.id,
    p.userId,
    p.showId,
    p.amount,
    p.method,
    p.instrument,
    p.status,
    p.bookingId,
    Date.now(),
  );
}

/** Records the email in the outbox (the demo inbox reads this) and sends it if SMTP is configured. */
async function sendMail(db: Query, req: IncomingMessage, to: string, kind: string, content: MailContent) {
  const { html, text } = renderMail({ ...content, logoUrl: content.logoUrl ?? `${siteUrl(req)}/brand/sightline-tile-96.png` });
  await db.run(
    'INSERT INTO outbox (to_email, subject, html, body_text, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    to,
    content.subject,
    html,
    text,
    kind,
    Date.now(),
  );
  // reserved addresses (name@example.com) only ever exist in the Demo Inbox
  if (!isReservedEmail(to)) void deliver(to, content.subject, html, text);
}

const firstName = (name: string) => name.split(' ')[0];

async function sendVerification(db: Query, req: IncomingMessage, user: { id: number; email: string; name: string }) {
  const token = randomBytes(32).toString('base64url');
  await db.run('DELETE FROM email_verifications WHERE user_id = ? OR expires_at <= ?', user.id, Date.now());
  await db.run('INSERT INTO email_verifications (token_hash, user_id, expires_at) VALUES (?, ?, ?)', sha256(token), user.id, Date.now() + VERIFY_MS);
  await sendMail(db, req, user.email, 'verify', {
    subject: 'Confirm your email for SightLine',
    heading: 'Confirm your email',
    lines: [
      `Hi ${firstName(user.name)}, welcome to SightLine.`,
      'Confirm this address so your tickets reach you and you can always get back into your account. The link works for 24 hours.',
    ],
    action: { label: 'Confirm Email', url: `${siteUrl(req)}/#/verify?token=${token}` },
    footnote: 'If you did not create an account, ignore this email and nothing will happen.',
  });
}

function bookingFacts(row: BookingRow, seats: string[]): [string, string][] {
  const show = parseShow(row.show_id);
  const hall = getHall(row.hall_id);
  return [
    ['Film', getMovie(row.movie_id)?.title ?? row.movie_id],
    ['When', show ? `${formatDate(show.start)}, ${formatTime(show.start)}` : row.show_id],
    ['Hall', `${hall.name} · ${hall.format}`],
    ['Seats', seats.join(', ')],
    ['Total', money(Number(row.total))],
    ['Payment', row.payment_status === 'due' ? 'Pay at the cinema' : (row.instrument ?? 'Paid')],
    ['Booking reference', row.id],
  ];
}

async function ensureDemoUser(db: Query): Promise<number> {
  const existing = await db.get<{ id: number; email_verified_at: number | null }>('SELECT id, email_verified_at FROM users WHERE email = ?', DEMO_USER.email);
  if (existing) {
    if (existing.email_verified_at == null) await db.run('UPDATE users SET email_verified_at = ? WHERE id = ?', Date.now(), existing.id);
    return Number(existing.id);
  }
  const salt = randomBytes(16).toString('hex');
  const hash = await hashPassword(DEMO_USER.password, salt);
  const row = await db.get<{ id: number }>(
    'INSERT INTO users (email, name, pass_hash, pass_salt, created_at, email_verified_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    DEMO_USER.email,
    DEMO_USER.name,
    hash,
    salt,
    Date.now() - 40 * 24 * 3600_000,
    Date.now(),
  );
  return Number(row!.id);
}

/** Gives the demo account a believable history: two upcoming tickets and one already watched. */
async function seedDemoBookings(db: Database, userId: number) {
  if (await db.get('SELECT 1 AS x FROM bookings WHERE user_id = ?', userId)) return;
  const day = (offset: number) => {
    const d = new Date();
    return dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset));
  };
  const plan: { movie: number; dayOffset: number; slot: number; party: number; method: string; instrument: string; status: string }[] = [
    { movie: 0, dayOffset: 1, slot: 0, party: 2, method: 'upi', instrument: 'de••@okbank', status: 'paid' },
    { movie: 2, dayOffset: 3, slot: 1, party: 3, method: 'card', instrument: 'Card •••• 1111', status: 'paid' },
    { movie: 6, dayOffset: -2, slot: 0, party: 2, method: 'counter', instrument: 'Pay at the cinema', status: 'due' },
  ];
  let created = Date.now() - plan.length * 3600_000;
  await db.tx(async (q) => {
    for (const item of plan) {
      const movie = MOVIES[item.movie];
      const group = showsFor(movie, day(item.dayOffset))[Math.min(item.slot, movie.schedule.length - 1)];
      const show = group.shows[group.shows.length - 1];
      const layout = getLayout(show.hallId);
      const seats = findBestSeats(layout, await unavailableSeats(q, show, layout), item.party);
      if (!seats.length) continue;
      const subtotal = seats.reduce((sum, seat) => sum + seat.zone.price, 0);
      const fees = seats.length * BOOKING_FEE;
      const id = newBookingId();
      const ref = newPaymentId();
      await q.run(
        `INSERT INTO bookings (id, user_id, show_id, movie_id, hall_id, subtotal, fees, total, payment, payment_status, payment_ref, instrument, view_seat, snapshot, idem_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        id, userId, show.id, show.movieId, show.hallId, subtotal, fees, subtotal + fees, item.method, item.status, ref, item.instrument, seats[0].id, `seed-${id}`, created,
      );
      for (const seat of seats) await q.run('INSERT INTO booking_seats (booking_id, show_id, seat_id) VALUES (?, ?, ?)', id, show.id, seat.id);
      await q.run(
        'INSERT INTO payments (id, user_id, show_id, amount, method, instrument, status, booking_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ref, userId, show.id, subtotal + fees, item.method, item.instrument, item.status, id, created,
      );
      created += 3600_000;
    }
  });
}

const isLoopback = (req: IncomingMessage) => {
  const a = req.socket.remoteAddress ?? '';
  // behind a proxy (Vercel, a load balancer) the socket is the proxy, so never trust it as local
  if (req.headers['x-forwarded-for']) return false;
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
};

// example.com/net/org and .test/.example/.invalid/.localhost (RFC 2606, 6761)
const RESERVED_EMAIL = /@(?:[\w-]+\.)*(?:example\.(?:com|net|org)|[\w-]+\.(?:test|example|invalid|localhost))$/i;
export const isReservedEmail = (email: string) => RESERVED_EMAIL.test(email);

// The Demo Inbox shows everything on the server's own machine, but only mail to
// reserved addresses anywhere else, so a public demo never leaks real emails.
const inboxScope = (req: IncomingMessage): 'all' | 'reserved' => (isLoopback(req) ? 'all' : 'reserved');

async function googleRoutes(db: Database, req: IncomingMessage, res: ServerResponse, step: string, query: URLSearchParams) {
  const clearState = () => addCookie(res, `${OAUTH_COOKIE}=; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=0`);
  const toLogin = (error: string) => redirect(res, `/#/login?error=${error}`);

  if (step === 'start') {
    if (!googleConfigured()) return toLogin('google_unavailable');
    limit(req, 'google', 30);
    const start = googleAuthUrl(googleRedirectUri(req));
    const now = Date.now();
    await db.run('DELETE FROM oauth_states WHERE expires_at <= ?', now);
    await db.run(
      'INSERT INTO oauth_states (state_hash, verifier, nonce, next_path, expires_at) VALUES (?, ?, ?, ?, ?)',
      sha256(start.state),
      start.verifier,
      start.nonce,
      safeNext(query.get('next')),
      now + OAUTH_MS,
    );
    addCookie(res, `${OAUTH_COOKIE}=${start.state}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${OAUTH_MS / 1000}${isHttps(req) ? '; Secure' : ''}`);
    return redirect(res, start.url);
  }

  if (step === 'callback') {
    clearState();
    if (!googleConfigured()) return toLogin('google_unavailable');
    if (query.get('error')) return toLogin(query.get('error') === 'access_denied' ? 'google_cancelled' : 'google_failed');
    const state = query.get('state') ?? '';
    const code = query.get('code') ?? '';
    const bound = readCookie(req, OAUTH_COOKIE);
    // the state must match the cookie set in this browser, or someone else started this sign-in
    if (!state || !code || !bound || bound !== state) {
      console.warn('[google] sign-in refused: state mismatch');
      return toLogin('google_failed');
    }
    const row = await db.get<{ verifier: string; nonce: string; next_path: string }>(
      'SELECT verifier, nonce, next_path FROM oauth_states WHERE state_hash = ? AND expires_at > ?',
      sha256(state),
      Date.now(),
    );
    await db.run('DELETE FROM oauth_states WHERE state_hash = ?', sha256(state)); // single use
    if (!row) return toLogin('google_expired');

    let profile;
    try {
      profile = await googleProfile(code, row.verifier, row.nonce, googleRedirectUri(req));
    } catch (err) {
      console.warn('[google] sign-in failed:', err instanceof GoogleError ? err.reason : err);
      return toLogin('google_failed');
    }

    const now = Date.now();
    const name = profile.name.replace(/\s+/g, ' ').slice(0, 60).trim();

    // already signed in: this connects Google to the current account, whatever its email
    const signedIn = await currentSession(db, req);
    if (signedIn) {
      const owner = await db.get<{ id: number }>('SELECT id FROM users WHERE google_sub = ?', profile.sub);
      if (owner && Number(owner.id) !== signedIn.user.id) return redirect(res, '/#/account?google=in_use');
      await db.run('UPDATE users SET google_sub = ? WHERE id = ?', profile.sub, signedIn.user.id);
      return redirect(res, '/#/account?google=connected');
    }

    const { userId, created } = await db.tx(async (q) => {
      const bySub = await q.get<{ id: number }>('SELECT id FROM users WHERE google_sub = ?', profile.sub);
      if (bySub) return { userId: Number(bySub.id), created: false };
      const byEmail = await q.get<{ id: number; email_verified_at: number | null }>('SELECT id, email_verified_at FROM users WHERE email = ?', profile.email);
      if (byEmail) {
        if (byEmail.email_verified_at == null) {
          // Anyone could have registered this address without owning it. Google has now proven
          // who owns it, so the unconfirmed password and its sessions stop working.
          await q.run("UPDATE users SET pass_hash = '', pass_salt = '' WHERE id = ?", byEmail.id);
          await q.run('DELETE FROM sessions WHERE user_id = ?', byEmail.id);
        }
        await q.run('UPDATE users SET google_sub = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?', profile.sub, now, byEmail.id);
        return { userId: Number(byEmail.id), created: false };
      }
      const inserted = await q.get<{ id: number }>(
        "INSERT INTO users (email, name, pass_hash, pass_salt, created_at, google_sub, email_verified_at) VALUES (?, ?, '', '', ?, ?, ?) RETURNING id",
        profile.email,
        name.length >= 2 ? name : profile.email.split('@')[0],
        now,
        profile.sub,
        now,
      );
      return { userId: Number(inserted!.id), created: true };
    });
    await startSession(db, req, res, userId);
    if (created) {
      await sendMail(db, req, profile.email, 'welcome', {
        subject: 'Welcome to SightLine',
        heading: `Welcome, ${firstName(name || 'there')}.`,
        lines: [
          'Your account is ready and you sign in with Google, so there is no password to remember.',
          'Open any showtime and tap a seat to see the screen from exactly where you would sit.',
        ],
        action: { label: 'Find a Movie', url: `${siteUrl(req)}/#/` },
      });
    }
    return redirect(res, `/#${row.next_path}`);
  }

  throw new ApiError(404, 'not_found', 'No such endpoint.');
}

async function route(req: IncomingMessage, res: ServerResponse, method: string, path: string[], query: URLSearchParams): Promise<void> {
  const mutating = method !== 'GET' && method !== 'HEAD';
  if (mutating) {
    checkOrigin(req);
    limit(req, 'write', 300); // flood guard only; sign-in and reset have tighter limits
  }
  const db = await getDb();

  if (method === 'GET' && path[0] === 'health') {
    await db.get('SELECT 1 AS ok');
    return send(res, 200, { ok: true, database: db.kind });
  }

  /* what the site should offer */
  if (method === 'GET' && path[0] === 'config') {
    return send(res, 200, {
      demo: demoEnabled(),
      realEmail: smtpConfigured(),
      demoEmail: demoEnabled() ? DEMO_USER.email : null,
      inbox: inboxScope(req),
      google: googleConfigured(),
      database: db.kind,
    });
  }

  if (path[0] === 'demo') {
    if (!demoEnabled()) throw new ApiError(404, 'not_found', 'No such endpoint.');

    if (method === 'GET' && path[1] === 'outbox') {
      const all = inboxScope(req) === 'all';
      const rows = (
        await db.all<{ id: number; to_email: string; subject: string; html: string; kind: string; created_at: number }>(
          'SELECT id, to_email, subject, html, kind, created_at FROM outbox ORDER BY id DESC LIMIT 400',
        )
      )
        .filter((r) => all || isReservedEmail(r.to_email))
        .slice(0, 40);
      return send(res, 200, {
        scope: all ? 'all' : 'reserved',
        emails: rows.map((r) => ({ id: Number(r.id), to: r.to_email, subject: r.subject, html: r.html, kind: r.kind, createdAt: Number(r.created_at) })),
      });
    }

    if (method === 'POST' && path[1] === 'reset') {
      // wipes every account and booking, so it is refused from anywhere but this machine
      if (!isLoopback(req)) throw new ApiError(403, 'local_only', 'Reset is only allowed from the machine running the server.');
      await readJson(req);
      await db.tx(async (q) => {
        for (const table of ['outbox', 'oauth_states', 'email_verifications', 'password_resets', 'payments', 'booking_seats', 'bookings', 'holds', 'sessions', 'users']) {
          await q.run(`DELETE FROM ${table}`);
        }
      });
      const id = await ensureDemoUser(db);
      await seedDemoBookings(db, id);
      addCookie(res, sessionCookie(req, '', 0));
      return send(res, 200, { ok: true, demoEmail: DEMO_USER.email });
    }
  }

  if (path[0] === 'auth') {
    if (path[1] === 'google' && method === 'GET') return googleRoutes(db, req, res, path[2] ?? '', query);

    if (method === 'GET' && path[1] === 'me') return send(res, 200, { user: await currentUser(db, req) });

    if (method === 'POST' && path[1] === 'signup') {
      limit(req, 'auth', 10);
      const body = await readJson(req);
      const name = cleanName(body.name);
      const email = cleanEmail(body.email);
      const password = cleanPassword(body.password);
      const conflict = () => new ApiError(409, 'email_in_use', 'An account with that email already exists. Sign in instead.');
      if (await db.get('SELECT 1 AS x FROM users WHERE email = ?', email)) throw conflict();
      const salt = randomBytes(16).toString('hex');
      const hash = await hashPassword(password, salt);
      let row: { id: number } | undefined;
      try {
        row = await db.get<{ id: number }>(
          'INSERT INTO users (email, name, pass_hash, pass_salt, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id',
          email,
          name,
          hash,
          salt,
          Date.now(),
        );
      } catch (err) {
        if (isUniqueViolation(err)) throw conflict(); // two sign-ups raced
        throw err;
      }
      const id = Number(row!.id);
      await startSession(db, req, res, id);
      await sendVerification(db, req, { id, email, name });
      return send(res, 201, { user: await loadUser(db, id) });
    }

    if (method === 'POST' && path[1] === 'login') {
      limit(req, 'auth', 10);
      const body = await readJson(req);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const row = await db.get<{ id: number; pass_hash: string; pass_salt: string }>('SELECT id, pass_hash, pass_salt FROM users WHERE email = ?', email);
      // hash even when the account does not exist, so timing does not reveal which emails are registered
      const hash = await hashPassword(password, row?.pass_salt || 'no-such-user-salt');
      if (!row || !sameHash(hash, row.pass_hash)) {
        throw new ApiError(401, 'wrong_credentials', 'That email and password do not match. If you signed up with Google, use Continue with Google.');
      }
      await startSession(db, req, res, Number(row.id));
      return send(res, 200, { user: await loadUser(db, Number(row.id)) });
    }

    if (method === 'DELETE' && path[1] === 'google') {
      const user = await requireUser(db, req);
      // never leave an account with no way to sign in
      if (!user.hasPassword) throw new ApiError(409, 'needs_password', 'Add a password first, so you can still sign in without Google.');
      await db.run('UPDATE users SET google_sub = NULL WHERE id = ?', user.id);
      return send(res, 200, { user: { ...user, google: false } });
    }

    if (method === 'POST' && path[1] === 'logout') {
      const token = readCookie(req, COOKIE);
      if (token) await db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
      addCookie(res, sessionCookie(req, '', 0));
      return send(res, 200, { ok: true });
    }

    if (method === 'POST' && path[1] === 'demo') {
      if (!demoEnabled()) throw new ApiError(404, 'not_found', 'No such endpoint.');
      limit(req, 'demo', 20);
      await readJson(req);
      const id = await ensureDemoUser(db);
      await seedDemoBookings(db, id);
      await startSession(db, req, res, id);
      return send(res, 200, { user: await loadUser(db, id) });
    }

    if (method === 'POST' && path[1] === 'forgot') {
      limit(req, 'reset', 8);
      const body = await readJson(req);
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const row = await db.get<{ id: number; name: string; pass_hash: string }>('SELECT id, name, pass_hash FROM users WHERE email = ?', email);
      if (row) {
        const token = randomBytes(32).toString('base64url');
        await db.run('DELETE FROM password_resets WHERE user_id = ? OR expires_at <= ?', row.id, Date.now());
        await db.run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)', sha256(token), row.id, Date.now() + RESET_MS);
        const hasPassword = row.pass_hash !== '';
        await sendMail(db, req, email, 'reset', {
          subject: hasPassword ? 'Reset your SightLine password' : 'Set a password for SightLine',
          heading: hasPassword ? 'Reset your password' : 'Set a password',
          lines: [
            hasPassword
              ? `Hi ${firstName(row.name)}, we got a request to reset your password.`
              : `Hi ${firstName(row.name)}, you sign in with Google. You can also add a password to sign in with your email.`,
            'This link works once and expires in 30 minutes. If you did not ask for it, you can ignore this email.',
          ],
          action: { label: hasPassword ? 'Choose a New Password' : 'Set a Password', url: `${siteUrl(req)}/#/reset?token=${token}` },
          footnote: 'For your security we never send your password by email.',
        });
      }
      // the same answer either way, so this cannot be used to find out who has an account
      return send(res, 200, { ok: true });
    }

    if (method === 'POST' && path[1] === 'reset') {
      limit(req, 'reset', 8);
      const body = await readJson(req);
      const token = typeof body.token === 'string' ? body.token : '';
      const password = cleanPassword(body.password);
      const row = await db.get<{ user_id: number }>('SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > ?', sha256(token), Date.now());
      if (!row) throw new ApiError(400, 'reset_invalid', 'This reset link has expired or was already used. Request a new one.');
      const salt = randomBytes(16).toString('hex');
      const hash = await hashPassword(password, salt);
      await db.tx(async (q) => {
        // the link arrived by email, so it also proves the address
        await q.run('UPDATE users SET pass_hash = ?, pass_salt = ?, email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?', hash, salt, Date.now(), row.user_id);
        await q.run('DELETE FROM password_resets WHERE user_id = ?', row.user_id);
        await q.run('DELETE FROM sessions WHERE user_id = ?', row.user_id); // sign out everywhere
      });
      return send(res, 200, { ok: true });
    }

    if (method === 'POST' && path[1] === 'verify' && !path[2]) {
      limit(req, 'verify', 20);
      const body = await readJson(req);
      const token = typeof body.token === 'string' ? body.token : '';
      const row = await db.get<{ user_id: number }>('SELECT user_id FROM email_verifications WHERE token_hash = ? AND expires_at > ?', sha256(token), Date.now());
      if (!row) throw new ApiError(400, 'verify_invalid', 'This confirmation link has expired or was already used. Sign in and send a new one from your account.');
      await db.tx(async (q) => {
        await q.run('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?', Date.now(), row.user_id);
        await q.run('DELETE FROM email_verifications WHERE user_id = ?', row.user_id);
      });
      return send(res, 200, { ok: true });
    }

    if (method === 'POST' && path[1] === 'verify' && path[2] === 'resend') {
      limit(req, 'verify-send', 4);
      const user = await requireUser(db, req);
      await readJson(req);
      if (!user.emailVerified) await sendVerification(db, req, user);
      return send(res, 200, { ok: true, alreadyVerified: user.emailVerified });
    }

    if (method === 'PATCH' && path[1] === 'me') {
      const user = await requireUser(db, req);
      const body = await readJson(req);
      const name = cleanName(body.name);
      await db.run('UPDATE users SET name = ? WHERE id = ?', name, user.id);
      return send(res, 200, { user: { ...user, name } });
    }

    if (method === 'DELETE' && path[1] === 'me') {
      limit(req, 'password', 10);
      const user = await requireUser(db, req);
      const body = await readJson(req);
      const confirm = typeof body.confirm === 'string' ? body.confirm.trim().toLowerCase() : '';
      if (confirm !== user.email) throw bad('confirm_mismatch', 'Type your email address exactly to confirm.');
      const bookings = await db.all<BookingRow>(`SELECT ${BOOKING_COLS} FROM bookings WHERE user_id = ?`, user.id);
      const upcoming = bookings.filter((b) => (parseShow(b.show_id)?.start.getTime() ?? 0) > Date.now());
      const refunds = upcoming.filter((b) => b.payment_status === 'paid');
      // everything the account owns (sessions, holds, bookings, payment records) goes with it
      await db.run('DELETE FROM users WHERE id = ?', user.id);
      addCookie(res, sessionCookie(req, '', 0));
      await sendMail(db, req, user.email, 'deleted', {
        subject: 'Your SightLine account has been deleted',
        heading: 'Your account is deleted',
        lines: [
          `Your account and its ${bookings.length === 1 ? 'booking' : 'bookings'} have been removed.`,
          upcoming.length
            ? `${upcoming.length} upcoming ${upcoming.length === 1 ? 'booking was' : 'bookings were'} cancelled and the seats released.${refunds.length ? ` Refunds totalling ${money(refunds.reduce((s, b) => s + Number(b.total), 0))} have been started (test mode: no money moved).` : ''}`
            : 'There were no upcoming bookings to cancel.',
          'You are welcome back any time.',
        ],
      });
      return send(res, 200, { ok: true, cancelled: upcoming.length });
    }

    if (method === 'POST' && path[1] === 'password') {
      limit(req, 'password', 10);
      const { user, tokenHash } = await requireSession(db, req);
      const body = await readJson(req);
      const next = cleanPassword(body.newPassword);
      const row = await db.get<{ pass_hash: string; pass_salt: string }>('SELECT pass_hash, pass_salt FROM users WHERE id = ?', user.id);
      // an account that signs in with Google can add a first password without one
      if (row!.pass_hash) {
        const check = await hashPassword(typeof body.currentPassword === 'string' ? body.currentPassword : '', row!.pass_salt);
        if (!sameHash(check, row!.pass_hash)) throw new ApiError(401, 'wrong_credentials', 'Your current password is not correct.');
      }
      const salt = randomBytes(16).toString('hex');
      await db.run('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?', await hashPassword(next, salt), salt, user.id);
      // changing the password signs out every other device
      await db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', user.id, tokenHash);
      return send(res, 200, { ok: true });
    }

    /* signed-in devices */
    if (path[1] === 'sessions') {
      const { user, tokenHash } = await requireSession(db, req);

      if (method === 'GET' && !path[2]) {
        const rows = await db.all<{ token_hash: string; created_at: number | null; last_seen_at: number | null; user_agent: string | null }>(
          'SELECT token_hash, created_at, last_seen_at, user_agent FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_seen_at DESC',
          user.id,
          Date.now(),
        );
        const sessions = rows
          .map((r) => ({
            id: r.token_hash.slice(0, 16),
            device: describeAgent(r.user_agent),
            current: r.token_hash === tokenHash,
            createdAt: r.created_at == null ? null : Number(r.created_at),
            lastSeenAt: r.last_seen_at == null ? null : Number(r.last_seen_at),
          }))
          .sort((a, b) => Number(b.current) - Number(a.current));
        return send(res, 200, { sessions });
      }

      if (method === 'DELETE' && path[2]) {
        const id = path[2];
        if (!/^[0-9a-f]{16}$/.test(id)) throw new ApiError(404, 'session_not_found', 'That device is already signed out.');
        const removed = await db.run('DELETE FROM sessions WHERE user_id = ? AND substr(token_hash, 1, 16) = ?', user.id, id);
        if (!removed) throw new ApiError(404, 'session_not_found', 'That device is already signed out.');
        const current = tokenHash.startsWith(id);
        if (current) addCookie(res, sessionCookie(req, '', 0));
        return send(res, 200, { ok: true, current });
      }

      if (method === 'DELETE' && !path[2]) {
        const removed = await db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', user.id, tokenHash);
        return send(res, 200, { ok: true, removed });
      }
    }
  }

  if (path[0] === 'shows' && path[1]) {
    const { show, layout } = loadShow(path[1]);

    if (method === 'GET' && path[2] === 'seats') {
      await purgeExpiredHolds(db);
      const user = await currentUser(db, req);
      const mine = user
        ? await db.all<{ seat_id: string; expires_at: number }>(
            'SELECT seat_id, expires_at FROM holds WHERE show_id = ? AND user_id = ? AND expires_at > ?',
            show.id,
            user.id,
            Date.now(),
          )
        : [];
      return send(res, 200, {
        taken: [...(await unavailableSeats(db, show, layout, user?.id))],
        hold: mine.length ? { seats: mine.map((m) => m.seat_id), expiresAt: Math.min(...mine.map((m) => Number(m.expires_at))) } : null,
      });
    }

    if (method === 'POST' && path[2] === 'hold') {
      const user = await requireUser(db, req);
      const body = await readJson(req);
      const seats = cleanSeats(body.seats, layout);
      if (show.start.getTime() < Date.now()) throw new ApiError(409, 'show_started', 'That show has already started.');
      const expiresAt = Date.now() + HOLD_MS;
      try {
        await db.tx(async (q) => {
          await purgeExpiredHolds(q);
          await q.run('DELETE FROM holds WHERE show_id = ? AND user_id = ?', show.id, user.id);
          const taken = await unavailableSeats(q, show, layout, user.id);
          const lost = seats.filter((id) => taken.has(id));
          if (lost.length) throw new ApiError(409, 'seats_taken', `Seat ${lost.join(', ')} was just taken. Pick another.`, { seats: lost });
          for (const id of seats) await q.run('INSERT INTO holds (show_id, seat_id, user_id, expires_at) VALUES (?, ?, ?, ?)', show.id, id, user.id, expiresAt);
        });
      } catch (err) {
        if (err instanceof ApiError) throw err;
        if (!isUniqueViolation(err)) throw err;
        // the UNIQUE constraint caught a race with another customer
        throw new ApiError(409, 'seats_taken', 'One of those seats was just taken. Pick another.');
      }
      return send(res, 200, { hold: { seats, expiresAt } });
    }

    if (method === 'DELETE' && path[2] === 'hold') {
      const user = await requireUser(db, req);
      await db.run('DELETE FROM holds WHERE show_id = ? AND user_id = ?', show.id, user.id);
      return send(res, 200, { ok: true });
    }
  }

  if (path[0] === 'bookings') {
    const user = await requireUser(db, req);

    if (method === 'GET' && !path[1]) {
      const rows = await db.all<BookingRow>(`SELECT ${BOOKING_COLS} FROM bookings WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`, user.id);
      // one query for every ticket's seats rather than one per ticket
      const seatRows = await db.all<{ booking_id: string; seat_id: string }>(
        'SELECT bs.booking_id, bs.seat_id FROM booking_seats bs JOIN bookings b ON b.id = bs.booking_id WHERE b.user_id = ?',
        user.id,
      );
      const seatsBy = new Map<string, string[]>();
      for (const r of seatRows) seatsBy.set(r.booking_id, [...(seatsBy.get(r.booking_id) ?? []), r.seat_id]);
      return send(res, 200, { bookings: rows.map((r) => bookingJson(r, seatsBy.get(r.id) ?? [], false)) });
    }

    if (method === 'GET' && path[1]) {
      const row = await db.get<BookingRow>('SELECT * FROM bookings WHERE id = ? AND user_id = ?', path[1], user.id);
      if (!row) throw new ApiError(404, 'booking_not_found', 'We could not find that ticket.');
      return send(res, 200, { booking: bookingJson(row, await seatsOf(db, row.id), true) });
    }

    if (method === 'POST' && !path[1]) {
      const body = await readJson(req);
      const { show, layout } = loadShow(String(body.showId ?? ''));
      const seats = cleanSeats(body.seats, layout);
      const idemKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.slice(0, 80) : '';
      if (idemKey.length < 8) throw bad('invalid_key', 'Missing request key.');
      const snapshot =
        typeof body.snapshot === 'string' && body.snapshot.startsWith('data:image/jpeg;base64,') && body.snapshot.length <= MAX_SNAPSHOT
          ? body.snapshot
          : null;
      const viewSeat = typeof body.viewSeat === 'string' && layout.byId.has(body.viewSeat) ? body.viewSeat : null;

      // a retry or double click with the same key gets the first booking back
      const replayed = async () => {
        const replay = await db.get<BookingRow>('SELECT * FROM bookings WHERE user_id = ? AND idem_key = ?', user.id, idemKey);
        if (replay) send(res, 200, { booking: bookingJson(replay, await seatsOf(db, replay.id), true) });
        return !!replay;
      };
      if (await replayed()) return;

      if (show.start.getTime() < Date.now()) throw new ApiError(409, 'show_started', 'That show has already started.');

      // the server owns the price
      const subtotal = seats.reduce((sum, id) => sum + layout.byId.get(id)!.zone.price, 0);
      const fees = seats.length * BOOKING_FEE;
      const total = subtotal + fees;
      const id = newBookingId();

      // never take payment for seats the customer no longer holds
      await purgeExpiredHolds(db);
      const heldNow = await heldSeats(db, show.id, user.id);
      if (!seats.every((seat) => heldNow.has(seat))) {
        // the twin of this request may have just booked them
        if (await replayed()) return;
        throw new ApiError(409, 'hold_expired', 'Your seats were released because the hold ran out. Choose them again.');
      }

      const paid = charge(body.payment);
      if (!paid.ok && paid.kind === 'invalid') throw bad('invalid_payment', paid.message);
      const payRef = newPaymentId();
      if (!paid.ok) {
        await recordPayment(db, { id: payRef, userId: user.id, showId: show.id, amount: total, method: paid.method ?? 'unknown', instrument: paid.instrument ?? '', status: 'declined', bookingId: null });
        throw new ApiError(402, 'payment_declined', paid.message);
      }
      const payment = paid.method;

      try {
        await db.tx(async (q) => {
          await purgeExpiredHolds(q);
          const held = await heldSeats(q, show.id, user.id);
          if (!seats.every((s) => held.has(s))) {
            throw new ApiError(409, 'hold_expired', 'Your seats were released because the hold ran out. Choose them again.');
          }
          await q.run(
            `INSERT INTO bookings (id, user_id, show_id, movie_id, hall_id, subtotal, fees, total, payment, payment_status, payment_ref, instrument, view_seat, snapshot, idem_key, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            id, user.id, show.id, show.movieId, show.hallId, subtotal, fees, total, payment, paid.status, payRef, paid.instrument, viewSeat, snapshot, idemKey, Date.now(),
          );
          await recordPayment(q, { id: payRef, userId: user.id, showId: show.id, amount: total, method: payment, instrument: paid.instrument, status: paid.status, bookingId: id });
          for (const seat of seats) await q.run('INSERT INTO booking_seats (booking_id, show_id, seat_id) VALUES (?, ?, ?)', id, show.id, seat);
          await q.run('DELETE FROM holds WHERE show_id = ? AND user_id = ?', show.id, user.id);
        });
      } catch (err) {
        // the charge went through but the booking did not: record it as voided so nothing is owed
        if (await replayed()) {
          await recordPayment(db, { id: payRef, userId: user.id, showId: show.id, amount: total, method: payment, instrument: paid.instrument, status: 'void', bookingId: null });
          return;
        }
        await recordPayment(db, { id: payRef, userId: user.id, showId: show.id, amount: total, method: payment, instrument: paid.instrument, status: 'void', bookingId: null });
        if (err instanceof ApiError) throw err;
        if (!isUniqueViolation(err)) throw err;
        throw new ApiError(409, 'seats_taken', 'One of those seats was just taken. Choose again. You have not been charged.');
      }
      const row = (await db.get<BookingRow>('SELECT * FROM bookings WHERE id = ?', id))!;
      const json = bookingJson(row, seats, true);
      await sendMail(db, req, user.email, 'ticket', {
        subject: `Your tickets for ${getMovie(row.movie_id)?.title ?? 'your film'} (${row.id})`,
        heading: `You’re booked, ${firstName(user.name)}.`,
        lines: ['Show the QR code on your ticket at the door. You can cancel any time before the show starts.'],
        facts: bookingFacts(row, json.seats),
        action: { label: 'View Your Ticket', url: `${siteUrl(req)}/#/ticket/${row.id}` },
      });
      return send(res, 201, { booking: json });
    }

    if (method === 'DELETE' && path[1]) {
      const row = await db.get<BookingRow>(`SELECT ${BOOKING_COLS} FROM bookings WHERE id = ? AND user_id = ?`, path[1], user.id);
      if (!row) throw new ApiError(404, 'booking_not_found', 'We could not find that ticket.');
      const show = parseShow(row.show_id);
      if (show && show.start.getTime() < Date.now()) {
        throw new ApiError(409, 'show_started', 'This show has already started, so the booking can no longer be cancelled.');
      }
      const seats = await seatsOf(db, row.id);
      const refunded = row.payment_status === 'paid';
      await db.tx(async (q) => {
        await q.run("UPDATE payments SET status = ? WHERE booking_id = ? AND status IN ('paid', 'due')", refunded ? 'refunded' : 'void', row.id);
        await q.run('DELETE FROM bookings WHERE id = ?', row.id); // booking_seats cascade, freeing the seats
      });
      await sendMail(db, req, user.email, 'cancelled', {
        subject: `Booking ${row.id} cancelled`,
        heading: 'Your booking is cancelled',
        lines: [
          'Your seats have been released.',
          refunded
            ? `A refund of ${money(Number(row.total))} to ${row.instrument ?? 'your payment method'} has been started (test mode: no money moved).`
            : 'Nothing was due, so there is nothing to refund.',
        ],
        facts: bookingFacts(row, seats).slice(0, 4),
      });
      return send(res, 200, { ok: true, refunded });
    }
  }

  throw new ApiError(404, 'not_found', 'No such endpoint.');
}

// `url` is the path after /api
export async function handleApi(req: IncomingMessage, res: ServerResponse, url: string): Promise<void> {
  try {
    const [pathname, search = ''] = url.split('?');
    const path = pathname.split('/').filter(Boolean).map(decodeURIComponent);
    await route(req, res, (req.method ?? 'GET').toUpperCase(), path, new URLSearchParams(search));
  } catch (err) {
    if (res.headersSent) return;
    if (err instanceof ApiError) {
      if (err.status === 429 && err.extra?.retryAfter) res.setHeader('Retry-After', String(err.extra.retryAfter));
      send(res, err.status, { error: { code: err.code, message: err.message, ...err.extra } });
      return;
    }
    console.error('[api] unexpected error', err);
    const dbDown = /ECONNREFUSED|ENOTFOUND|connect|terminat/i.test(String((err as Error)?.message));
    send(res, dbDown ? 503 : 500, {
      error: dbDown
        ? { code: 'unavailable', message: 'The service is briefly unavailable. Try again in a moment.' }
        : { code: 'server_error', message: 'Something went wrong on our side. Try again.' },
    });
  }
}
