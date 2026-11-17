import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useStore } from '../lib/store';
import { useTitle } from '../lib/useTitle';

export default function ResetPage() {
  useTitle('Choose a New Password');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const ok = password.length >= 8;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setFailure(null);
    if (!ok) return;
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      // the server has signed this account out everywhere, including this browser
      useStore.setState({ user: null, bookings: null });
      setDone(true);
    } catch (err) {
      setFailure(errorMessage(err));
    }
    setBusy(false);
  };

  if (!token) {
    return (
      <div className="container empty-state" role="alert">
        <h1>This Link Is Incomplete</h1>
        <p className="muted">Open the link from your reset email again, or request a new one.</p>
        <Link className="btn btn-primary" to="/forgot">
          Request a New Link
        </Link>
      </div>
    );
  }

  return (
    <div className="container auth">
      {done ? (
        <div className="card auth-card" role="status">
          <h1>Password Changed</h1>
          <p className="muted">You have been signed out on every device. Sign in with your new password.</p>
          <Link to="/login" className="btn btn-primary btn-lg btn-block">
            Sign In
          </Link>
        </div>
      ) : (
        <form className="card auth-card" onSubmit={submit} noValidate>
          <h1>Choose a New Password</h1>
          <p className="muted">It replaces your old password straight away.</p>
          {failure ? (
            <p className="form-error" role="alert">
              {failure} <Link to="/forgot">Request a new link</Link>
            </p>
          ) : null}
          <label className={`field ${touched && !ok ? 'bad' : ''}`}>
            <span>New password</span>
            <span className="field-wrap">
              <input
                name="new-password"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => password && setTouched(true)}
                autoComplete="new-password"
                aria-invalid={touched && !ok}
              />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
            {touched && !ok ? <em role="alert">Use at least 8 characters.</em> : <small>At least 8 characters.</small>}
          </label>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy ? 'Saving…' : 'Save New Password'}
          </button>
        </form>
      )}
    </div>
  );
}
