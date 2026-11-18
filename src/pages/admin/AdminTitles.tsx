import { useEffect, useState, type FormEvent } from 'react';
import { KIND_LABEL, type Kind } from '../../data/movies';
import { api, type AdminTitle } from '../../lib/api';
import { loadCatalog } from '../../lib/catalog';
import { useTitle } from '../../lib/useTitle';

const EMPTY = { kind: 'movie', title: '', tagline: '', genres: '', runtime: '120', language: '', cert: '', director: '', cast: '', synopsis: '', image: '' };

export default function AdminTitles() {
  useTitle('Admin · Titles');
  const [titles, setTitles] = useState<AdminTitle[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api.admin.titles().then(setTitles, (e: Error) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  const live = form.kind !== 'movie';

  const run = async (work: () => Promise<string>) => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      setMessage(await work());
      await Promise.all([load(), loadCatalog().catch(() => {})]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const t = await api.admin.addTitle({ ...form, runtime: Number(form.runtime) });
      setForm(EMPTY);
      return `${t.title} is added. Give it showtimes from the Shows tab.`;
    });
  };
  const remove = (t: AdminTitle) =>
    run(async () => {
      await api.admin.removeTitle(t.id);
      setConfirm(null);
      return `${t.title} is removed, with any shows you had scheduled for it.`;
    });

  return (
    <div className="admin-shows">
      {message ? (
        <p className="form-ok" role="status">
          {message}
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}

      <form className="admin-panel admin-title-form" onSubmit={add}>
        <h2>Add a movie or live show</h2>
        <div className="admin-form-grid">
          <label className="field-inline">
            <span>Type</span>
            <select value={form.kind} onChange={set('kind')}>
              {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
                <option key={k} value={k}>
                  {k === 'movie' ? 'Movie' : `Live show: ${KIND_LABEL[k]}`}
                </option>
              ))}
            </select>
          </label>
          <label className="field-inline wide">
            <span>Title</span>
            <input value={form.title} onChange={set('title')} required maxLength={80} />
          </label>
          <label className="field-inline wide">
            <span>Tagline</span>
            <input value={form.tagline} onChange={set('tagline')} maxLength={80} />
          </label>
          <label className="field-inline">
            <span>Genres, comma-separated</span>
            <input value={form.genres} onChange={set('genres')} required placeholder={live ? 'Stand-up' : 'Drama, Thriller'} />
          </label>
          <label className="field-inline">
            <span>Running time (minutes)</span>
            <input type="number" min={30} max={300} value={form.runtime} onChange={set('runtime')} required />
          </label>
          <label className="field-inline">
            <span>Language</span>
            <input value={form.language} onChange={set('language')} required placeholder="Hindi" />
          </label>
          <label className="field-inline">
            <span>Certificate</span>
            <input value={form.cert} onChange={set('cert')} maxLength={8} placeholder="UA 13+" />
          </label>
          {live ? null : (
            <label className="field-inline">
              <span>Director</span>
              <input value={form.director} onChange={set('director')} maxLength={60} />
            </label>
          )}
          <label className="field-inline wide">
            <span>{live ? 'Line-up' : 'Cast'}, comma-separated</span>
            <input value={form.cast} onChange={set('cast')} />
          </label>
          <label className="field-inline full">
            <span>Summary</span>
            <textarea value={form.synopsis} onChange={set('synopsis')} required minLength={20} maxLength={400} rows={3} />
          </label>
          <label className="field-inline full">
            <span>{live ? 'Photo' : 'Poster'} link (optional, from upload.wikimedia.org or image.tmdb.org)</span>
            <input type="url" value={form.image} onChange={set('image')} placeholder="https://upload.wikimedia.org/…" />
          </label>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Add Title
        </button>
      </form>

      <section className="admin-panel">
        <h2>All titles</h2>
        {!titles ? (
          <p className="muted" role="status">
            Loading…
          </p>
        ) : (
          <ul className="admin-list">
            {titles.map((t) => (
              <li key={t.id}>
                <div>
                  <b>{t.title}</b>
                  <span className="muted small">
                    {KIND_LABEL[t.kind as Kind]} · {t.language} · {t.runtime} min
                  </span>
                </div>
                <span className="admin-tags">{t.custom ? <span className="status-tag is-ok">Added by staff</span> : null}</span>
                <span className="actions">
                  {t.custom ? (
                    confirm === t.id ? (
                      <span className="confirm">
                        <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => remove(t)}>
                          Remove Title
                        </button>
                        <button type="button" className="btn btn-text btn-sm" onClick={() => setConfirm(null)}>
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirm(t.id)}>
                        Remove
                      </button>
                    )
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
