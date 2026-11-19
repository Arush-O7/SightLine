import { Link } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';
import { Poster } from './Art';
import { formatDate, formatTime, getMovie, parseShow } from '../data/movies';
import { api } from '../lib/api';
import { sortSeatIds, useStore } from '../lib/store';

/** Seats chosen earlier and not booked yet, with a way back to them (or to let them go). */
export default function ResumeBooking() {
  const lastShow = useStore((s) => s.lastShow);
  const chosen = useStore((s) => (s.lastShow ? s.selections[s.lastShow] : undefined));
  const clearSelection = useStore((s) => s.clearSelection);
  const signedIn = useStore((s) => !!s.user);
  const show = lastShow ? parseShow(lastShow) : null;
  const movie = show ? getMovie(show.movieId) : undefined;
  if (!show || !movie || !chosen?.length || show.start.getTime() < Date.now()) return null;
  const seats = sortSeatIds(chosen);
  const letGo = () => {
    clearSelection(show.id);
    // seats already held for checkout go back on sale straight away
    if (signedIn) void api.releaseHold(show.id).catch(() => {});
  };
  return (
    <div className="resume">
      <Link to={`/book/${show.id}?seat=${seats[0]}`} className="resume-link">
        <Poster movie={movie} />
        <span className="resume-text">
          <small>Continue booking</small>
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
