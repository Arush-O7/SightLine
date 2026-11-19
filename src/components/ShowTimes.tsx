import { Link } from 'react-router-dom';
import { formatTime, type Show } from '../data/movies';
import { getLayout, scoreColor } from '../lib/hall';
import { warmBooking } from '../lib/preload';
import { showView } from '../lib/showView';
import type { Cinema } from '../data/cinemas';

interface Props {
  cinema: Cinema;
  screenId: string;
  shows: Show[];
  /** how many seats are booked together */
  party: number;
  /** seats booked on the site, by show; null until the server answers */
  booked: Record<string, string[]> | null;
}

/** One auditorium's showtimes: its format and screen name, then each time with the best view still free. */
export default function ShowTimes({ cinema, screenId, shows, party, booked }: Props) {
  const screen = cinema.screens.find((s) => s.id === screenId)!;
  const layout = getLayout(screen.hallId);
  const from = Math.min(...layout.config.zones.map((z) => z.price));
  const now = Date.now();
  const group = party === 1 ? 'seat' : `${party} seats together`;
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
          const time = formatTime(show.start);
          if (show.start.getTime() < now) {
            return (
              <span key={show.id} className="time past" aria-disabled="true">
                <b>{time}</b>
                <small>Started</small>
              </span>
            );
          }
          const view = showView(show, party, booked?.[show.id]);
          // open the hall at the middle of the best seats left, once live availability is known
          const middle = booked ? view.seats[Math.floor((view.seats.length - 1) / 2)] : undefined;
          const left = view.score === null ? `no ${group} left` : `best ${group} left score ${view.score} out of 100`;
          return (
            <Link
              key={show.id}
              to={middle ? `/book/${show.id}?seat=${middle.id}` : `/book/${show.id}`}
              className={`time ${view.fill.tone}`}
              onMouseEnter={warmBooking}
              onFocus={warmBooking}
              aria-label={`${time}, ${cinema.name}, ${screen.name}, ${view.fill.label}, ${left}`}
            >
              <span className="time-top">
                <b>{time}</b>
                <span className="time-score" style={view.score === null ? undefined : { color: scoreColor(view.score) }}>
                  {view.score ?? '–'}
                </span>
              </span>
              <small>
                <i className="dot" /> {view.fill.label}
              </small>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
