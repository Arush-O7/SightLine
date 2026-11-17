import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '../lib/store';

/** Pages behind an account. Sends signed-out visitors to sign in and brings them back afterwards. */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const user = useStore((s) => s.user);
  const ready = useStore((s) => s.authReady);
  const { pathname, search } = useLocation();
  if (!ready) {
    return (
      <div className="route-loading" role="status">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />;
  return <>{children}</>;
}
