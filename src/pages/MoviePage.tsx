import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock, Globe, Star } from 'lucide-react';
import { Backdrop, Poster } from '../components/Art';
import NotFound from './NotFound';
import { fillLevel, formatRuntime, formatTime, getMovie, money, showsFor, upcomingDays } from '../data/movies';
import { getHall, getLayout } from '../lib/hall';
import { useTitle } from '../lib/useTitle';
import { warmBooking } from '../lib/preload';

export default function MoviePage() {
  const { movieId } = useParams();
  const movie = getMovie(movieId);
  const days = useMemo(() => upcomingDays(7), []);
  // the chosen day lives in the URL so a showtime list can be shared
  const [params, setParams] = useSearchParams();
  const dayParam = params.get('day');
  // late in the evening today's shows have all started, so open on the first day that still has one
  const firstOpenDay = useMemo(() => {
    if (!movie) return days[0].key;
    const now = Date.now();
    const open = days.find((d) => showsFor(movie, d.key).some((g) => g.shows.some((s) => s.start.getTime() > now)));
    return (open ?? days[0]).key;
  }, [movie, days]);
  const dayKey = days.some((d) => d.key === dayParam) ? dayParam! : firstOpenDay;
  const setDayKey = (key: string) => setParams(key === firstOpenDay ? {} : { day: key }, { replace: true });
  useTitle(movie?.title);

  if (!movie) return <NotFound title="We couldn’t find that film" />;

  const groups = showsFor(movie, dayKey);
  const now = Date.now();

  return (
    <div className="movie-page">
      <div className="movie-hero">
        <Backdrop movie={movie} priority className="movie-hero-bg" />
        <div className="movie-hero-scrim" />
        <div className="container movie-hero-inner">
          <Link to="/" className="back-link">
            <ArrowLeft size={16} /> All movies
          </Link>
          <div className="movie-head">
            <Poster movie={movie} eager className="movie-head-poster" />
            <div className="movie-head-info">
              <h1 className={`movie-title ${movie.titleFont === 'serif' ? 'serif' : ''}`}>{movie.title}</h1>
              <p className="hero-tagline">{movie.tagline}</p>
              <div className="meta-row">
                <span className="rating">
                  <Star size={14} fill="currentColor" /> {movie.rating.toFixed(1)} <em>({movie.votes})</em>
                </span>
                <span><Clock size={14} /> {formatRuntime(movie.runtime)}</span>
                <span className="cert">{movie.cert}</span>
                <span><Globe size={14} /> {movie.language}</span>
                <span>{movie.genres.join(' / ')}</span>
              </div>
              <p className="movie-synopsis">{movie.synopsis}</p>
              <dl className="credits">
                <div>
                  <dt>Director</dt>
                  <dd>{movie.director}</dd>
                </div>
                <div>
                  <dt>Cast</dt>
                  <dd>{movie.cast.join(', ')}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <section className="container section showtimes">
        <div className="section-head">
          <div>
            <h2>Showtimes</h2>
            <p className="muted">Pick a time, then see the view from any seat before you book.</p>
          </div>
        </div>

        <div className="day-strip" role="tablist" aria-label="Choose a day">
          {days.map((d) => (
            <button key={d.key} role="tab" aria-selected={d.key === dayKey} className={`day ${d.key === dayKey ? 'on' : ''}`} onClick={() => setDayKey(d.key)}>
              <span>{d.weekday}</span>
              <b>{d.dayNum}</b>
              <span>{d.month}</span>
            </button>
          ))}
        </div>

        <div className="hall-times">
          {groups.map(({ hallId, shows }) => {
            const hall = getHall(hallId);
            const layout = getLayout(hallId);
            const from = Math.min(...hall.zones.map((z) => z.price));
            return (
              <article key={hallId} className="hall-time-card">
                <header>
                  <span className="badge">{hall.badge}</span>
                  <h3>
                    {hall.name} <span className="muted">· {hall.format}</span>
                  </h3>
                  <p className="muted small">
                    {hall.screen.width.toFixed(0)} m screen · {hall.sound} · {layout.seats.length} seats
                  </p>
                  <p className="from-price">
                    Tickets from <b>{money(from)}</b>
                  </p>
                </header>
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
                      <Link key={show.id} to={`/book/${show.id}`} className={`time ${fill.tone}`} onMouseEnter={warmBooking} onFocus={warmBooking}>
                        <b>{formatTime(show.start)}</b>
                        <small>
                          <i className="dot" /> {fill.label}
                        </small>

                      </Link>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
