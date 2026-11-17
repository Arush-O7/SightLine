import { Link } from 'react-router-dom';
import { fillLevel, formatTime, type Show } from '../data/movies';
import { getLayout } from '../lib/hall';
import { warmBooking } from '../lib/preload';
import type { Cinema } from '../data/cinemas';

/** One auditorium's showtimes: its format and screen name, then a button per show. */
export default function ShowTimes({ cinema, screenId, shows }: { cinema: Cinema; screenId: string; shows: Show[] }) {
  const screen = cinema.screens.find((s) => s.id === screenId)!;
  const layout = getLayout(screen.hallId);
  const from = Math.min(...layout.config.zones.map((z) => z.price));
  const now = Date.now();
  return (
    <div className="screen-row">
      <div className="screen-row-label">
        <span className="badge">{layout.config.format}</span>
        <span className="muted small">
          {screen.name} · from ₹{from}
        </span>
      </div>
      <div className="time-row">
        {shows.map((show) => {
          const past = show.start.getTime() < now;
          const fill = fillLevel(show, layout);
          return past ? (
            <span key={show.id} className="time past" aria-disabled="true">
              <b>{formatTime(show.start)}</b>
              <small>Started</small>
            </span>
          ) : (
            <Link
              key={show.id}
              to={`/book/${show.id}`}
              className={`time ${fill.tone}`}
              onMouseEnter={warmBooking}
              onFocus={warmBooking}
              aria-label={`${formatTime(show.start)}, ${cinema.name}, ${screen.name}, ${fill.label}`}
            >
              <b>{formatTime(show.start)}</b>
              <small>
                <i className="dot" /> {fill.label}
              </small>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
