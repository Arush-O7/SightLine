import { useMemo, useState } from 'react';
import { artUrl } from '../lib/art';
import { useStore } from '../lib/store';
import type { Movie } from '../data/movies';

/** The official poster when the server has one, otherwise artwork painted for the movie. */
export function Poster({ movie, className = '', eager = false }: { movie: Movie; className?: string; eager?: boolean }) {
  const official = useStore((s) => s.media[movie.id]?.poster ?? null);
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
      alt={`${movie.title} poster`}
      draggable={false}
      onError={() => setBroken(true)}
    />
  );
}

export function Backdrop({ movie, className = '', priority = false }: { movie: Movie; className?: string; priority?: boolean }) {
  const official = useStore((s) => s.media[movie.id]?.backdrop ?? null);
  const [broken, setBroken] = useState(false);
  const painted = useMemo(() => (official && !broken ? '' : artUrl(movie, 'backdrop')), [movie, official, broken]);
  return (
    <img
      className={className}
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
