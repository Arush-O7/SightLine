import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { api, ApiFailure, errorMessage } from '../lib/api';
import { useStore } from '../lib/store';
import GoogleMark from '../components/GoogleMark';
import { useTitle } from '../lib/useTitle';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** only ever return to a page inside this site */
const safeNext = (raw: string | null) => (raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/');

/** Why the server sent the browser back from Google. */
function googleProblem(code: string | null, demo: boolean): string | null {
  switch (code) {
    case 'google_cancelled':
      return 'Google sign-in was cancelled. Try again, or use your email below.';
    case 'google_expired':
      return 'That Google sign-in took too long. Try again.';
    case 'google_failed':
      return 'We couldn’t sign you in with Google. Try again, or use your email below.';
    case 'google_unavailable':
      return demo
        ? 'Google sign-in isn’t set up on this server yet. Add a Google client ID and secret to .env (the README shows how), then restart.'
        : 'Google sign-in isn’t available right now. Use your email below.';
    default:
      return null;
  }
}

export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const signup = mode === 'signup';
  useTitle(signup ? 'Create Account' : 'Sign In');
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const config = useStore((s) => s.config);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  // a field is checked when the visitor leaves it with something typed, or on submit
  const [left, setLeft] = useState<Record<string, boolean>>({});
  const check = (field: string) => touched || !!left[field];
  const leave = (field: string, value: string) => () => value && setLeft((l) => ({ ...l, [field]: true }));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const googleError = googleProblem(params.get('error'), !!config?.demo);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  if (user && !busy) return <Navigate to={next} replace />;

  const nameOk = !signup || name.trim().length >= 2;
  const emailOk = EMAIL.test(email.trim());
  const passOk = signup ? password.length >= 8 : password.length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setFailure(null);
    if (!nameOk || !emailOk || !passOk) {
      (!nameOk ? nameRef : !emailOk ? emailRef : passRef).current?.focus();
      return;
    }
    setBusy(true);
    try {
      const account = signup ? await api.signup(name.trim(), email.trim(), password) : await api.login(email.trim(), password);
      setUser(account);
      navigate(next, { replace: true });
    } catch (err) {
      setFailure(errorMessage(err));
      setBusy(false);
      if (err instanceof ApiFailure && err.code === 'wrong_credentials') passRef.current?.focus();
    }
  };

  const useDemo = async () => {
    setFailure(null);
    setBusy(true);
    try {
      setUser(await api.demoLogin());
      navigate(next, { replace: true });
    } catch (err) {
      setFailure(errorMessage(err));
      setBusy(false);
    }
  };

  const other = `${signup ? '/login' : '/signup'}${next === '/' ? '' : `?next=${encodeURIComponent(next)}`}`;

  return (
    <div className="container auth">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>{signup ? 'Create Your Account' : 'Sign In'}</h1>
        <p className="muted">
          {signup ? 'Save your tickets and book faster next time.' : 'Welcome back. Your tickets are waiting.'}
        </p>

        {failure || googleError ? (
          <p className="form-error" role="alert">
            {failure ?? googleError}
          </p>
        ) : null}

        {config?.google || config?.demo ? (
          <>
            <a
              href={api.googleSignInUrl(next)}
              className="btn btn-secondary btn-lg btn-block btn-google"
              aria-disabled={busy}
              onClick={(e) => {
                if (busy) e.preventDefault();
                // a modified click opens a new tab, so this page stays usable
                else if (!(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) setBusy(true);
              }}
            >
              <GoogleMark />
              Continue with Google
            </a>
            <div className="auth-or" role="separator">
              or use your email
            </div>
          </>
        ) : null}

        {signup ? (
          <label className={`field ${check('name') && !nameOk ? 'bad' : ''}`}>
            <span>Full name</span>
            <input
              ref={nameRef}
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={leave('name', name)}
              autoComplete="name"
              placeholder="Alex Morgan…"
              aria-invalid={check('name') && !nameOk}
            />
            {check('name') && !nameOk ? <em role="alert">Enter your full name.</em> : null}
          </label>
        ) : null}

        <label className={`field ${check('email') && !emailOk ? 'bad' : ''}`}>
          <span>Email</span>
          <input
            ref={emailRef}
            name="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={leave('email', email)}
            autoComplete="email"
            spellCheck={false}
            placeholder="alex@example.com…"
            aria-invalid={check('email') && !emailOk}
          />
          {check('email') && !emailOk ? (
            <em role="alert">Enter an email like name@example.com.</em>
          ) : signup && config?.demo && config.inbox === 'reserved' ? (
            <small>
              This is a demo. Use any address ending in @example.com to read your emails in the <Link to="/demo/inbox">Demo Inbox</Link>.
            </small>
          ) : null}
        </label>

        <label className={`field ${check('pass') && !passOk ? 'bad' : ''}`}>
          <span>Password</span>
          <span className="field-wrap">
            <input
              ref={passRef}
              name="password"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={leave('pass', password)}
              autoComplete={signup ? 'new-password' : 'current-password'}
              aria-invalid={check('pass') && !passOk}
            />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
          {check('pass') && !passOk ? (
            <em role="alert">{signup ? 'Use at least 8 characters.' : 'Enter your password.'}</em>
          ) : signup ? (
            <small>At least 8 characters.</small>
          ) : (
            <small>
              <Link to="/forgot">Forgot your password?</Link>
            </small>
          )}
        </label>

        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          {busy ? (signup ? 'Creating Account…' : 'Signing In…') : signup ? 'Create Account' : 'Sign In'}
        </button>

        {config?.demo ? (
          <>
            <div className="auth-or" role="separator">
              or
            </div>
            <button type="button" className="btn btn-secondary btn-lg btn-block" onClick={useDemo} disabled={busy}>
              Continue With Demo Account
            </button>
          </>
        ) : null}

        <p className="auth-switch muted">
          {signup ? 'Already have an account?' : 'New here?'} <Link to={other}>{signup ? 'Sign In' : 'Create an Account'}</Link>
        </p>
      </form>
    </div>
  );
}
