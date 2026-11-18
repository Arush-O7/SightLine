import { CINEMAS } from "../data/cinemas";
import { EVENTS, MOVIES } from "../data/movies";
import type { Photo } from "../data/photos";
import { useTitle } from "../lib/useTitle";

function Credit({ label, photo }: { label: string; photo: Photo }) {
  return (
    <li>
      <span className="credit-label">{label}</span>
      <span className="muted">
        {photo.note ? `${photo.note}. ` : ""}Photo by {photo.author},{" "}
        {photo.license}, via{" "}
        <a href={photo.page} target="_blank" rel="noreferrer">
          Wikimedia Commons
        </a>
      </span>
    </li>
  );
}

export default function CreditsPage() {
  useTitle("Photo Credits");
  return (
    <div className="container section credits-page">
      <h1>Photo credits</h1>
      <p className="muted credits-intro">
        Photos of cinemas and live shows come from Wikimedia Commons under the
        licences listed. Pictures of auditoriums are rendered from SightLine’s
        own 3D models. Movie posters are the films’ official theatrical posters,
        from TMDB when the server has a TMDB key and otherwise from Wikipedia.
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
      <h2>Cinemas</h2>
      <ul className="credit-list">
        {CINEMAS.map((c) => (
          <Credit key={c.id} label={c.name} photo={c.photo} />
        ))}
      </ul>
      <h2>Lobbies and snack counters</h2>
      <ul className="credit-list">
        {CINEMAS.map((c) => (
          <Credit key={c.id} label={c.name} photo={c.lobby} />
        ))}
      </ul>
      <h2>Live shows</h2>
      <ul className="credit-list">
        {EVENTS.filter((e) => e.photo).map((e) => (
          <Credit key={e.id} label={e.title} photo={e.photo!} />
        ))}
      </ul>
      <h2>Movie posters</h2>
      <ul className="credit-list">
        {MOVIES.filter((m) => m.poster).map((m) => (
          <li key={m.id}>
            <span className="credit-label">{m.title}</span>
            <span className="muted">
              Theatrical release poster, © its studio and distributors, shown
              from{" "}
              <a href={m.poster!.page} target="_blank" rel="noreferrer">
                Wikipedia
              </a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
