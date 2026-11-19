import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, MapPin, Navigation } from "lucide-react";
import { Poster } from "../components/Art";
import PartyPicker from "../components/PartyPicker";
import ShowTimes from "../components/ShowTimes";
import NotFound from "./NotFound";
import { directionsUrl, getCinema } from "../data/cinemas";
import {
  KIND_LABEL,
  formatRuntime,
  isLive,
  showsAt,
  upcomingDays,
} from "../data/movies";
import { sized } from "../data/photos";
import { getLayout } from "../lib/hall";
import { useBookedSeats } from "../lib/showView";
import { useStore } from "../lib/store";
import { useTitle } from "../lib/useTitle";

export default function CinemaPage() {
  const { cinemaId } = useParams();
  const cinema = getCinema(cinemaId);
  const days = useMemo(() => upcomingDays(7), []);
  const [params, setParams] = useSearchParams();
  const firstOpenDay = useMemo(() => {
    if (!cinema) return days[0].key;
    const now = Date.now();
    const open = days.find((d) =>
      showsAt(cinema, d.key).some((m) =>
        m.groups.some((g) => g.shows.some((s) => s.start.getTime() > now)),
      ),
    );
    return (open ?? days[0]).key;
  }, [cinema, days]);
  const dayKey = days.some((d) => d.key === params.get("day"))
    ? params.get("day")!
    : firstOpenDay;
  useTitle(cinema?.name);
  const party = useStore((s) => s.party);
  const listing = cinema ? showsAt(cinema, dayKey) : [];
  const now = Date.now();
  const booked = useBookedSeats(
    listing.flatMap((m) =>
      m.groups.flatMap((g) =>
        g.shows.filter((s) => s.start.getTime() > now).map((s) => s.id),
      ),
    ),
  );

  if (!cinema) return <NotFound title="We couldn’t find that cinema" />;

  return (
    <div className="container section cinema-page">
      <Link to="/cinemas" className="back-link">
        <ArrowLeft size={16} /> All cinemas
      </Link>
      <div className="cinema-photos">
        <header className="cinema-hero">
          <img
            src={sized(cinema.photo, 1280)}
            width={1280}
            height={720}
            alt=""
            fetchPriority="high"
          />
          <div className="cinema-hero-scrim" />
          <div className="cinema-hero-copy">
            <h1>{cinema.name}</h1>
            <p>
              <MapPin size={14} aria-hidden="true" /> {cinema.area}, Delhi ·{" "}
              {cinema.chain}
            </p>
            <a
              className="btn btn-glass btn-sm cinema-directions"
              href={directionsUrl(cinema)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation size={14} /> Get Directions
            </a>
          </div>
          <Link to="/credits" className="photo-credit">
            {cinema.photo.note?.startsWith("Representative")
              ? "Representative photo · "
              : ""}
            Photo: {cinema.photo.author}, {cinema.photo.license}
          </Link>
        </header>
        <figure className="cinema-lobby">
          <img
            src={sized(cinema.lobby, 960)}
            width={960}
            height={640}
            loading="lazy"
            decoding="async"
            alt={`Lobby and snack counter (${cinema.lobby.note ? "representative photo" : cinema.name})`}
          />
          <span className="cinema-lobby-label">Lobby and snack counter</span>
          {cinema.lobby.note?.startsWith("Representative") ? (
            <span className="photo-tag">Representative photo</span>
          ) : null}
        </figure>
      </div>

      <div className="screen-cards">
        {cinema.screens.map((s) => {
          const layout = getLayout(s.hallId);
          return (
            <div key={s.id} className="screen-card">
              <img
                src={`/halls/${s.hallId}-seat.jpg`}
                width={480}
                height={250}
                loading="lazy"
                decoding="async"
                alt={`${s.name}, seen from a back-row seat (3D render)`}
              />
              <div>
                <h2>{s.name}</h2>
                <p className="muted small">
                  {layout.config.format} · {layout.seats.length} seats ·{" "}
                  {layout.config.screen.width.toFixed(0)} m screen
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="day-strip" role="tablist" aria-label="Choose a day">
        {days.map((d) => (
          <button
            key={d.key}
            role="tab"
            aria-selected={d.key === dayKey}
            className={`day ${d.key === dayKey ? "on" : ""}`}
            onClick={() =>
              setParams(d.key === firstOpenDay ? {} : { day: d.key }, {
                replace: true,
              })
            }
          >
            <span>{d.weekday}</span>
            <b>{d.dayNum}</b>
            <span>{d.month}</span>
          </button>
        ))}
      </div>

      <div className="showtimes-tools">
        <p className="muted small showtimes-note">
          The number beside each time is the best view left for{" "}
          {party === 1 ? "one seat" : `${party} seats together`}, out of 100.
        </p>
        <PartyPicker />
      </div>

      <div className="venue-list">
        {listing.map(({ movie, groups }) => (
          <article key={movie.id} className="venue venue-movie">
            <Link
              to={`/movie/${movie.id}`}
              className="venue-poster"
              aria-label={movie.title}
            >
              <Poster movie={movie} />
            </Link>
            <div>
              <header className="venue-head">
                <h3>
                  <Link to={`/movie/${movie.id}`}>{movie.title}</Link>
                </h3>
                <p className="muted small">
                  {isLive(movie) ? `${KIND_LABEL[movie.kind]} · ` : ""}
                  {movie.language} · {movie.genres.slice(0, 2).join(", ")} ·{" "}
                  {formatRuntime(movie.runtime)}
                </p>
              </header>
              <div className="venue-screens">
                {groups.map((g) => (
                  <ShowTimes
                    key={g.screen.id}
                    cinema={cinema}
                    screenId={g.screen.id}
                    shows={g.shows}
                    party={party}
                    booked={booked}
                  />
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
