import { useSearchParams } from 'react-router-dom';
import EventCard from '../components/EventCard';
import { EVENTS, EVENT_KINDS, KIND_LABEL, type Kind } from '../data/movies';
import { useTitle } from '../lib/useTitle';

export default function EventsPage() {
  useTitle('Live Shows');
  const [params, setParams] = useSearchParams();
  const raw = params.get('kind') as Kind | null;
  const kind = raw && EVENT_KINDS.includes(raw) ? raw : null;
  const list = EVENTS.filter((e) => !kind || e.kind === kind);
  return (
    <div className="container section events-page">
      <div className="section-head">
        <div>
          <h1>Live shows</h1>
          <p className="muted">Comedy, music, cricket and theatre in the same auditoriums, with the same 3D view from every seat.</p>
        </div>
        <div className="chips" role="group" aria-label="Filter by kind of show">
          {[null, ...EVENT_KINDS].map((k) => (
            <button
              key={k ?? 'all'}
              type="button"
              aria-pressed={kind === k}
              className={`chip ${kind === k ? 'on' : ''}`}
              onClick={() => setParams(k ? { kind: k } : {}, { replace: true })}
            >
              {k ? KIND_LABEL[k] : 'All'}
            </button>
          ))}
        </div>
      </div>
      <div className="event-grid">
        {list.map((e) => (
          <EventCard key={e.id} event={e} level={2} />
        ))}
      </div>
    </div>
  );
}
