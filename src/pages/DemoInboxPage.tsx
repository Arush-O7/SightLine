import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, RefreshCw } from 'lucide-react';
import NotFound from './NotFound';
import { api, errorMessage, type DemoEmail } from '../lib/api';
import { useStore } from '../lib/store';
import { useTitle } from '../lib/useTitle';
import { LinesSkeleton } from '../components/Skeleton';

const KINDS: Record<string, string> = {
  verify: 'Email confirmation',
  welcome: 'Welcome',
  ticket: 'Ticket',
  reset: 'Password reset',
  cancelled: 'Cancellation',
  deleted: 'Account deleted',
};
const when = (t: number) => new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Presenter's tool: shows every email the site has sent, so ticket and reset emails
 * can be demonstrated without a mail account. Only exists when demo mode is on.
 */
export default function DemoInboxPage() {
  useTitle('Demo Inbox');
  const config = useStore((s) => s.config);
  const navigate = useNavigate();
  const [emails, setEmails] = useState<DemoEmail[] | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.outbox();
      setEmails(list);
      setOpenId((cur) => (cur !== null && list.some((e) => e.id === cur) ? cur : (list[0]?.id ?? null)));
      setFailure(null);
    } catch (err) {
      setFailure(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => !document.hidden && void load(), 5000);
    return () => window.clearInterval(t);
  }, [load]);

  if (config && !config.demo) return <NotFound />;

  const open = emails?.find((e) => e.id === openId) ?? null;

  const reset = async () => {
    setBusy(true);
    try {
      await api.resetDemo();
      useStore.setState({ user: null, bookings: null, selections: {}, snapshots: {} });
      navigate('/', { replace: true });
    } catch (err) {
      setFailure(errorMessage(err));
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className="container section inbox">
      <div className="section-head">
        <div>
          <h1>Demo Inbox</h1>
          <p className="muted">
            {config?.inbox === 'reserved' ? (
              <>
                Emails sent to example.com and .test addresses land here, so you can try sign-up, tickets and password resets without a real
                inbox. Emails to real addresses are never shown.
              </>
            ) : (
              <>
                Every email the site sends lands here, for any address.{' '}
                {config?.realEmail ? 'Real sending is also switched on.' : 'Real sending is off, so nothing leaves this machine.'}
              </>
            )}
          </p>
        </div>
        <div className="inbox-tools">
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            <RefreshCw size={15} /> Refresh
          </button>
          {config?.inbox === 'reserved' ? null : confirming ? (
            <>
              <button type="button" className="btn btn-danger" onClick={reset} disabled={busy}>
                {busy ? 'Resetting…' : 'Erase Everything and Reset'}
              </button>
              <button type="button" className="btn btn-text" onClick={() => setConfirming(false)}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-text" onClick={() => setConfirming(true)}>
              Reset Demo Data
            </button>
          )}
        </div>
      </div>

      {failure ? (
        <p className="form-error" role="alert">
          {failure}
        </p>
      ) : null}

      {emails === null && !failure ? (
        <LinesSkeleton lines={4} label="Loading emails…" />
      ) : null}

      {emails && !emails.length ? (
        <div className="no-results" role="status">
          <Mail size={28} />
          <p>No emails yet. Create an account, book a ticket or ask for a password reset, and the email appears here.</p>
        </div>
      ) : null}

      {emails?.length ? (
        <div className="inbox-grid">
          <ul className="inbox-list" aria-label="Emails">
            {emails.map((e) => (
              <li key={e.id}>
                <button type="button" className={e.id === openId ? 'on' : ''} aria-current={e.id === openId} onClick={() => setOpenId(e.id)}>
                  <span className="inbox-kind">{KINDS[e.kind] ?? e.kind}</span>
                  <b>{e.subject}</b>
                  <span className="muted small">
                    To {e.to} · {when(e.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {open ? (
            // treat the email as untrusted HTML: the sandbox blocks scripts and forms. allow-same-origin keeps it
            // rendering in-page (safe without allow-scripts), and allow-popups lets its links open in a new tab
            <iframe
              className="inbox-view"
              title={open.subject}
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              srcDoc={open.html.replace('<body', '<base target="_blank"><body')}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
