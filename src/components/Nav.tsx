import { Link, NavLink, useLocation } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { useStore } from '../lib/store';

/** The SightLine mark: the curved screen, the two sightlines to it, and your seat in Tungsten. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg className="logo-mark" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M8 15Q32 6 56 15" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path d="M12 22Q32 15.5 52 22L37.5 43H26.5Z" fill="currentColor" fillOpacity=".18" />
      <path d="M12.5 22.5 26.5 42M51.5 22.5 37.5 42" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeOpacity=".7" />
      <rect x="23.5" y="44" width="17" height="13" rx="4" fill="var(--accent)" />
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
          <Link to="/?section=halls">Our Halls</Link>
          <NavLink to="/help">Help</NavLink>
          {user ? (
            <>
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
