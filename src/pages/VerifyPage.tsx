import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import { useStore } from '../lib/store';
import { useTitle } from '../lib/useTitle';

type State = { kind: 'working' } | { kind: 'done' } | { kind: 'failed'; message: string };

export default function VerifyPage() {
  useTitle('Confirm Email');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const user = useStore((s) => s.user);
  const [state, setState] = useState<State>(token ? { kind: 'working' } : { kind: 'failed', message: 'This link is incomplete. Open it from your email again.' });
  const sent = useRef(false);

  useEffect(() => {
    // the link is single-use, so it must be sent exactly once
    if (!token || sent.current) return;
    sent.current = true;
    api
      .verifyEmail(token)
      .then(async () => {
        setState({ kind: 'done' });
        const me = await api.me().catch(() => null);
        if (me) useStore.setState({ user: me });
      })
      .catch((err) => setState({ kind: 'failed', message: errorMessage(err) }));
  }, [token]);

  return (
    <div className="container auth">
      <div className="card auth-card" role={state.kind === 'failed' ? 'alert' : 'status'} aria-live="polite">
        {state.kind === 'working' ? (
          <>
            <h1>Confirming Your Email…</h1>
            <p className="muted">This takes a moment.</p>
          </>
        ) : state.kind === 'done' ? (
          <>
            <h1>Email Confirmed</h1>
            <p className="muted">Thanks. Your tickets and account emails will reach you here.</p>
            <Link to={user ? '/' : '/login'} className="btn btn-primary btn-lg btn-block">
              {user ? 'Find a Movie' : 'Sign In'}
            </Link>
          </>
        ) : (
          <>
            <h1>This Link Didn’t Work</h1>
            <p className="muted">{state.message}</p>
            <Link to={user ? '/account' : '/login'} className="btn btn-primary btn-lg btn-block">
              {user ? 'Send a New Link From Your Account' : 'Sign In'}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
