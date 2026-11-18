import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Backdrop, Poster } from '../components/Art';
import EventCard from '../components/EventCard';
import MovieCard from '../components/MovieCard';
import HallPlan from '../components/HallPlan';
import { CINEMAS } from '../data/cinemas';
import { sized } from '../data/photos';
import { EVENTS, MOVIES, languages, crowdFor, dateKey, formatDate, formatTime, showsFor, upcomingDays, venueOf, type Show } from '../data/movies';
import { getLayout, type HallLayout, type Seat } from '../lib/hall';
import { useTitle } from '../lib/useTitle';

const HeroHall = lazy(() => import('../components/HeroHall'));

/** The soonest bookable show of a movie in a given hall model, anywhere in the city. */
function nextShowIn(movieId: string, hallId: string): Show | null {
  const movie = MOVIES.find((m) => m.id === movieId)!;
  const soon = Date.now() + 10 * 60 * 1000;
  for (const day of upcomingDays(4)) {
    const hit = showsFor(movie, day.key)
      .filter((g) => g.hallId === hallId)
      .flatMap((g) => g.shows)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .find((s) => s.start.getTime() > soon);
    if (hit) return hit;
  }
  return null;
}

/** Four seats that show the range of views in a hall, for the hero's camera tour. */
function tourSeats(layout: HallLayout, taken: Set<string>): Seat[] {
  const g = layout.grid;
  const free = (r: number, from: number) => g[r].slice(from).find((s) => !taken.has(s.id)) ?? g[r][from];
  const middle = (r: number) => Math.floor(g[r].length / 2);
  const front = Math.min(2, g.length - 1);
  return [layout.byId.get(layout.bestSeatId)!, free(Math.floor(g.length * 0.55), 1), free(g.length - 1, middle(g.length - 1)), free(front, middle(front))];
}

