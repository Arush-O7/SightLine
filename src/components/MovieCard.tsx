import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Poster } from './Art';
import { formatRuntime, type Movie } from '../data/movies';

export default function MovieCard({ movie }: { movie: Movie }) {
  return (
    <Link to={`/movie/${movie.id}`} className="movie-card">
      <div className="movie-card-art">
        <Poster movie={movie} />
        <span className="movie-card-rating">
          <Star size={12} fill="currentColor" /> {movie.rating.toFixed(1)}
        </span>
        <span className="movie-card-cta">Book tickets</span>
      </div>
      <h3>{movie.title}</h3>
      <p className="muted small">
        {movie.genres.join(' / ')} · {formatRuntime(movie.runtime)} · {movie.cert}
      </p>
    </Link>
  );
}
