import { useMemo, useState } from 'react';
import { artUrl } from '../lib/art';
import { useStore } from '../lib/store';
import { sized } from '../data/photos';
import type { Movie } from '../data/movies';

/** The official poster (from TMDB when the server has a key, otherwise Wikipedia's copy), a live show's photo, or painted art. */
export function Poster({ movie, className = '', eager = false }: { movie: Movie; className?: string; eager?: boolean }) {
  const tmdb = useStore((s) => s.media[movie.id]?.poster ?? null);
  const official = tmdb ?? movie.poster?.src ?? (movie.photo ? sized(movie.photo, 960) : null);
  const [broken, setBroken] = useState(false);
  const painted = useMemo(() => (official && !broken ? '' : artUrl(movie, 'poster')), [movie, official, broken]);
  return (
    <img
      className={`poster ${className}`}
      src={official && !broken ? official : painted}
      width={560}
      height={840}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      alt={movie.photo && !tmdb && !movie.poster ? '' : `${movie.title} poster`}
      draggable={false}
      onError={() => setBroken(true)}
    />
  );
}

export function Backdrop({ movie, className = '', priority = false }: { movie: Movie; className?: string; priority?: boolean }) {
  const tmdb = useStore((s) => s.media[movie.id]?.backdrop ?? null);
  // without a wide backdrop, a movie's portrait poster is shown blurred to fill the space
  const fromPoster = !tmdb && !movie.photo && !!movie.poster;
  const official = tmdb ?? movie.photo?.src ?? movie.poster?.src ?? null;
  const [broken, setBroken] = useState(false);
  const painted = useMemo(() => (official && !broken ? '' : artUrl(movie, 'backdrop')), [movie, official, broken]);
  return (
    <img
      className={`${className}${fromPoster && !broken ? ' backdrop-poster' : ''}`}
      src={official && !broken ? official : painted}
      width={1680}
      height={840}
      fetchPriority={priority ? 'high' : 'auto'}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setBroken(true)}
    />
  );
}
