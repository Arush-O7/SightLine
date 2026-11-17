// Official posters and backdrops from TMDB, used when TMDB_API_KEY (v3 key) or
// TMDB_READ_TOKEN (v4 token) is set. Results are cached for a few hours.
import { MOVIES } from '../src/data/movies.js';

const IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TTL = 6 * 60 * 60 * 1000;

export interface MovieMedia {
  poster: string | null;
  backdrop: string | null;
}

let cache: { at: number; media: Record<string, MovieMedia> } | null = null;
let pending: Promise<Record<string, MovieMedia>> | null = null;

export const tmdbConfigured = () => !!(process.env.TMDB_API_KEY?.trim() || process.env.TMDB_READ_TOKEN?.trim());

async function fetchOne(tmdbId: number): Promise<MovieMedia> {
  const key = process.env.TMDB_API_KEY?.trim();
  const token = process.env.TMDB_READ_TOKEN?.trim();
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}?language=en-US${key ? `&api_key=${encodeURIComponent(key)}` : ''}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const data = (await res.json()) as { poster_path?: string | null; backdrop_path?: string | null };
  return {
    poster: data.poster_path ? `${IMAGE_BASE}/w500${data.poster_path}` : null,
    backdrop: data.backdrop_path ? `${IMAGE_BASE}/w1280${data.backdrop_path}` : null,
  };
}

/** Poster and backdrop URLs by movie id; empty when TMDB is not configured or unreachable. */
export async function movieMedia(): Promise<Record<string, MovieMedia>> {
  if (!tmdbConfigured()) return {};
  if (cache && Date.now() - cache.at < TTL) return cache.media;
  pending ??= (async () => {
    const entries = await Promise.all(
      MOVIES.map(async (m) => {
        try {
          return [m.id, await fetchOne(m.tmdbId)] as const;
        } catch (err) {
          console.warn(`[tmdb] ${m.title}: ${(err as Error).message}`);
          return [m.id, { poster: null, backdrop: null }] as const;
        }
      }),
    );
    const media = Object.fromEntries(entries);
    cache = { at: Date.now(), media };
    return media;
  })().finally(() => {
    pending = null;
  });
  return pending;
}
