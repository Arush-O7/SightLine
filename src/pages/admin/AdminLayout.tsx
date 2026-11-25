import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '../../lib/store';

/** Cinema staff pages: only accounts with the admin role get past this. */
export default function AdminLayout() {
  const user = useStore((s) => s.user);
  const ready = useStore((s) => s.authReady);
  const config = useStore((s) => s.config);
  const { pathname } = useLocation();
  if (!ready) {
    return (
      <div className="route-loading" role="status">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  if (user.role !== 'admin') {
    return (
      <div className="container section admin-denied">
        <h1>Staff only</h1>
        <p className="muted">This part of SightLine is for cinema staff. Your account can book tickets but can’t manage the cinemas.</p>
      </div>
    );
  }
  return (
    <div className="container section admin">
      <header className="admin-head">
        <div>
          <h1>Cinema admin</h1>
          <p className="muted">Signed in as {user.name}. Changes here apply to the live site straight away.</p>
        </div>
        <nav className="admin-tabs" aria-label="Admin">
          <NavLink to="/admin" end>
            Overview
          </NavLink>
          <NavLink to="/admin/shows">Shows</NavLink>
          <NavLink to="/admin/titles">Titles</NavLink>
          <NavLink to="/admin/prices">Prices</NavLink>
          <NavLink to="/admin/bookings">Bookings</NavLink>
          <NavLink to="/admin/users">Customers</NavLink>
          <NavLink to="/admin/messages">Messages</NavLink>
        </nav>
      </header>
      {config?.inbox === 'reserved' && user.email === config.demoAdminEmail ? (
        <p className="admin-demo-note" role="note">
          You’re looking around as the demo admin. On the live site it can’t change anything, and it shows only demo customers, so real
          people’s details stay private.
        </p>
      ) : null}
      <Outlet />
    </div>
  );
}
