import { useEffect, useState } from 'react';
import { money } from '../../data/movies';
import { api, type AdminHallPrices } from '../../lib/api';
import { loadCatalog } from '../../lib/catalog';
import { useTitle } from '../../lib/useTitle';

export default function AdminPrices() {
  useTitle('Admin · Prices');
  const [halls, setHalls] = useState<AdminHallPrices[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const key = (hallId: string, zoneId: string) => `${hallId}|${zoneId}`;

  const load = () =>
    api.admin.prices().then((h) => {
      setHalls(h);
      setDraft(Object.fromEntries(h.flatMap((x) => x.zones.map((z) => [key(x.hallId, z.id), String(z.price)]))));
    }, (e: Error) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);

  const save = async (hall: AdminHallPrices, reset = false) => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await api.admin.savePrices(
        hall.zones.map((z) => ({ hallId: hall.hallId, zoneId: z.id, price: reset ? z.defaultPrice : Number(draft[key(hall.hallId, z.id)]) })),
      );
      await Promise.all([load(), loadCatalog().catch(() => {})]);
      setMessage(`${hall.format} prices ${reset ? 'are back to the defaults' : 'are saved'}. New bookings use them; existing tickets keep what was paid.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-shows">
      <p className="muted">Prices apply to every auditorium of that type, in every cinema. The booking fee is added on top.</p>
      {message ? (
        <p className="form-ok" role="status">
          {message}
        </p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      {!halls ? (
        <p className="muted" role="status">
          Loading…
        </p>
      ) : (
        <div className="admin-price-grid">
          {halls.map((h) => (
            <form
              key={h.hallId}
              className="admin-panel"
              onSubmit={(e) => {
                e.preventDefault();
                void save(h);
              }}
            >
              <h2>{h.format}</h2>
              <div className="admin-price-zones">
                {h.zones.map((z) => (
                  <label key={z.id} className="field-inline">
                    <span>
                      {z.name} <span className="muted">· default {money(z.defaultPrice)}</span>
                    </span>
                    <span className="price-input">
                      <span aria-hidden="true">₹</span>
                      <input
                        type="number"
                        min={50}
                        max={5000}
                        step={10}
                        value={draft[key(h.hallId, z.id)] ?? ''}
                        onChange={(e) => setDraft({ ...draft, [key(h.hallId, z.id)]: e.target.value })}
                        required
                      />
                    </span>
                  </label>
                ))}
              </div>
              <div className="admin-price-actions">
                <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                  Save Prices
                </button>
                <button type="button" className="btn btn-text btn-sm" disabled={busy} onClick={() => save(h, true)}>
                  Reset to Defaults
                </button>
              </div>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
