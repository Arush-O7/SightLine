import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Backdrop, Poster } from '../components/Art';
import CinemaCard from '../components/CinemaCard';
import EventCard from '../components/EventCard';
import HallPlan from '../components/HallPlan';
import MovieCard from '../components/MovieCard';
import SeatDetails from '../components/SeatDetails';
import { CINEMAS } from '../data/cinemas';
import { EVENTS, MOVIES, languages, crowdFor, dateKey, formatDate, formatTime, showsFor, upcomingDays, venueOf, type Show } from '../data/movies';
import { getLayout, type HallLayout, type Seat } from '../lib/hall';
import { warmBooking } from '../lib/preload';
import { useTitle } from '../lib/useTitle';

const HeroHall = lazy(() => import('../components/HeroHall'));

/** The soonest bookable show of a movie in a given hall model, anywhere in the city. */
function nextShowIn(movieId: string, hallId: string): Show | null {
  const movie = MOVIES.find((m) => m.id === movieId)!;
  const soon = Date.now() + 10 * 60 * 1000;
  for (const day of upcomingDays(3)) {
    const hit = showsFor(movie, day.key)
      .filter((g) => g.hallId === hallId)
      .flatMap((g) => g.shows)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .find((s) => s.start.getTime() > soon);
    if (hit) return hit;
  }
  return null;
}

/** Three seats that show the range of views in a hall: the best seat, the front row and a back corner. */
function tourSeats(layout: HallLayout, taken: Set<string>): { key: string; label: string; seat: Seat }[] {
  const free = (row: Seat[], from: number) => row.slice(from).find((s) => !taken.has(s.id)) ?? row[from];
  const front = layout.grid[0];
  const back = layout.grid[layout.grid.length - 1];
  return [
    { key: 'best', label: 'Best Seat', seat: layout.byId.get(layout.bestSeatId)! },
    { key: 'front', label: 'Front Row', seat: free(front, Math.floor(front.length / 2)) },
    { key: 'back', label: 'Back Corner', seat: back[0] },
  ];
}

