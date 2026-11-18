import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type AdminOverview as Overview } from '../../lib/api';
import { formatDate, formatTime, money, parseDateKey } from '../../data/movies';
import { useTitle } from '../../lib/useTitle';

function RevenueChart({ daily }: { daily: Overview['daily'] }) {
  const max = Math.max(1, ...daily.map((d) => d.revenue));
  const [hover, setHover] = useState<number | null>(null);
  const label = (key: string) => parseDateKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return (
    <figure className="admin-chart">
      <figcaption>
        <h2>Sales, last 14 days</h2>
        <p className="muted small">Ticket value booked each day, paid and pay-at-cinema.</p>
      </figcaption>
      <div className="admin-bars" onMouseLeave={() => setHover(null)} aria-hidden="true">
        {daily.map((d, i) => (
          <div key={d.date} className={`admin-bar ${hover === i ? 'on' : ''}`} onMouseEnter={() => setHover(i)}>
            <i style={{ height: `${Math.max(d.revenue ? 2 : 0, (d.revenue / max) * 100)}%` }} />
            {hover === i ? (
              <span className="admin-tip" style={{ left: `${((i + 0.5) / daily.length) * 100}%` }}>
                <b>{label(d.date)}</b>
                {money(d.revenue)} · {d.tickets} tickets
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="admin-axis" aria-hidden="true">
        <span>{label(daily[0].date)}</span>
        <span>Today</span>
      </div>
      <table className="sr-only">
        <caption>Sales per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Sales</th>
            <th scope="col">Tickets</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.date}>
              <th scope="row">{label(d.date)}</th>
              <td>{money(d.revenue)}</td>
              <td>{d.tickets}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Ranking({ title, rows }: { title: string; rows: Overview['byTitle'] }) {
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <section className="admin-panel">
      <h2>{title}</h2>
      {rows.length ? (
        <ol className="admin-rank">
          {rows.map((r) => (
            <li key={r.key}>
              <div>
                <span>{r.key}</span>
                <span className="muted">
                  {money(r.revenue)} · {r.tickets} tickets
                </span>
              </div>
              <i style={{ width: `${(r.revenue / max) * 100}%` }} aria-hidden="true" />
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted small">No sales yet.</p>
      )}
    </section>
  );
}

export default function AdminOverview() {
  useTitle('Admin');
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.admin.overview().then(setData, (e: Error) => setError(e.message));
  }, []);
  if (error) return <p className="form-error">{error}</p>;
  if (!data) return <p className="muted" role="status">Loading…</p>;
  const t = data.totals;
  const tiles: [string, string][] = [
    ['Paid', money(t.revenue)],
    ['Due at the cinema', money(t.due)],
    ['Tickets sold', String(t.tickets)],
    ['Upcoming bookings', String(t.upcoming)],
    [t.refunds === 1 ? '1 refund' : `${t.refunds} refunds`, money(t.refunded)],
    ['Accounts', String(t.users)],
  ];
  return (
    <div className="admin-overview">
      <dl className="admin-tiles">
        {tiles.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <RevenueChart daily={data.daily} />
      <div className="admin-two">
        <Ranking title="Top titles" rows={data.byTitle} />
        <Ranking title="By cinema" rows={data.byCinema} />
      </div>
      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Latest bookings</h2>
          <Link to="/admin/bookings" className="btn btn-secondary btn-sm">
            All Bookings
          </Link>
        </div>
        <ul className="admin-list">
          {data.recent.map((b) => (
            <li key={b.id}>
              <div>
                <b>{b.title}</b>
                <span className="muted small">
                  {b.customer.name} · {b.seats} {b.seats === 1 ? 'seat' : 'seats'} · {b.cinema}
                  {b.start ? ` · ${formatDate(new Date(b.start))}, ${formatTime(new Date(b.start))}` : ''}
                </span>
              </div>
              <span className="admin-amount">{money(b.total)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
