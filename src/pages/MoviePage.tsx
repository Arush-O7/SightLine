import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock, Globe, MapPin } from 'lucide-react';
import { Backdrop, Poster } from '../components/Art';
import PartyPicker from '../components/PartyPicker';
import ShowTimes from '../components/ShowTimes';
import NotFound from './NotFound';
import { getCinema } from '../data/cinemas';
import { KIND_LABEL, formatRuntime, getMovie, isLive, showsFor, upcomingDays, type ShowGroup } from '../data/movies';
import { getLayout } from '../lib/hall';
import { useBookedSeats } from '../lib/showView';
import { useStore } from '../lib/store';
import { useTitle } from '../lib/useTitle';

const FORMATS = ['All', 'Large screen', 'Recliner', 'Standard'];

export default function MoviePage() {
  const { movieId } = useParams();
  const movie = getMovie(movieId);
  const days = useMemo(() => upcomingDays(7), []);
  // the chosen day and format live in the URL so a showtime list can be shared
  const [params, setParams] = useSearchParams();
  const dayParam = params.get('day');
  const format = FORMATS.includes(params.get('format') ?? '') ? params.get('format')! : 'All';
  // late in the evening today's shows have all started, so open on the first day that still has one
  const firstOpenDay = useMemo(() => {
    if (!movie) return days[0].key;
    const now = Date.now();
    const open = days.find((d) => showsFor(movie, d.key).some((g) => g.shows.some((s) => s.start.getTime() > now)));
    return (open ?? days[0]).key;
  }, [movie, days]);
  const dayKey = days.some((d) => d.key === dayParam) ? dayParam! : firstOpenDay;
  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  useTitle(movie?.title);
  const party = useStore((s) => s.party);

  // the day's screenings in the chosen format, and what is already booked for the ones still to start
  const groups = movie ? showsFor(movie, dayKey).filter((g) => format === 'All' || getLayout(g.hallId).config.format === format) : [];
  const now = Date.now();
  const booked = useBookedSeats(groups.flatMap((g) => g.shows.filter((s) => s.start.getTime() > now).map((s) => s.id)));

  if (!movie) return <NotFound title="We couldn’t find that movie or show" />;
  const live = isLive(movie);

  // group the screenings by cinema, keeping each auditorium's times together
  const byCinema = new Map<string, ShowGroup[]>();
  for (const g of groups) byCinema.set(g.cinemaId, [...(byCinema.get(g.cinemaId) ?? []), g]);

  return (
    <div className="movie-page">
      <div className="movie-hero">
        <Backdrop movie={movie} priority className="movie-hero-bg" />
        <div className="movie-hero-scrim" />
        <div className="container movie-hero-inner">
          <Link to={live ? '/events' : '/'} className="back-link">
            <ArrowLeft size={16} /> {live ? 'All live shows' : 'All movies'}
          </Link>
          <div className="movie-head">
            <Poster movie={movie} eager className="movie-head-poster" />
            <div className="movie-head-info">
              <h1 className="movie-title">{movie.title}</h1>
              <div className="meta-row">
                {live ? <span className="badge">{KIND_LABEL[movie.kind]}</span> : null}
                <span>
                  <Globe size={14} /> {movie.language}
                </span>
                <span>
                  <Clock size={14} /> {formatRuntime(movie.runtime)}
                </span>
                {movie.cert ? <span className="cert">{movie.cert}</span> : null}
                <span>{movie.genres.join(', ')}</span>
              </div>
              <p className="movie-synopsis">{movie.synopsis}</p>
              <dl className="credits">
                {movie.director ? (
                  <div>
                    <dt>Director</dt>
                    <dd>{movie.director}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>{live ? 'Line-up' : 'Cast'}</dt>
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
            <h2>Cinemas and Showtimes</h2>
            <p className="muted">Pick a time, then see the {live ? 'stage' : 'view'} from any seat before you book.</p>
          </div>
        </div>

        <div className="day-strip" role="tablist" aria-label="Choose a day">
          {days.map((d) => (
            <button
              key={d.key}
              role="tab"
              aria-selected={d.key === dayKey}
              className={`day ${d.key === dayKey ? 'on' : ''}`}
              onClick={() => setParam('day', d.key === firstOpenDay ? null : d.key)}
            >
              <span>{d.weekday}</span>
              <b>{d.dayNum}</b>
              <span>{d.month}</span>
            </button>
          ))}
        </div>

        <div className="showtimes-tools">
          <div className="chips" role="group" aria-label="Filter by auditorium">
            {FORMATS.map((f) => (
              <button key={f} type="button" aria-pressed={format === f} className={`chip ${format === f ? 'on' : ''}`} onClick={() => setParam('format', f === 'All' ? null : f)}>
                {f}
              </button>
            ))}
          </div>
          <PartyPicker />
        </div>
        <p className="muted small showtimes-note">
          The number beside each time is the best view left for {party === 1 ? 'one seat' : `${party} seats together`}, out of 100.
        </p>

        {byCinema.size ? (
          <div className="venue-list">
            {[...byCinema].map(([cinemaId, groups]) => {
              const cinema = getCinema(cinemaId)!;
              return (
                <article key={cinemaId} className="venue">
                  <header className="venue-head">
                    <h3>
                      <Link to={`/cinema/${cinema.id}`}>{cinema.name}</Link>
                    </h3>
                    <p className="muted small">
                      <MapPin size={13} aria-hidden="true" /> {cinema.area}
                    </p>
                  </header>
                  <div className="venue-screens">
                    {groups.map((g) => (
                      <ShowTimes key={g.screenId} cinema={cinema} screenId={g.screenId} shows={g.shows} party={party} booked={booked} />
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="no-results" role="status">
            <p>No {format === 'All' ? '' : `${format.toLowerCase()} `}shows on this day. Try another day or format.</p>
          </div>
        )}
      </section>
    </div>
  );
}
