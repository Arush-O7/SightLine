import { Link } from 'react-router-dom';
import { useTitle } from '../lib/useTitle';

export default function NotFound({ title = 'This Page Has Left the Building' }: { title?: string }) {
  useTitle('Not Found');
  return (
    <div className="container empty-state">
      <h1>{title}</h1>
      <p className="muted">The link may be out of date, or the showtime has passed.</p>
      <div className="empty-actions">
        <Link className="btn btn-primary" to="/">
          Browse Movies
        </Link>
        <Link className="btn btn-secondary" to="/help">
          Get Help
        </Link>
      </div>
    </div>
  );
}
