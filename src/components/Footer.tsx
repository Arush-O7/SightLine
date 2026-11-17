import { Link } from 'react-router-dom';
import { Logo } from './Nav';
import { useStore } from '../lib/store';

export default function Footer() {
  const user = useStore((s) => s.user);
  const demo = useStore((s) => s.config?.demo);
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <Logo />
          <p className="muted footer-note">
            Cinema tickets for Delhi, with a 3D view from every seat before you book.
          </p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <div>
            <h2>Watch</h2>
            <Link to="/">Movies</Link>
            <Link to="/cinemas">Cinemas</Link>
          </div>
          <div>
            <h2>Account</h2>
            {user ? (
              <>
                <Link to="/bookings">My Tickets</Link>
                <Link to="/account">Account</Link>
              </>
            ) : (
              <>
                <Link to="/login">Sign In</Link>
                <Link to="/signup">Create Account</Link>
              </>
            )}
          </div>
          <div>
            <h2>Support</h2>
            <Link to="/help">Help &amp; FAQ</Link>
            <Link to="/help#terms">Terms</Link>
            <Link to="/help#privacy">Privacy</Link>
            {demo ? <Link to="/demo/inbox">Demo Inbox</Link> : null}
          </div>
        </nav>
      </div>
      <div className="container footer-base">
        <p className="muted small">
          Demo product, not affiliated with any cinema or chain named here. Showtimes, prices and seat layouts are illustrative, and
          payments run in test mode, so no money moves.
        </p>
        <p className="muted small">
          Movie details from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </div>
    </footer>
  );
}