function SeatDemo({ show }: { show: Show | null }) {
  const layout = getLayout(show?.hallId ?? 'h1');
  const samples = useMemo(() => tourSeats(layout, new Set()), [layout]);
  const [pick, setPick] = useState('best');
  const { seat } = samples.find((s) => s.key === pick) ?? samples[0];
  const m = layout.metrics[seat.index];
  return (
    <div className="seat-demo">
      <HallPlan layout={layout} highlight={seat.id} />
      <div className="seat-demo-pick" role="group" aria-label="Compare three seats">
        {samples.map((s) => (
          <button key={s.key} type="button" className={`chip ${pick === s.key ? 'on' : ''}`} aria-pressed={pick === s.key} onClick={() => setPick(s.key)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="seat-demo-card" aria-live="polite">
        <div className="seat-demo-head">
          <div>
            <h3>
              Row {seat.rowLabel}, Seat {seat.number}
            </h3>
            <p className="muted small">
              {layout.config.format} auditorium · {seat.zone.name}
            </p>
          </div>
          <div className="seat-demo-side">
            <p className="seat-demo-score">
              <b>{Math.round(m.score)}</b>
              <span>View score</span>
            </p>
            <SeatDetails layout={layout} seat={seat} />
          </div>
        </div>
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
  useTitle();
  const [params, setParams] = useSearchParams();
  const lang = params.get('lang') && languages().includes(params.get('lang')!) ? params.get('lang')! : 'All';
  const query = params.get('q') ?? '';
  const update = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const moviesRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (params.get('section') === 'movies') requestAnimationFrame(() => moviesRef.current?.scrollIntoView({ block: 'start' }));
  }, [params]);

  const today = dateKey(new Date());
  const featured = MOVIES[0];
  const heroShow = useMemo(() => nextShowIn(featured.id, 'h2'), [featured.id]);
  const heroLayout = getLayout(heroShow?.hallId ?? 'h2');
  const heroTaken = useMemo(() => (heroShow ? crowdFor(heroShow, heroLayout) : new Set<string>()), [heroShow, heroLayout]);
  const heroTour = useMemo(() => tourSeats(heroLayout, heroTaken).map((t) => t.seat), [heroLayout, heroTaken]);
  const heroVenue = heroShow ? venueOf(heroShow) : null;
  const [liveSeat, setLiveSeat] = useState<Seat | null>(null);
  const [live, setLive] = useState(false);
  const demoShow = useMemo(() => nextShowIn('drishyam-the-conclusion', 'h1'), []);

  const cinemaCount = (movieId: string) =>
    new Set(showsFor(MOVIES.find((m) => m.id === movieId)!, today).map((g) => g.cinemaId)).size;
  const needle = query.trim().toLowerCase();
  const list = MOVIES.filter(
    (m) =>
      (lang === 'All' || m.language === lang) &&
      (!needle || [m.title, m.director, ...m.cast, ...m.genres].some((f) => f.toLowerCase().includes(needle))),
  );

  return (
    <>
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-stage">
          <Backdrop movie={featured} priority className={`home-hero-still ${live ? 'off' : ''}`} />
          <Suspense fallback={null}>
            <HeroHall layout={heroLayout} movie={featured} occupied={heroTaken} tour={heroTour} onSeat={setLiveSeat} onReady={() => setLive(true)} />
          </Suspense>
        </div>
        <div className="home-hero-scrim" />
        <div className="container home-hero-copy">
          <h1 id="home-title">See your seat before you book it</h1>
          <p className="home-hero-lede">
            Every cinema here is rebuilt in 3D. Pick a movie or a live show, pick a cinema in Delhi, then sit in any seat and see the
            stage from there.
          </p>
          <div className="home-hero-cta">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => moviesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              Browse Movies
            </button>
            <Link className="btn btn-glass btn-lg" to="/cinemas">
              Explore Cinemas
            </Link>
          </div>
          <p className="home-hero-facts">
            {MOVIES.length} movies · {EVENTS.length} live shows · {CINEMAS.length} cinemas in Delhi
          </p>
        </div>
        {heroVenue && heroShow ? (
          <div className={`home-hero-live ${live ? 'on' : ''}`}>
            <Link to={`/movie/${featured.id}`} className="home-hero-live-poster" aria-label={`${featured.title}: showtimes`}>
              <Poster movie={featured} eager />
            </Link>
            <div className="home-hero-live-text" aria-live="polite">
              <span className="home-hero-live-label">
                <span className="home-hero-live-dot" aria-hidden="true" /> Live 3D preview
              </span>
              <b className="home-hero-live-title">{featured.title}</b>
              <span>
                {liveSeat ? (
                  <>
                    Row {liveSeat.rowLabel}, Seat {liveSeat.number} · view score <b>{Math.round(heroLayout.metrics[liveSeat.index].score)}</b>
                  </>
                ) : (
                  'Whole hall'
                )}
              </span>
              <span className="home-hero-live-venue">
                {heroVenue.cinema.name} · {heroVenue.screen.name}
              </span>
            </div>
          </div>
        ) : null}
      </section>

      <section className="container section" ref={moviesRef} id="movies">
        <div className="section-head">
          <div>
            <h2>Now showing in Delhi</h2>
            <p className="muted">Pick a movie to see where and when it’s playing.</p>
          </div>
          <label className="search">
            <Search size={15} />
            <span className="sr-only">Search movies</span>
            <input
              type="search"
              name="q"
              value={query}
              onChange={(e) => update('q', e.target.value || null)}
              placeholder="Search movies, cast, director…"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="chips" role="group" aria-label="Filter by language">
            {['All', ...languages()].map((l) => (
              <button key={l} type="button" aria-pressed={lang === l} className={`chip ${lang === l ? 'on' : ''}`} onClick={() => update('lang', l === 'All' ? null : l)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        {list.length ? (
          <div className="movie-grid">
            {list.map((m) => (
              <MovieCard key={m.id} movie={m} cinemas={cinemaCount(m.id)} />
            ))}
          </div>
        ) : (
          <div className="no-results" role="status">
            <p>No movies match {needle ? `“${query.trim()}”` : 'that filter'}.</p>
            <button type="button" className="btn btn-secondary" onClick={() => setParams({}, { replace: true })}>
              Clear Filters
            </button>
          </div>
        )}
      </section>

      <section className="container section" id="live">
        <div className="section-head">
          <div>
            <h2>Live in the auditorium</h2>
            <p className="muted">Comedy, concerts, cricket on the big screen and theatre, in the same halls.</p>
          </div>
          <Link to="/events" className="btn btn-secondary">
            All Live Shows
          </Link>
        </div>
        <div className="event-grid">
          {/* one of each kind */}
          {EVENTS.filter((e, i) => EVENTS.findIndex((x) => x.kind === e.kind) === i).map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="how">
          <div className="how-steps">
            <h2>Know the view before you pay</h2>
            <p className="muted how-intro">
              A seat map tells you where you’ll sit. SightLine shows you what you’ll see, because every auditorium is modelled to scale with a
              camera at seated eye level.
            </p>
            <ol className="how-list">
              <li>
                <h3>Pick a movie</h3>
                <p className="muted">See every cinema and showtime for it across Delhi.</p>
              </li>
              <li>
                <h3>Choose a cinema and time</h3>
                <p className="muted">Standard, large-screen or recliner auditoriums, each built in 3D.</p>
              </li>
              <li>
                <h3>Sit in any seat</h3>
                <p className="muted">Look around from eye level, compare seats by view score, then book.</p>
              </li>
            </ol>
          </div>
          <SeatDemo show={demoShow} />
        </div>
      </section>

      <section className="container section" id="cinemas">
        <div className="section-head">
          <div>
            <h2>Cinemas in Delhi</h2>
            <p className="muted">From Saket to Connaught Place and Dwarka, every auditorium rebuilt in 3D.</p>
          </div>
          <Link to="/cinemas" className="btn btn-secondary">
            All Cinemas
          </Link>
        </div>
        <div className="cinema-grid">
          {CINEMAS.slice(0, 6).map((c) => (
            <CinemaCard key={c.id} cinema={c} dayKey={today} />
          ))}
        </div>
        {heroShow ? (
          <div className="home-close">
            <Backdrop movie={featured} className="home-close-bg" />
            <div className="home-close-scrim" />
            <Link to={`/movie/${featured.id}`} className="home-close-poster" tabIndex={-1} aria-hidden="true">
              <Poster movie={featured} />
            </Link>
            <div className="home-close-copy">
              <h2>{featured.title}</h2>
              <p>
                Playing next at {heroVenue?.cinema.name}, {heroShow.dateKey === today ? 'today' : formatDate(heroShow.start)} at {formatTime(heroShow.start)}. Pick your seat in 3D before you pay.
              </p>
              <div className="home-close-cta">
                <Link className="btn btn-primary btn-lg" to={`/movie/${featured.id}`}>
                  Book Tickets
                </Link>
                <Link className="btn btn-glass btn-lg" to="/events">
                  Browse Live Shows
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
