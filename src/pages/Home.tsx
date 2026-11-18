import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Backdrop, Poster } from '../components/Art';
import EventCard from '../components/EventCard';
import MovieCard from '../components/MovieCard';
import { FieldOfViewDiagram, HeadTiltDiagram, OffCentreDiagram } from '../components/ScoreDiagrams';
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

const SCORE_FACTORS = [
  {
    title: 'Screen in view',
    weight: 45,
    body: 'How much of your vision the screen fills. Around 50° feels immersive without making you scan from side to side.',
    Diagram: FieldOfViewDiagram,
  },
  {
    title: 'Angle to the centre',
    weight: 30,
    body: 'How far to the side you sit. The further off-centre, the more skewed the picture looks.',
    Diagram: OffCentreDiagram,
  },
  {
    title: 'Head tilt',
    weight: 25,
    body: 'How far you look up to the middle of the screen. Up to 8° is effortless; the front rows ask for far more.',
    Diagram: HeadTiltDiagram,
  },
];

const STEPS = [
  {
    title: 'Pick a show',
    body: 'Choose a movie or a live show, then a cinema, a day and a time. Every auditorium’s format and starting price is shown.',
    img: '/home/step-pick.jpg',
    alt: 'Showtimes for a movie, grouped by cinema and auditorium, with a strip of days and format filters',
  },
  {
    title: 'Sit in any seat',
    body: 'Booking opens in 3D. Tap a seat to see the screen from it, compare two seats side by side, or let SightLine pick seats together.',
    img: '/home/step-sit.jpg',
    alt: 'The booking page: the view from seat M11 in 3D beside the seat map, with its view score of 100',
  },
  {
    title: 'Book and keep the view',
    body: 'Pay by UPI or card. Your ticket carries a QR code and a picture of the view from the seat you chose.',
    img: '/home/step-book.jpg',
    alt: 'A ticket with the movie poster, date, cinema, seat M11 and a QR code',
  },
];

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
  const [live, setLive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

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
              A seat map tells you where you’ll sit. SightLine shows what you’ll see from there: first from the front row, then from the
              best seat in the house.
            </p>
          </div>
        </div>
        <div className="cmp">
          <img
            src="/home/front-row.jpg"
            width={1780}
            height={980}
            loading="lazy"
            decoding="async"
            alt="The screen seen from the front row, seat C11: it towers above you and spills past both edges of your view"
          />
          <img
            src="/home/best-seat.jpg"
            width={1780}
            height={980}
            loading="lazy"
            decoding="async"
            alt="The screen seen from the best seat, M11: the whole picture sits at eye level, framed by the hall"
          />
        </div>

        <div className="score-explain">
          <div className="score-explain-head">
            <h3>What the view score measures</h3>
            <p className="muted">
              Every seat in every auditorium gets a score out of 100, worked out from three measurements taken in the 3D model at seated eye
              level.
            </p>
          </div>
          <ul className="score-factors">
            {SCORE_FACTORS.map((f) => (
              <li key={f.title}>
                <f.Diagram />
                <div className="score-factor-text">
                  <h4>{f.title}</h4>
                  <p className="score-weight">{f.weight}% of the score</p>
                  <p className="muted">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container hs" aria-labelledby="how-title">
        <div className="hs-head">
          <div>
            <h2 id="how-title" className="display">
              How it works
            </h2>
            <p className="muted">From a movie to the right seat in under a minute, on a phone or a laptop.</p>
          </div>
        </div>
        <div className="steps">
          <div className="steps-list" role="tablist" aria-label="Steps" aria-orientation="vertical">
            {STEPS.map((step, i) => (
              <button
                key={step.title}
                type="button"
                role="tab"
                id={`step-tab-${i}`}
                aria-selected={step === STEPS[stepIndex]}
                aria-controls="step-panel"
                tabIndex={i === stepIndex ? 0 : -1}
                className={`step ${i === stepIndex ? 'on' : ''}`}
                onClick={() => setStepIndex(i)}
                onKeyDown={(e) => {
                  const next = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
                  if (!next) return;
                  e.preventDefault();
                  const to = (i + next + STEPS.length) % STEPS.length;
                  setStepIndex(to);
                  document.getElementById(`step-tab-${to}`)?.focus();
                }}
              >
                <span className="step-n" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="step-text">
                  <span className="step-title">{step.title}</span>
                  <span className="step-body">{step.body}</span>
                </span>
                {/* on phones every step shows its own picture under it */}
                <img className="step-img-inline" src={step.img} width={1200} height={675} loading="lazy" decoding="async" alt="" />
              </button>
            ))}
          </div>
          <div className="steps-stage" id="step-panel" role="tabpanel" aria-labelledby={`step-tab-${stepIndex}`}>
            {STEPS.map((step, i) => (
              <img
                key={step.img}
                className={i === stepIndex ? 'on' : ''}
                src={step.img}
                width={1200}
                height={675}
                loading="lazy"
                decoding="async"
                alt={i === stepIndex ? step.alt : ''}
                aria-hidden={i !== stepIndex}
              />
            ))}
          </div>
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
