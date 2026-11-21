import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';
import { Poster } from './Art';
import { formatDate, formatTime, getMovie, parseShow } from '../data/movies';
import { api, type Hold } from '../lib/api';
import { sameSeats, sortSeatIds, useStore } from '../lib/store';
import { formatCountdown } from '../lib/time';

/** Seats chosen earlier and not booked yet, with a way back to them (or to let them go). */
export default function ResumeBooking() {
  const lastShow = useStore((s) => s.lastShow);
  const chosen = useStore((s) => (s.lastShow ? s.selections[s.lastShow] : undefined));
  const clearSelection = useStore((s) => s.clearSelection);
  const signedIn = useStore((s) => !!s.user);

  // seats still held for payment keep their own clock, so the row counts it down and goes straight back to paying
  const [answer, setAnswer] = useState<{ show: string; hold: Hold | null } | null>(null);
  useEffect(() => {
    if (!signedIn || !lastShow) return;
    let live = true;
    api.seats(lastShow).then(
      ({ hold }) => live && setAnswer({ show: lastShow, hold }),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [signedIn, lastShow]);
  const hold = signedIn && answer?.show === lastShow ? answer.hold : null;
  const heldUntil = hold && chosen && sameSeats(hold.seats, chosen) ? hold.expiresAt : null;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!heldUntil) return;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= heldUntil) window.clearInterval(timer);
    }, 1000);
    setNow(Date.now());
    return () => window.clearInterval(timer);
  }, [heldUntil]);

  const show = lastShow ? parseShow(lastShow) : null;
  const movie = show ? getMovie(show.movieId) : undefined;
  if (!show || !movie || !chosen?.length || show.start.getTime() < Date.now()) return null;
  const seats = sortSeatIds(chosen);
  const left = heldUntil ? Math.max(0, Math.ceil((heldUntil - now) / 1000)) : 0;
  const letGo = () => {
    clearSelection(show.id);
    // seats already held for checkout go back on sale straight away
    if (signedIn) void api.releaseHold(show.id).catch(() => {});
  };
  return (
    <div className="resume">
      <Link to={left ? `/checkout/${show.id}` : `/book/${show.id}?seat=${seats[0]}`} className="resume-link">
        <Poster movie={movie} />
        <span className="resume-text">
          <small>
            Continue booking
            {left ? <span className={left < 60 ? 'low' : undefined}> · held for {formatCountdown(left)}</span> : null}
          </small>
          <b>{movie.title}</b>
          <span>
            {formatDate(show.start)}, {formatTime(show.start)} · {seats.length === 1 ? 'Seat' : 'Seats'} {seats.join(', ')}
          </span>
        </span>
        <ChevronRight size={18} />
      </Link>
      <button type="button" className="resume-clear" aria-label={`Let go of the seats chosen for ${movie.title}`} onClick={letGo}>
        <X size={16} />
      </button>
    </div>
  );
}
