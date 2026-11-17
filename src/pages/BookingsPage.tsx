import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Trash2 } from 'lucide-react';
import { Poster } from '../components/Art';
import { formatDate, formatTime, getMovie, money, parseShow, venueOf } from '../data/movies';
import { getHall } from '../lib/hall';
import { api, errorMessage } from '../lib/api';
import { sortSeatIds, useStore } from '../lib/store';
import { useTitle } from '../lib/useTitle';
import { BookingListSkeleton } from '../components/Skeleton';

export default function BookingsPage() {
  useTitle('My Tickets');
  const bookings = useStore((s) => s.bookings);
  const loadBookings = useStore((s) => s.loadBookings);
  const removeBooking = useStore((s) => s.removeBooking);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  if (bookings === null) {
    return (
      <div className="container section bookings">
        <div className="section-head">
          <div>
            <h1>My Tickets</h1>
            <p className="muted">Every booking on your account. Cancel any time before the show starts.</p>
          </div>
        </div>
        <div className="booking-group">
          <BookingListSkeleton />
        </div>
      </div>
    );
  }

  if (!bookings.length) {
    return (
      <div className="container empty-state">
        <Ticket size={40} />
        <h1>No Tickets Yet</h1>
        <p className="muted">{notice ?? 'When you book a film, your tickets are saved to your account and appear here.'}</p>
        <Link className="btn btn-primary" to="/">
          Browse Movies
        </Link>
      </div>
    );
  }

  const cancel = async (id: string) => {
    setBusy(id);
    setFailure(null);
    try {
      const total = bookings?.find((b) => b.id === id)?.total ?? 0;
      const { refunded } = await api.cancelBooking(id);
      removeBooking(id);
      setNotice(refunded ? `Booking cancelled. A refund of ${money(total)} has been started (test mode: no money moved).` : 'Booking cancelled. Nothing was due.');
    } catch (err) {
      setFailure(errorMessage(err));
    }
    setBusy(null);
    setConfirming(null);
  };

  const now = Date.now();
  const startOf = (showId: string) => parseShow(showId)?.start.getTime() ?? 0;
  // upcoming: soonest first; past: most recent first
  const upcoming = bookings.filter((b) => startOf(b.showId) >= now).sort((a, b) => startOf(a.showId) - startOf(b.showId));
  const past = bookings.filter((b) => startOf(b.showId) < now).sort((a, b) => startOf(b.showId) - startOf(a.showId));

  /** "Today", "Tomorrow", "In 3 days" */
  const when = (start: Date) => {
    const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((day(start) - day(new Date())) / 86_400_000);
    return days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
  };

  const item = (b: (typeof bookings)[number]) => {
    const movie = getMovie(b.movieId);
    const show = parseShow(b.showId);
    if (!movie || !show) return null;
    const hall = getHall(b.hallId);
    const started = show.start.getTime() < now;
    return (
      <li key={b.id} className={`card booking-item ${started ? 'past' : ''}`}>
        <Poster movie={movie} />
        <div className="booking-item-info">
          <div className="booking-item-title">
            <h3>{movie.title}</h3>
            {started ? null : <span className="status-tag">{when(show.start)}</span>}
          </div>
          <p className="muted small">
            {formatDate(show.start)} · {formatTime(show.start)} · {venueOf(show)?.cinema.name} · {venueOf(show)?.screen.name}, {hall.format}
          </p>
          <p className="booking-item-seats">
            {sortSeatIds(b.seats).map((s) => (
              <span key={s}>{s}</span>
            ))}
          </p>
          <p className="muted small">
            {b.id} · {money(b.total)} {b.paymentStatus === 'due' ? 'to pay at the cinema' : 'paid'}
          </p>
        </div>
        <div className="booking-item-actions">
          <Link className="btn btn-secondary" to={`/ticket/${b.id}`}>
            View Ticket
          </Link>
          {started ? null : confirming === b.id ? (
            <span className="confirm">
              <button type="button" className="btn btn-danger" disabled={busy === b.id} onClick={() => cancel(b.id)}>
                {busy === b.id ? 'Cancelling…' : 'Cancel Booking'}
              </button>
              <button type="button" className="btn btn-text" onClick={() => setConfirming(null)}>
                Keep
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-text" onClick={() => setConfirming(b.id)} aria-label={`Cancel booking ${b.id}`}>
              <Trash2 size={14} /> Cancel
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="container section bookings">
      <div className="section-head">
        <div>
          <h1>My Tickets</h1>
          <p className="muted">Every booking on your account. Cancel any time before the show starts.</p>
        </div>
      </div>
      {failure ? (
        <p className="form-error" role="alert">
          {failure}
        </p>
      ) : null}
      {notice ? (
        <p className="form-ok" role="status">
          {notice}
        </p>
      ) : null}
      {upcoming.length ? (
        <section className="booking-group" aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading">
            Upcoming <span className="muted">{upcoming.length}</span>
          </h2>
          <ul className="booking-list">{upcoming.map(item)}</ul>
        </section>
      ) : (
        <div className="booking-none">
          <p className="muted">No upcoming shows.</p>
          <Link className="btn btn-primary" to="/">
            Find a Movie
          </Link>
        </div>
      )}
      {past.length ? (
        <section className="booking-group" aria-labelledby="past-heading">
          <h2 id="past-heading">
            Past <span className="muted">{past.length}</span>
          </h2>
          <ul className="booking-list">{past.map(item)}</ul>
        </section>
      ) : null}
    </div>
  );
}
