import { useStore } from './store';
import type { Movie } from '../data/movies';

/** The picture to show on the 3D screen: TMDB's backdrop for a movie, or a live show's photo. */
export function screenPhoto(movie: Movie): string | null {
  return useStore.getState().media[movie.id]?.backdrop ?? movie.photo?.src ?? null;
}
