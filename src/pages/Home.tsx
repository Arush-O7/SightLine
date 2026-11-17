import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Armchair, Search, Star, Users, Volume2, Projector, Ruler } from 'lucide-react';
import { Backdrop } from '../components/Art';
import HallPlan from '../components/HallPlan';
import MovieCard from '../components/MovieCard';
import { GENRES, MOVIES, formatRuntime, formatTime, nextShow, showsFor, upcomingDays, type Show } from '../data/movies';
import { HALLS, getLayout, type HallLayout, type Seat } from '../lib/hall';
import { warmBooking } from '../lib/preload';
import { useTitle } from '../lib/useTitle';

/** The soonest show in a hall that is still bookable, across every film. */
function nextShowInHall(hallId: string): Show | null {
  const soon = Date.now() + 10 * 60 * 1000;
  let best: Show | null = null;
  for (const day of upcomingDays(3)) {
    for (const movie of MOVIES) {
      for (const group of showsFor(movie, day.key)) {
        if (group.hallId !== hallId) continue;
        for (const s of group.shows) if (s.start.getTime() > soon && (!best || s.start < best.start)) best = s;
      }
    }
    if (best) return best;
  }
  return best;
}

/** Three seats that show the range of views in a hall: the front row, the best seat, and the back corner. */
function sampleSeats(layout: HallLayout): { key: string; label: string; seat: Seat }[] {
  const front = layout.grid[0];
  const back = layout.grid[layout.grid.length - 1];
  return [
    { key: 'front', label: 'Front Row', seat: front[Math.floor(front.length / 2)] },
    { key: 'best', label: 'Best Seat', seat: layout.byId.get(layout.bestSeatId)! },
    { key: 'back', label: 'Back Corner', seat: back[0] },
  ];
}

const seatName = (seat: Seat) => `Row ${seat.rowLabel}, Seat ${seat.number}`;

