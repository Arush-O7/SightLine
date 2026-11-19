import { useEffect, useState } from 'react';
import { api, type AdminUser } from '../../lib/api';
import { money } from '../../data/movies';
import { useStore } from '../../lib/store';
import { TIME_ZONE } from '../../lib/time';
import { useTitle } from '../../lib/useTitle';

export default function AdminUsers() {
  useTitle('Admin · Customers');
  const me = useStore((s) => s.user);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState('');
  const load = () => api.admin.users().then(setUsers, (e: Error) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);

  const setRole = async (u: AdminUser, role: 'user' | 'admin') => {
    setError('');
    try {
      await api.admin.setRole(u.id, role);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section className="admin-panel">
      {error ? <p className="form-error">{error}</p> : null}
      {!users ? (
        <p className="muted" role="status">
          Loading…
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Joined</th>
                <th scope="col" className="num">
                  Bookings
                </th>
                <th scope="col" className="num">
                  Spent
                </th>
                <th scope="col">Role</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name}
                    <span className="sub">
                      {u.email}
                      {u.emailVerified ? '' : ' · not confirmed'}
                    </span>
                  </td>
                  <td className="nowrap">{new Date(u.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE })}</td>
                  <td className="num">{u.bookings}</td>
                  <td className="num">{money(u.spent)}</td>
                  <td>
                    <span className={`status-tag ${u.role === 'admin' ? 'is-ok' : ''}`}>{u.role === 'admin' ? 'Admin' : 'Customer'}</span>
                  </td>
                  <td className="actions">
                    {u.id === me?.id ? (
                      <span className="muted small">You</span>
                    ) : u.role === 'admin' ? (
                      <button type="button" className="btn btn-text btn-sm" onClick={() => setRole(u, 'user')}>
                        Remove Admin
                      </button>
                    ) : (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRole(u, 'admin')}>
                        Make Admin
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