const tilt = (deg: number) => `${Math.abs(Math.round(deg))}° ${deg >= 0 ? 'up' : 'down'}`;

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
  const tour = useMemo(() => tourSeats(heroLayout, heroTaken), [heroLayout, heroTaken]);
  const heroVenue = heroShow ? venueOf(heroShow) : null;
  const [seat, setSeat] = useState<Seat | null>(null);
  const [live, setLive] = useState(false);

  // the two seats compared further down, in the same large-screen auditorium
  const big = getLayout('h2');
  const front = big.byId.get('C11')!;
  const best = big.byId.get(big.bestSeatId)!;
  const fm = big.metrics[front.index];
  const bm = big.metrics[best.index];

  const cinemaCount = (movieId: string) => new Set(showsFor(MOVIES.find((x) => x.id === movieId)!, today).map((g) => g.cinemaId)).size;
  const needle = query.trim().toLowerCase();
  const list = MOVIES.filter(
    (x) =>
      (lang === 'All' || x.language === lang) &&
      (!needle || [x.title, x.director, ...x.cast, ...x.genres].some((f) => f.toLowerCase().includes(needle))),
  );

  return (
    <>
      <section className="hx" aria-labelledby="home-title">
        <div className="hx-stage">
          <Backdrop movie={featured} priority className={`hx-still ${live ? 'off' : ''}`} />
          <Suspense fallback={null}>
            <HeroHall
              layout={heroLayout}
              movie={featured}
              occupied={heroTaken}
              tour={tour}
              onSeat={setSeat}
              onReady={() => setLive(true)}
            />
          </Suspense>
        </div>
        <div className="hx-scrim" />

        <div className="container hx-grid">
          <div className="hx-copy">
            <h1 id="home-title" className="hx-title">
              <span>Try any seat</span> <span>before you book</span>
            </h1>
            <p className="hx-lede">
              Every auditorium in Delhi’s cinemas, rebuilt in 3D to scale. Sit in any seat, see the screen exactly as it looks from there,
              then book the one you like.
            </p>
            <div className="hx-cta">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => moviesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                Browse Movies
              </button>
              <Link className="btn btn-glass btn-lg" to="/cinemas">
                Explore Cinemas
              </Link>
            </div>
            {heroVenue ? (
              <p className={`hx-now home-hero-live ${live && seat ? 'on' : ''}`} aria-live="polite">
                <span className="hx-now-dot" aria-hidden="true" />
                {seat ? (
                  <>
                    Live from Row {seat.rowLabel}, Seat {seat.number} at {heroVenue.cinema.name}: view score{' '}
                    <b>{Math.round(heroLayout.metrics[seat.index].score)}</b>
                  </>
                ) : (
                  'Loading the hall'
                )}
              </p>
            ) : null}
          </div>

        </div>
      </section>

      <section className="container hs" ref={moviesRef} id="movies">
        <div className="hs-head">
          <div>
            <h2 className="display">Now showing</h2>
            <p className="muted">
              {MOVIES.length} movies in {CINEMAS.length} Delhi cinemas this week. Pick one to see where and when it’s playing.
            </p>
          </div>
          <div className="hs-tools">
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
        </div>
        {list.length ? (
          <div className="movie-grid">
            {list.map((x) => (
              <MovieCard key={x.id} movie={x} cinemas={cinemaCount(x.id)} />
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

      <section className="container hs" aria-labelledby="compare-title">
        <div className="hs-head">
          <div>
            <h2 id="compare-title" className="display">
              Same hall, two seats
            </h2>
            <p className="muted hs-lede">
              A seat map tells you where you’ll sit. SightLine shows what you’ll see from there, from a camera placed at seated eye level in a
              hall built to scale.
            </p>
          </div>
        </div>
        <div className="cmp">
          {[
            { key: 'front', label: 'Front row', seat: front, metrics: fm, img: '/home/front-row.jpg', alt: 'The screen seen from front-row seat C11: it towers above you and spills past both edges of your view' },
            { key: 'best', label: 'Best seat', seat: best, metrics: bm, img: '/home/best-seat.jpg', alt: 'The screen seen from seat M11: the whole picture sits at eye level, framed by the hall' },
          ].map((c) => (
            <figure key={c.key} className={`cmp-card ${c.key === 'best' ? 'is-best' : ''}`}>
              <img src={c.img} width={1780} height={980} loading="lazy" decoding="async" alt={c.alt} />
              <figcaption className="cmp-body">
                <span className="cmp-score">{Math.round(c.metrics.score)}</span>
                <span className="cmp-text">
                  <span className="cmp-label">{c.label}</span>
                  <b>
                    Row {c.seat.rowLabel}, Seat {c.seat.number}
                  </b>
                  <span>
                    {c.metrics.distance.toFixed(1)} m from the screen, head tilted {tilt(c.metrics.elevation)}
                  </span>
                </span>
                <HallPlan layout={big} highlight={c.seat.id} className="cmp-plan" />
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="container hs" id="live">
        <div className="hs-head">
          <div>
            <h2 className="display">Live on the same screens</h2>
            <p className="muted">Stand-up, concerts, cricket on the big screen and theatre, with a 3D view from every seat.</p>
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

      <section className="container hs" id="cinemas">
        <div className="hs-head">
          <div>
            <h2 className="display">Eight cinemas across Delhi</h2>
            <p className="muted">From Saket and Vasant Kunj to Connaught Place, Daryaganj and Dwarka.</p>
          </div>
          <Link to="/cinemas" className="btn btn-secondary">
            All Cinemas
          </Link>
        </div>
        <ul className="ct-grid">
          {CINEMAS.map((c) => (
            <li key={c.id}>
              <Link to={`/cinema/${c.id}`} className="ct">
                <img src={sized(c.photo, 500)} width={500} height={375} loading="lazy" decoding="async" alt="" />
                {c.photo.note?.startsWith('Representative') ? <span className="photo-tag">Representative photo</span> : null}
                <span className="ct-text">
                  <b>{c.name}</b>
                  <span>{c.area}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {heroShow ? (
          <div className="home-close">
            <Backdrop movie={featured} className="home-close-bg" />
            <div className="home-close-scrim" />
            <Link to={`/movie/${featured.id}`} className="home-close-poster" tabIndex={-1} aria-hidden="true">
              <Poster movie={featured} />
            </Link>
            <div className="home-close-copy">
              <h2 className="display">{featured.title}</h2>
              <p>
                Playing next at {heroVenue?.cinema.name}, {heroShow.dateKey === today ? 'today' : formatDate(heroShow.start)} at{' '}
                {formatTime(heroShow.start)}. Pick your seat in 3D before you pay.
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