function SeatDemo() {
  const layout = getLayout(HALLS[0].id);
  const samples = useMemo(() => sampleSeats(layout), [layout]);
  const show = useMemo(() => nextShowInHall(layout.config.id), [layout]);
  const [pick, setPick] = useState('best');
  const { seat } = samples.find((s) => s.key === pick) ?? samples[1];
  const m = layout.metrics[seat.index];
  const tilt = Math.round(m.elevation);

  return (
    <div className="seat-demo">
      <HallPlan layout={layout} highlight={seat.id} />
      <div className="seat-demo-pick" role="group" aria-label={`Compare seats in ${layout.config.name}`}>
        {samples.map((s) => (
          <button key={s.key} type="button" className={`chip ${pick === s.key ? 'on' : ''}`} aria-pressed={pick === s.key} onClick={() => setPick(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="seat-demo-card" aria-live="polite">
        <div className="seat-demo-head">
          <div>
            <h3>{seatName(seat)}</h3>
            <p className="muted small">
              {layout.config.name} · {seat.zone.name}
            </p>
          </div>
          <p className="seat-demo-score">
            <b>{Math.round(m.score)}</b>
            <span>View score</span>
          </p>
        </div>
        <dl className="seat-demo-facts">
          <div>
            <dt>Distance</dt>
            <dd>{m.distance.toFixed(1)} m</dd>
          </div>
          <div>
            <dt>Field of view</dt>
            <dd>{Math.round(m.hAngle)}°</dd>
          </div>
          <div>
            <dt>Head tilt</dt>
            <dd>
              {Math.abs(tilt)}°{tilt > 0 ? ' up' : tilt < 0 ? ' down' : ''}
            </dd>
          </div>
        </dl>
        {show ? (
          <Link className="btn btn-secondary" to={`/book/${show.id}?seat=${seat.id}`} onMouseEnter={warmBooking} onFocus={warmBooking}>
            Sit in {seat.id} in 3D
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function Home() {
  const featured = useMemo(() => MOVIES.filter((m) => m.featured), []);
  const [idx, setIdx] = useState(0);
  const [params, setParams] = useSearchParams();
  // the genre filter lives in the URL so a filtered list can be shared or bookmarked
  const genreParam = params.get('genre');
  const genre = genreParam && GENRES.includes(genreParam) ? genreParam : 'All';
  const setGenre = (g: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('section');
        if (g === 'All') next.delete('genre');
        else next.set('genre', g);
        return next;
      },
      { replace: true },
    );
  useTitle();
  const query = params.get('q') ?? '';
  const setQuery = (q: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('section');
        if (q) next.set('q', q);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );
  const hallsRef = useRef<HTMLElement>(null);
  const filmsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (params.get('section') === 'halls') {
      requestAnimationFrame(() => hallsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [params]);

  const halls = useMemo(
    () => HALLS.map((hall) => ({ hall, layout: getLayout(hall.id), show: nextShowInHall(hall.id) })),
    [],
  );
  const seatCount = halls.reduce((n, h) => n + h.layout.seats.length, 0);

  const movie = featured[idx];
  const show = useMemo(() => nextShow(movie), [movie]);
  const needle = query.trim().toLowerCase();
  const list = MOVIES.filter(
    (m) =>
      (genre === 'All' || m.genres.includes(genre)) &&
      (!needle ||
        [m.title, m.director, ...m.cast, ...m.genres].some((field) => field.toLowerCase().includes(needle))),
  );

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        {featured.map((m, i) => (
          <Backdrop key={m.id} movie={m} priority={i === 0} className={`hero-bg ${i === idx ? 'on' : ''}`} />
        ))}
        <div className="hero-scrim" />
        <div className="container hero-content">
          <h1 id="hero-title" className="hero-title">
            Cinema tickets with the view from your seat
          </h1>
          <p className="hero-lede">
            Every hall is built to scale in 3D. Sit in any of our {seatCount} seats and see the screen from there before you pay.
          </p>

          <div className="hero-film" key={movie.id}>
            <p className="hero-film-title">{movie.title}</p>
            <div className="meta-row">
              <span className="rating">
                <Star size={14} fill="currentColor" /> {movie.rating.toFixed(1)}
              </span>
              <span>{formatRuntime(movie.runtime)}</span>
              <span className="cert">{movie.cert}</span>
              <span>{movie.genres.join(' / ')}</span>
            </div>
            <div className="hero-cta">
              <Link className="btn btn-primary btn-lg" to={`/movie/${movie.id}`}>
                Book Tickets
              </Link>
              <Link className="btn btn-glass btn-lg" to={`/book/${show.id}`} onMouseEnter={warmBooking} onFocus={warmBooking}>
                Preview a Seat <small>{formatTime(show.start)}</small>
              </Link>
            </div>
          </div>

          <div className="hero-films" role="group" aria-label="Featured films">
            {featured.map((m, i) => (
              <button key={m.id} type="button" className={`chip ${i === idx ? 'on' : ''}`} aria-pressed={i === idx} onClick={() => setIdx(i)}>
                {m.title}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="container section" ref={filmsRef} id="films">
        <div className="section-head">
          <div>
            <h2>Movies now showing</h2>
            <p className="muted">Pick a film, then walk the hall in 3D before you choose a seat.</p>
          </div>
          <label className="search">
            <Search size={15} />
            <span className="sr-only">Search films</span>
            <input
              type="search"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search films, cast, director…"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="chips" role="tablist" aria-label="Filter by genre">
            {['All', ...GENRES].map((g) => (
              <button key={g} role="tab" aria-selected={genre === g} className={`chip ${genre === g ? 'on' : ''}`} onClick={() => setGenre(g)}>
                {g}
              </button>
            ))}
          </div>
        </div>
        {list.length ? (
          <div className="movie-grid">
            {list.map((m) => (
              <MovieCard key={m.id} movie={m} />
            ))}
          </div>
        ) : (
          <div className="no-results" role="status">
            <p>No films match {needle ? `“${query.trim()}”` : 'that filter'}.</p>
            <button type="button" className="btn btn-secondary" onClick={() => setParams({}, { replace: true })}>
              Clear Filters
            </button>
          </div>
        )}
      </section>

      <section className="container section">
        <div className="feature-band">
          <div className="feature-intro">
            <h2>See it before you seat it.</h2>
            <p className="muted">
              A seat map tells you where you are sitting. It can’t tell you what you will see. So every hall is built to scale in 3D,
              with a camera where your eyes will be.
            </p>
            <div className="feature-grid">
              <article className="feature">
                <h3>Walk the hall</h3>
                <p className="muted">Orbit a true-to-scale model of the auditorium. Spin it, zoom in, and click any seat.</p>
              </article>
              <article className="feature">
                <h3>Sit in the seat</h3>
                <p className="muted">Look around from eye level: the screen, your neighbours and the heads in front.</p>
              </article>
              <article className="feature">
                <h3>Know the numbers</h3>
                <p className="muted">Every seat gets a view score from its distance, viewing angle and head tilt. Compare two seats, or pick the best ones for your group.</p>
              </article>
            </div>
          </div>
          <SeatDemo />
        </div>
      </section>

      <section className="container section" ref={hallsRef} id="halls">
        <div className="section-head">
          <div>
            <h2>Our halls</h2>
            <p className="muted">Three rooms, three ways to watch.</p>
          </div>
        </div>
        <div className="hall-grid">
          {halls.map(({ hall, layout, show: hallShow }) => (
            <article key={hall.id} className="hall-card">
              <HallPlan layout={layout} className="hall-card-plan" />
              <div className="hall-card-top">
                <span className="badge">{hall.badge}</span>
                <h3>
                  {hall.name} <span className="muted">· {hall.format}</span>
                </h3>
                <p className="muted">{hall.blurb}</p>
              </div>
              <ul className="spec-list">
                <li><Ruler size={15} /> {hall.screen.width.toFixed(1)} m × {hall.screen.height.toFixed(1)} m screen</li>
                <li><Users size={15} /> {layout.seats.length} seats · {hall.rows} rows</li>
                <li><Projector size={15} /> {hall.projection}</li>
                <li><Volume2 size={15} /> {hall.sound}</li>
                <li><Armchair size={15} /> {hall.zones.map((z) => z.name).join(' · ')}</li>
              </ul>
              {hallShow ? (
                <Link
                  className="btn btn-secondary"
                  to={`/book/${hallShow.id}?seat=${layout.bestSeatId}`}
                  aria-label={`Preview the best seat in ${hall.name}`}
                  onMouseEnter={warmBooking}
                  onFocus={warmBooking}
                >
                  Preview the Best Seat
                </Link>
              ) : null}
            </article>
          ))}
        </div>
        <div className="home-close">
          <p>Pick a film and a showtime, then choose your seat from the view.</p>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => {
              filmsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              filmsRef.current?.querySelector('input')?.focus({ preventScroll: true });
            }}
          >
            Book Tickets
          </button>
        </div>
      </section>
    </>
  );
}
