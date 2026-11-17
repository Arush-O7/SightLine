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
            See it before you seat it. Every hall is modelled to scale, so the view you preview is the view you get.
          </p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <div>
            <h2>Watch</h2>
            <Link to="/">Movies</Link>
            <Link to="/?section=halls">Our Halls</Link>
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
          Demo product. Films, people and showtimes are fictional, artwork is generated in your browser, and payments run in test mode, so no money moves.
        </p>
      </div>
    </footer>
  );
}
