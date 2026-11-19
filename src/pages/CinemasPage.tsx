import CinemaCard from '../components/CinemaCard';
import { CINEMAS } from '../data/cinemas';
import { dayKey } from '../data/movies';
import { useTitle } from '../lib/useTitle';

export default function CinemasPage() {
  useTitle('Cinemas');
  const today = dayKey();
  return (
    <div className="container section cinemas-page">
      <div className="section-head">
        <div>
          <h1 className="display">Cinemas in Delhi</h1>
          <p className="muted">Pick a cinema to see what’s playing and walk its auditoriums in 3D.</p>
        </div>
      </div>
      <div className="cinema-grid">
        {CINEMAS.map((c) => (
          <CinemaCard key={c.id} cinema={c} dayKey={today} level={2} />
        ))}
      </div>
    </div>
  );
}
