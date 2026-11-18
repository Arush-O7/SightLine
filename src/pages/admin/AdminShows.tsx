import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CINEMAS } from '../../data/cinemas';
import { EVENTS, KIND_LABEL, MOVIES, setScheduleChanges, upcomingDays, type Kind } from '../../data/movies';
import { api, type AdminScreenDay, type AdminShow } from '../../lib/api';
import { useTitle } from '../../lib/useTitle';

export default function AdminShows() {
  useTitle('Admin · Shows');
  const days = useMemo(() => upcomingDays(14), []);
  const [cinemaId, setCinemaId] = useState(CINEMAS[0].id);
  const [date, setDate] = useState(days[0].key);
  const [screens, setScreens] = useState<AdminScreenDay[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const cinema = CINEMAS.find((c) => c.id === cinemaId)!;
  const [form, setForm] = useState({ movieId: EVENTS[0].id, screenId: cinema.screens[0].id, time: '19:00' });
  const [busy, setBusy] = useState(false);

  const load = () => api.admin.shows(cinemaId, date).then((r) => setScreens(r.screens), (e: Error) => setError(e.message));
  // the rest of the site lists shows from the same changes, so pull them in after every edit
  const refreshSite = () => api.schedule().then(setScheduleChanges).catch(() => {});

  useEffect(() => {
    setScreens(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cinemaId, date]);
  useEffect(() => setForm((f) => ({ ...f, screenId: cinema.screens[0].id })), [cinema]);

  const act = async (work: () => Promise<string>) => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      setMessage(await work());
      setConfirm(null);
      await Promise.all([load(), refreshSite()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = (s: AdminShow) =>
    act(async () => {
      const r = await api.admin.cancelShow(s.id);
      return `${s.title} at ${s.time} is cancelled.${r.cancelledBookings ? ` ${r.cancelledBookings} booking${r.cancelledBookings === 1 ? ' was' : 's were'} cancelled and refunded, and the customers emailed.` : ''}`;
    });
  const restore = (s: AdminShow) =>
    act(async () => {
      await api.admin.restoreShow(s.id);
      return `${s.title} at ${s.time} is back on sale.`;
    });
  const add = (e: FormEvent) => {
    e.preventDefault();
    void act(async () => {
      await api.admin.addShow({ ...form, cinemaId, date });
      const title = [...MOVIES, ...EVENTS].find((m) => m.id === form.movieId)!.title;
      return `${title} added at ${form.time}. It’s on sale now.`;
    });
  };

  return (
    <div className="admin-shows">
      <div className="admin-toolbar">
        <label className="field-inline">
          <span>Cinema</span>
          <select value={cinemaId} onChange={(e) => setCinemaId(e.target.value)}>
            {CINEMAS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-inline">
          <span>Day</span>
          <select value={date} onChange={(e) => setDate(e.target.value)}>
            {days.map((d) => (
              <option key={d.key} value={d.key}>
                {d.isToday ? 'Today' : d.weekday}, {d.dayNum} {d.month}
              </option>
            ))}
          </select>
        </label>
      </div>

      {message ? (
        <p className="form-ok" role="status">
          {message}
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}

      <form className="admin-panel admin-add" onSubmit={add}>
        <h2>Add a show</h2>
        <div className="admin-add-fields">
          <label className="field-inline">
            <span>Title</span>
            <select value={form.movieId} onChange={(e) => setForm({ ...form, movieId: e.target.value })}>
              <optgroup label="Live shows">
                {EVENTS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({KIND_LABEL[m.kind as Kind]})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Movies">
                {MOVIES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="field-inline">
            <span>Auditorium</span>
            <select value={form.screenId} onChange={(e) => setForm({ ...form, screenId: e.target.value })}>
              {cinema.screens.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-inline">
            <span>Starts at</span>
            <input type="time" value={form.time} step={300} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Add Show
          </button>
        </div>
      </form>

      {!screens ? (
        <p className="muted" role="status">
          Loading…
        </p>
      ) : (
        screens.map((screen) => (
          <section key={screen.id} className="admin-panel">
            <div className="admin-panel-head">
              <h2>
                {screen.name} <span className="muted small">· {screen.format}, {screen.capacity} seats</span>
              </h2>
            </div>
            <ul className="admin-list">
              {screen.shows.map((s) => (
                <li key={s.id} className={s.cancelled ? 'is-cancelled' : ''}>
                  <span className="admin-time">{s.time}</span>
                  <div>
                    <b>{s.title}</b>
                    <span className="muted small">
                      {KIND_LABEL[s.kind as Kind]} · {s.sold} of {screen.capacity} sold
                    </span>
                  </div>
                  <span className="admin-tags">
                    {s.added ? <span className="status-tag is-ok">Added</span> : null}
                    {s.cancelled ? <span className="status-tag">Cancelled</span> : null}
                    {s.started && !s.cancelled ? <span className="status-tag">Started</span> : null}
                  </span>
                  <span className="actions">
                    {s.cancelled ? (
                      s.started ? null : (
                        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => restore(s)}>
                          Restore
                        </button>
                      )
                    ) : s.started ? null : confirm === s.id ? (
                      <span className="confirm">
                        <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => cancel(s)}>
                          {s.sold ? `Cancel and Refund ${s.sold}` : 'Cancel Show'}
                        </button>
                        <button type="button" className="btn btn-text btn-sm" onClick={() => setConfirm(null)}>
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirm(s.id)}>
                        Cancel
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
