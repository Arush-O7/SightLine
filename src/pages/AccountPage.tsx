import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage, inboxShows, type DeviceSession } from '../lib/api';
import { useStore } from '../lib/store';
import { useTitle } from '../lib/useTitle';
import GoogleMark from '../components/GoogleMark';
import { LinesSkeleton } from '../components/Skeleton';

type Note = { ok: boolean; text: string } | null;

const dayFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

/** "Active now", "12 minutes ago", "3 days ago" */
function ago(ms: number | null): string {
  if (!ms) return 'Some time ago';
  const mins = Math.round((Date.now() - ms) / 60_000);
  if (mins < 6) return 'Active now';
  const rtf = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' });
  if (mins < 60) return `Active ${rtf.format(-mins, 'minute')}`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Active ${rtf.format(-hours, 'hour')}`;
  return `Active ${rtf.format(-Math.round(hours / 24), 'day')}`;
}

const GOOGLE_NOTES: Record<string, Note> = {
  connected: { ok: true, text: 'Google is connected. You can now sign in with it.' },
  in_use: { ok: false, text: 'That Google account already belongs to another SightLine account.' },
};

function NoteLine({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <p className={note.ok ? 'form-ok' : 'form-error'} role={note.ok ? 'status' : 'alert'}>
      {note.text}
    </p>
  );
}

export default function AccountPage() {
  useTitle('Account');
  const user = useStore((s) => s.user)!;
  const config = useStore((s) => s.config);
  const signOut = useStore((s) => s.signOut);
  const count = useStore((s) => s.bookings?.length ?? 0);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [busy, setBusy] = useState<string | null>(null);

  /* profile */
  const [name, setName] = useState(user.name);
  const [nameNote, setNameNote] = useState<Note>(null);
  const [verifyNote, setVerifyNote] = useState<Note>(null);

  /* sign-in methods */
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [passNote, setPassNote] = useState<Note>(null);
  const [googleNote, setGoogleNote] = useState<Note>(GOOGLE_NOTES[params.get('google') ?? ''] ?? null);

  /* devices */
  const [devices, setDevices] = useState<DeviceSession[] | null>(null);
  const [deviceNote, setDeviceNote] = useState<Note>(null);

  /* delete */
  const [confirm, setConfirm] = useState('');
  const [deleteNote, setDeleteNote] = useState<Note>(null);

  // the ?google= note is shown once; drop it from the address
  useEffect(() => {
    if (params.has('google')) setParams({}, { replace: true });
  }, [params, setParams]);

  const loadDevices = useCallback(() => {
    api
      .sessions()
      .then(setDevices)
      .catch((err) => setDeviceNote({ ok: false, text: errorMessage(err) }));
  }, []);
  useEffect(loadDevices, [loadDevices]);

  const run = async (key: string, work: () => Promise<void>, onError: (n: Note) => void) => {
    setBusy(key);
    try {
      await work();
    } catch (err) {
      onError({ ok: false, text: errorMessage(err) });
    }
    setBusy(null);
  };

  const saveName = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setNameNote({ ok: false, text: 'Enter your name (at least 2 characters).' });
    void run(
      'name',
      async () => {
        useStore.setState({ user: await api.updateName(name.trim()) });
        setNameNote({ ok: true, text: 'Name saved.' });
      },
      setNameNote,
    );
  };

  const resend = () =>
    run(
      'verify',
      async () => {
        const r = await api.resendVerification();
        if (r.alreadyVerified) useStore.setState({ user: { ...user, emailVerified: true } });
        else setVerifyNote({ ok: true, text: inboxShows(config, user.email) ? 'Link sent. Open it from the Demo Inbox.' : `Link sent to ${user.email}.` });
      },
      setVerifyNote,
    );

  const savePassword = (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setPassNote({ ok: false, text: 'Use a new password of at least 8 characters.' });
    void run(
      'pass',
      async () => {
        await api.changePassword(current, next);
        setCurrent('');
        setNext('');
        setPassNote({ ok: true, text: user.hasPassword ? 'Password changed. Other devices have been signed out.' : 'Password added. You can now sign in with your email too.' });
        useStore.setState({ user: { ...user, hasPassword: true } });
        loadDevices();
      },
      setPassNote,
    );
  };

  const disconnectGoogle = () =>
    run(
      'google',
      async () => {
        useStore.setState({ user: await api.disconnectGoogle() });
        setGoogleNote({ ok: true, text: 'Google is disconnected. Sign in with your email and password.' });
      },
      setGoogleNote,
    );

  const signOutDevice = (d: DeviceSession) =>
    run(
      `device-${d.id}`,
      async () => {
        await api.signOutDevice(d.id);
        setDevices((list) => list?.filter((x) => x.id !== d.id) ?? null);
        setDeviceNote({ ok: true, text: `${d.device} is signed out.` });
      },
      setDeviceNote,
    );

  const signOutOthers = () =>
    run(
      'others',
      async () => {
        const r = await api.signOutOtherDevices();
        setDevices((list) => list?.filter((x) => x.current) ?? null);
        setDeviceNote({ ok: true, text: r.removed === 1 ? 'Signed out 1 other device.' : `Signed out ${r.removed} other devices.` });
      },
      setDeviceNote,
    );

  const deleteAccount = (e: FormEvent) => {
    e.preventDefault();
    void run(
      'delete',
      async () => {
        await api.deleteAccount(confirm);
        useStore.setState({ user: null, bookings: null, snapshots: {} });
        navigate('/', { replace: true });
      },
      setDeleteNote,
    );
  };

  const leave = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  const others = devices?.filter((d) => !d.current).length ?? 0;

  return (
    <div className="container section account">
      <div className="section-head">
        <div>
          <h1>Account</h1>
          <p className="muted">
            {user.email}
            {user.createdAt ? ` · Member since ${dayFormat.format(new Date(user.createdAt))}` : ''}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={leave}>
          Sign Out
        </button>
      </div>

      <div className="account-grid">
        <form className="card account-card" onSubmit={saveName} noValidate>
          <h2>Profile</h2>
          <label className="field">
            <span>Full name</span>
            <input name="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <div className="field">
            <span>Email</span>
            <div className="account-email">
              <span>{user.email}</span>
              <span className={`status-tag ${user.emailVerified ? 'is-ok' : 'is-pending'}`}>{user.emailVerified ? 'Confirmed' : 'Not confirmed'}</span>
            </div>
            {!user.emailVerified ? (
              <small>
                <button type="button" className="link-button" onClick={resend} disabled={busy === 'verify'}>
                  {busy === 'verify' ? 'Sending…' : 'Send a new confirmation link'}
                </button>
              </small>
            ) : null}
          </div>
          <NoteLine note={verifyNote ?? nameNote} />
          <button type="submit" className="btn btn-primary" disabled={busy === 'name' || name.trim() === user.name}>
            {busy === 'name' ? 'Saving…' : 'Save Name'}
          </button>
        </form>

        <div className="card account-card">
          <h2>Sign-In Methods</h2>
          <form className="signin-method" onSubmit={savePassword} noValidate>
            <h3>{user.hasPassword ? 'Password' : 'Add a Password'}</h3>
            {!user.hasPassword ? <p className="muted">You sign in with Google. Add a password to sign in with your email as well.</p> : null}
            {user.hasPassword ? (
              <label className="field">
                <span>Current password</span>
                <input name="current-password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
              </label>
            ) : null}
            <label className="field">
              <span>New password</span>
              <input name="new-password" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
              <small>At least 8 characters.</small>
            </label>
            <NoteLine note={passNote} />
            <button type="submit" className="btn btn-primary" disabled={busy === 'pass' || (user.hasPassword && !current) || !next}>
              {busy === 'pass' ? 'Saving…' : user.hasPassword ? 'Change Password' : 'Add Password'}
            </button>
          </form>

          {/* a server without Google keys offers nothing to connect, but an account linked earlier can still disconnect */}
          {user.google || config?.google ? (
            <div className="signin-method signin-google">
              <div className="signin-row">
                <GoogleMark />
                <div>
                  <h3>Google</h3>
                  <p className="muted">{user.google ? 'Connected. You can sign in with Google.' : 'Not connected.'}</p>
                </div>
              </div>
              <NoteLine note={googleNote} />
              {user.google ? (
                user.hasPassword ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={disconnectGoogle} disabled={busy === 'google'}>
                    {busy === 'google' ? 'Disconnecting…' : 'Disconnect Google'}
                  </button>
                ) : null
              ) : (
                <a className="btn btn-secondary btn-sm" href={api.googleSignInUrl('/account')}>
                  Connect Google
                </a>
              )}
            </div>
          ) : null}
        </div>

        <div className="card account-card">
          <h2>Devices</h2>
          <p className="muted">Where your account is signed in. Sign out anything you don’t recognise.</p>
          {devices === null && !deviceNote ? (
            <LinesSkeleton lines={2} label="Loading devices…" />
          ) : null}
          {devices?.length ? (
            <ul className="device-list">
              {devices.map((d) => (
                <li key={d.id}>
                  <div>
                    <strong>{d.device}</strong>
                    <span className="muted">
                      {d.current ? 'This device' : ago(d.lastSeenAt)}
                      {d.createdAt ? ` · Signed in ${dayFormat.format(new Date(d.createdAt))}` : ''}
                    </span>
                  </div>
                  {d.current ? null : (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => signOutDevice(d)}
                      disabled={busy === `device-${d.id}`}
                      aria-label={`Sign out ${d.device}`}
                    >
                      Sign Out
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          <NoteLine note={deviceNote} />
          {others > 0 ? (
            <button type="button" className="btn btn-secondary" onClick={signOutOthers} disabled={busy === 'others'}>
              {busy === 'others' ? 'Signing Out…' : 'Sign Out All Other Devices'}
            </button>
          ) : null}
        </div>

        <div className="card account-card">
          <h2>Tickets</h2>
          <p className="muted">
            {count === 0 ? 'You have no tickets yet.' : `You have ${count} ${count === 1 ? 'ticket' : 'tickets'} on this account.`}
          </p>
          <Link to={count === 0 ? '/' : '/bookings'} className="btn btn-secondary">
            {count === 0 ? 'Browse Movies' : 'View My Tickets'}
          </Link>
        </div>

        <form className="card account-card account-danger" onSubmit={deleteAccount} noValidate>
          <h2>Delete Account</h2>
          <p className="muted">
            This permanently removes your account, your tickets and your payment records. Upcoming bookings are cancelled, their seats released
            and paid ones refunded. It can’t be undone.
          </p>
          <label className="field">
            <span>
              Type <strong>{user.email}</strong> to confirm
            </span>
            <input name="confirm-email" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" spellCheck={false} inputMode="email" />
          </label>
          <NoteLine note={deleteNote} />
          <button type="submit" className="btn btn-danger" disabled={busy === 'delete' || confirm.trim().toLowerCase() !== user.email}>
            {busy === 'delete' ? 'Deleting…' : 'Delete My Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
