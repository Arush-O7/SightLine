import { Link } from 'react-router-dom';
import { Poster } from './Art';
import { formatRuntime, type Movie } from '../data/movies';

const WEEK = 7 * 24 * 60 * 60 * 1000;

export default function MovieCard({ movie, cinemas }: { movie: Movie; cinemas?: number }) {
  const isNew = Date.now() - new Date(movie.released).getTime() < WEEK;
  return (
    <Link to={`/movie/${movie.id}`} className="movie-card">
      <div className="movie-card-art">
        <Poster movie={movie} />
        {isNew ? <span className="movie-card-tag">New this week</span> : null}
        <span className="movie-card-cta">Book Tickets</span>
      </div>
      <h3>{movie.title}</h3>
      <p className="movie-card-meta">
        {movie.language} · {movie.genres[0]}
      </p>
      <p className="movie-card-meta">
        {formatRuntime(movie.runtime)}
        {cinemas ? ` · in ${cinemas} cinemas` : ''}
      </p>
    </Link>
  );
}
