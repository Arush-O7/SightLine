import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage, inboxShows } from '../lib/api';
import { useStore } from '../lib/store';

/** A quiet reminder, under the nav, until the signed-in account's email is confirmed. */
export default function VerifyBanner() {
  const user = useStore((s) => s.user);
  const config = useStore((s) => s.config);
  const [hidden, setHidden] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user || user.emailVerified || hidden) return null;

  const resend = async () => {
    setBusy(true);
    try {
      const r = await api.resendVerification();
      if (r.alreadyVerified) {
        useStore.setState({ user: { ...user, emailVerified: true } });
        return;
      }
      setNote(inboxShows(config, user.email) ? 'Sent. It’s in the Demo Inbox.' : 'Sent. Check your inbox.');
    } catch (err) {
      setNote(errorMessage(err));
    }
    setBusy(false);
  };

  return (
    <div className="verify-banner" role="status">
      <p>
        Confirm your email: we sent a link to <strong>{user.email}</strong>.{' '}
        {note ? <span className="muted">{note}</span> : null}
      </p>
      <div className="verify-banner-actions">
        {inboxShows(config, user.email) ? (
          <Link to="/demo/inbox" className="btn btn-secondary btn-sm">
            Open Demo Inbox
          </Link>
        ) : null}
        <button type="button" className="btn btn-secondary btn-sm" onClick={resend} disabled={busy}>
          {busy ? 'Sending…' : 'Resend Link'}
        </button>
        <button type="button" className="btn btn-sm verify-banner-close" onClick={() => setHidden(true)}>
          Not Now
        </button>
      </div>
    </div>
  );
}
