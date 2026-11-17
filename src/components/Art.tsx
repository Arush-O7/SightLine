import { useMemo } from 'react';
import { artUrl } from '../lib/art';
import type { Movie } from '../data/movies';

/* width/height match the painted canvas so the browser can reserve the space */
export function Poster({ movie, className = '', eager = false }: { movie: Movie; className?: string; eager?: boolean }) {
  const src = useMemo(() => artUrl(movie, 'poster'), [movie]);
  return (
    <img
      className={`poster ${className}`}
      src={src}
      width={560}
      height={840}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      alt={`${movie.title} poster`}
      draggable={false}
    />
  );
}

export function Backdrop({ movie, className = '', priority = false }: { movie: Movie; className?: string; priority?: boolean }) {
  const src = useMemo(() => artUrl(movie, 'backdrop'), [movie]);
  return (
    <img
      className={className}
      src={src}
      width={1680}
      height={840}
      fetchPriority={priority ? 'high' : 'auto'}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
