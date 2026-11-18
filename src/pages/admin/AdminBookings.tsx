import { useEffect, useState } from 'react';
import { api, type AdminBooking } from '../../lib/api';
import { formatDate, formatTime, money } from '../../data/movies';
import { useTitle } from '../../lib/useTitle';

const WHEN = [
  ['upcoming', 'Upcoming'],
  ['past', 'Past'],
  ['all', 'All'],
] as const;

export default function AdminBookings() {
  useTitle('Admin · Bookings');
  const [when, setWhen] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<AdminBooking[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    api.admin.bookings(when, q).then(setRows, (e: Error) => setError(e.message));
  };
  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when, q]);

  const cancel = async (b: AdminBooking) => {
    setError('');
    try {
      const r = await api.admin.cancelBooking(b.id);
      setMessage(`Booking ${b.id} cancelled${r.refunded ? ` and ${money(b.total)} refunded` : ''}. ${b.customer.name} has been emailed.`);
      setConfirm(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section className="admin-panel">
      <div className="admin-toolbar">
        <div className="chips" role="group" aria-label="Which bookings">
          {WHEN.map(([k, label]) => (
            <button key={k} type="button" className={`chip ${when === k ? 'on' : ''}`} aria-pressed={when === k} onClick={() => setWhen(k)}>
              {label}
            </button>
          ))}
        </div>
        <label className="search">
          <span className="sr-only">Search bookings</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Reference, customer, title or cinema…" autoComplete="off" />
        </label>
      </div>
      {message ? (
        <p className="form-ok" role="status">
          {message}
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      {!rows ? (
        <p className="muted" role="status">
          Loading…
        </p>
      ) : rows.length ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Booking</th>
                <th scope="col">Customer</th>
                <th scope="col">Show</th>
                <th scope="col">When</th>
                <th scope="col" className="num">
                  Seats
                </th>
                <th scope="col" className="num">
                  Total
                </th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const upcoming = (b.start ?? 0) > Date.now();
                return (
                  <tr key={b.id}>
                    <td className="mono">{b.id}</td>
                    <td>
                      {b.customer.name}
                      <span className="sub">{b.customer.email}</span>
                    </td>
                    <td>
                      {b.title}
                      <span className="sub">
                        {b.cinema} · {b.screen}
                      </span>
                    </td>
                    <td className="nowrap">{b.start ? `${formatDate(new Date(b.start))}, ${formatTime(new Date(b.start))}` : '—'}</td>
                    <td className="num">{b.seats}</td>
                    <td className="num">
                      {money(b.total)}
                      <span className="sub">{b.paymentStatus === 'due' ? 'Due' : 'Paid'}</span>
                    </td>
                    <td className="actions">
                      {upcoming ? (
                        confirm === b.id ? (
                          <span className="confirm">
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => cancel(b)}>
                              Cancel and Refund
                            </button>
                            <button type="button" className="btn btn-text btn-sm" onClick={() => setConfirm(null)}>
                              Keep
                            </button>
                          </span>
                        ) : (
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirm(b.id)}>
                            Cancel
                          </button>
                        )
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No bookings match.</p>
      )}
    </section>
  );
}
