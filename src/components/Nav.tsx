import { Link, NavLink, useLocation } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { useStore } from '../lib/store';

/**
 * The SightLine mark: a curved cinema screen seen in perspective, the way it looks from one
 * particular seat, with that seat in Tungsten beneath the screen's near edge.
 */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg className="logo-mark" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M8 17C24 13 40 10 56 8V40C40 38 24 36 8 33Z" fill="currentColor" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <path d="M34 48a5 5 0 0 1 5-5h10a5 5 0 0 1 5 5v8H34Z" fill="var(--accent)" />
      <rect x="30" y="52" width="28" height="10" rx="4.5" fill="var(--accent)" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo" translate="no">
      <LogoMark />
      <span className="logo-word">SightLine</span>
    </span>
  );
}

export default function Nav() {
  const user = useStore((s) => s.user);
  const ready = useStore((s) => s.authReady);
  const count = useStore((s) => s.bookings?.length ?? 0);
  const { pathname, search } = useLocation();
  const onAuthPage = pathname === '/login' || pathname === '/signup';
  const next = onAuthPage ? '' : `?next=${encodeURIComponent(pathname + search)}`;

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" aria-label="SightLine home">
          <Logo />
        </Link>
        <nav className="nav-links" aria-label="Main">
          <NavLink to="/" end>
            Movies
          </NavLink>
          <NavLink to="/events">Live Shows</NavLink>
          <NavLink to="/cinemas">Cinemas</NavLink>
          <NavLink to="/help">Help</NavLink>
          {user ? (
            <>
              {user.role === 'admin' ? (
                <NavLink to="/admin" className="nav-admin">
                  Admin
                </NavLink>
              ) : null}
              <NavLink to="/bookings" className="nav-tickets">
                <Ticket size={16} />
                <span>My Tickets</span>
                {count > 0 ? <b>{count}</b> : null}
              </NavLink>
              <NavLink to="/account" className="nav-avatar" aria-label={`Account: ${user.name}`} title={user.name}>
                {user.name.trim().charAt(0).toUpperCase()}
              </NavLink>
            </>
          ) : ready ? (
            <Link to={`/login${next}`} className="nav-tickets">
              Sign In
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
