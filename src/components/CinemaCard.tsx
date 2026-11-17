import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import HallPlan from './HallPlan';
import { getLayout } from '../lib/hall';
import { showsAt } from '../data/movies';
import type { Cinema } from '../data/cinemas';

const FORMAT_ORDER = { h2: 0, h3: 1, h1: 2 } as const;

/** A cinema with a plan of its largest auditorium, drawn from the real hall model. */
export default function CinemaCard({ cinema, dayKey, level = 3 }: { cinema: Cinema; dayKey: string; level?: 2 | 3 }) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const screens = [...cinema.screens].sort((a, b) => FORMAT_ORDER[a.hallId] - FORMAT_ORDER[b.hallId]);
  const biggest = screens[0];
  const formats = Array.from(new Set(screens.map((s) => getLayout(s.hallId).config.format)));
  const today = showsAt(cinema, dayKey).length;
  return (
    <Link to={`/cinema/${cinema.id}`} className="cinema-card">
      <HallPlan layout={getLayout(biggest.hallId)} className="cinema-card-plan" />
      <div className="cinema-card-body">
        <Heading className="cinema-card-title">{cinema.name}</Heading>
        <p className="muted small cinema-card-area">
          <MapPin size={13} aria-hidden="true" /> {cinema.area}
        </p>
        <div className="cinema-card-formats">
          {formats.map((f) => (
            <span key={f} className="badge">
              {f}
            </span>
          ))}
        </div>
        <p className="cinema-card-foot">
          <span>
            {today} movies today · {cinema.screens.length} {cinema.screens.length === 1 ? 'screen' : 'screens'}
          </span>
          <span className="cinema-card-link">Showtimes</span>
        </p>
      </div>
    </Link>
  );
}
