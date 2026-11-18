import { Link } from 'react-router-dom';
import { Poster } from './Art';
import { KIND_LABEL, formatDate, formatTime, money, nextShowWithin, venueOf, type Movie } from '../data/movies';
import { getLayout } from '../lib/hall';

/** A live show: its photo, what kind of show it is, and when and where it plays next. */
export default function EventCard({ event, level = 3 }: { event: Movie; level?: 2 | 3 }) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const next = nextShowWithin(event);
  const venue = next ? venueOf(next) : null;
  const from = next ? Math.min(...getLayout(next.hallId).config.zones.map((z) => z.price)) : null;
  return (
    <Link to={`/movie/${event.id}`} className="event-card">
      <div className="event-card-art">
        <Poster movie={event} />
        <span className="event-card-kind">{KIND_LABEL[event.kind]}</span>
      </div>
      <div className="event-card-body">
        <Heading className="event-card-title">{event.title}</Heading>
        <p className="event-card-tagline">{event.tagline}</p>
        <p className="event-card-meta">
          {next && venue ? (
            <>
              Next: {formatDate(next.start)}, {formatTime(next.start)} · {venue.cinema.name}
            </>
          ) : (
            'No shows in the next week'
          )}
        </p>
        {from ? <p className="event-card-price">From {money(from)}</p> : null}
      </div>
    </Link>
  );
}
