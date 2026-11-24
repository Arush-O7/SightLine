import { useCallback, useEffect, useState } from 'react';
import { RATING_WORDS, topicLabel, type MessageStatus } from '../../data/contact';
import { api, type AdminMessage, type AdminRatings } from '../../lib/api';
import { TIME_ZONE } from '../../lib/time';
import { useTitle } from '../../lib/useTitle';

const FILTERS: { id: MessageStatus | 'all'; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'replied', label: 'Replied' },
  { id: 'closed', label: 'Closed' },
  { id: 'all', label: 'All' },
];

const STATUS_LABEL: Record<MessageStatus, string> = { new: 'New', replied: 'Replied', closed: 'Closed' };

const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: TIME_ZONE });

function Ratings({ ratings }: { ratings: AdminRatings | null }) {
  return (
    <section className="admin-panel admin-ratings" aria-labelledby="ratings-title">
      <div className="admin-panel-head">
        <h2 id="ratings-title">Seat-Choice Rating</h2>
        <span className="muted small">Asked on every ticket: how easy was choosing your seat?</span>
      </div>
      {!ratings ? (
        <p className="muted" role="status">
          Loading…
        </p>
      ) : ratings.count === 0 || ratings.average === null ? (
        <p className="muted">No ratings yet. They appear here once people rate choosing their seat on their ticket.</p>
      ) : (
        <>
          <div className="ratings-summary">
            <p className="ratings-average">
              <b>{ratings.average.toFixed(1)}</b>
              <span className="muted">
                out of 5, from {ratings.count} {ratings.count === 1 ? 'rating' : 'ratings'}
              </span>
            </p>
            <ol className="ratings-bars" aria-label="How many gave each rating">
              {[5, 4, 3, 2, 1].map((v) => {
                const n = ratings.distribution[v - 1];
                return (
                  <li key={v}>
                    <span>
                      {v} · {RATING_WORDS[v - 1]}
                    </span>
                    <i aria-hidden="true">
                      <i style={{ width: `${(n / ratings.count) * 100}%` }} />
                    </i>
                    <span className="num">{n}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          {ratings.comments.length ? (
            <ul className="ratings-comments">
              {ratings.comments.map((c) => (
                <li key={c.bookingId}>
                  <p>“{c.comment}”</p>
                  <span className="muted small">
                    {c.rating} out of 5 · {c.name} · {c.title} · {when(c.at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}

export default function AdminMessages() {
  useTitle('Admin · Messages');
  const [filter, setFilter] = useState<MessageStatus | 'all'>('new');
  const [data, setData] = useState<{ messages: AdminMessage[]; counts: Record<MessageStatus, number> } | null>(null);
  const [ratings, setRatings] = useState<AdminRatings | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api.admin.messages(filter).then(setData, (e: Error) => setError(e.message)), [filter]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    api.admin.ratings().then(setRatings, (e: Error) => setError(e.message));
  }, []);

  const move = async (m: AdminMessage, status: MessageStatus) => {
    setError('');
    try {
      await api.admin.setMessageStatus(m.id, status);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const total = data ? data.counts.new + data.counts.replied + data.counts.closed : 0;

  return (
    <div className="admin-messages">
      {error ? <p className="form-error">{error}</p> : null}
      <Ratings ratings={ratings} />

      <section className="admin-panel" aria-labelledby="messages-title">
        <div className="admin-panel-head">
          <h2 id="messages-title">Messages</h2>
          <div className="chips" role="group" aria-label="Show messages">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} className={`chip ${filter === f.id ? 'on' : ''}`} onClick={() => setFilter(f.id)}>
                {f.label}
                {data ? ` ${f.id === 'all' ? total : data.counts[f.id]}` : ''}
              </button>
            ))}
          </div>
        </div>
        {!data ? (
          <p className="muted" role="status">
            Loading…
          </p>
        ) : data.messages.length === 0 ? (
          <p className="muted">
            {filter === 'new'
              ? 'No new messages. Anything sent from the Contact page lands here first.'
              : `No ${filter === 'all' ? '' : `${STATUS_LABEL[filter].toLowerCase()} `}messages.`}
          </p>
        ) : (
          <ul className="admin-message-list">
            {data.messages.map((m) => (
              <li key={m.id} className="admin-message">
                <div className="admin-message-head">
                  <div>
                    <b>{m.name}</b>
                    <span className="muted small">
                      {m.email}
                      {m.fromAccount ? '' : ' · not signed in'}
                    </span>
                  </div>
                  <span className={`status-tag ${m.status === 'new' ? '' : 'is-ok'}`}>{STATUS_LABEL[m.status]}</span>
                </div>
                <p className="admin-message-meta muted small">
                  {topicLabel(m.topic)}
                  {m.bookingRef ? ` · Booking ${m.bookingRef}` : ''} · {m.id} · {when(m.createdAt)}
                </p>
                <p className="admin-message-body">{m.message}</p>
                <div className="admin-message-actions">
                  <a className="btn btn-secondary btn-sm" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: your message ${m.id}`)}`}>
                    Reply by Email
                  </a>
                  {m.status === 'new' ? (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => move(m, 'replied')}>
                      Mark Replied
                    </button>
                  ) : null}
                  {m.status !== 'closed' ? (
                    <button type="button" className="btn btn-text btn-sm" onClick={() => move(m, 'closed')}>
                      Close
                    </button>
                  ) : (
                    <button type="button" className="btn btn-text btn-sm" onClick={() => move(m, 'new')}>
                      Reopen
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
