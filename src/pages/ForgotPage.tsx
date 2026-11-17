import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { useStore } from '../lib/store';
import { useTitle } from '../lib/useTitle';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ForgotPage() {
  useTitle('Reset Password');
  const config = useStore((s) => s.config);
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const ok = EMAIL.test(email.trim());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setFailure(null);
    if (!ok) return;
    setBusy(true);
    try {
      await api.forgot(email.trim());
      setSent(true);
    } catch (err) {
      setFailure(errorMessage(err));
    }
    setBusy(false);
  };

  return (
    <div className="container auth">
      {sent ? (
        <div className="card auth-card" role="status">
          <h1>Check Your Email</h1>
          <p className="muted">
            If <b className="strong">{email.trim()}</b> has an account, a link to choose a new password is on its way. It works once and
            expires in 30 minutes.
          </p>
          {config?.demo ? (
            <Link to="/demo/inbox" className="btn btn-primary btn-lg btn-block">
              Open the Demo Inbox
            </Link>
          ) : null}
          <p className="auth-switch muted">
            <Link to="/login">Back to Sign In</Link>
          </p>
        </div>
      ) : (
        <form className="card auth-card" onSubmit={submit} noValidate>
          <h1>Reset Your Password</h1>
          <p className="muted">Enter your account email and we’ll send you a link to choose a new password.</p>
          {failure ? (
            <p className="form-error" role="alert">
              {failure}
            </p>
          ) : null}
          <label className={`field ${touched && !ok ? 'bad' : ''}`}>
            <span>Email</span>
            <input
              name="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
                onBlur={() => email && setTouched(true)}
              autoComplete="email"
              spellCheck={false}
              placeholder="alex@example.com…"
              aria-invalid={touched && !ok}
            />
            {touched && !ok ? <em role="alert">Enter an email like name@example.com.</em> : null}
          </label>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? 'Sending…' : 'Send Reset Link'}
          </button>
          <p className="auth-switch muted">
            Remembered it? <Link to="/login">Sign In</Link>
          </p>
        </form>
      )}
    </div>
  );
}
