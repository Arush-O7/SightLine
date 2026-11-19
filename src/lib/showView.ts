import { useEffect, useState } from 'react';
import { api } from './api';
import { findBestSeats, getLayout, type Seat } from './hall';
import { crowdFor, fillLevel, type Show } from '../data/movies';

export interface ShowView {
  /** the best free seats that sit together for the group; empty when there are none */
  seats: Seat[];
  /** their average view score out of 100, or null when no seats are left together */
  score: number | null;
  fill: ReturnType<typeof fillLevel>;
}

/** What a group can still get at a show: the best seats left together, and how full it is. */
export function showView(show: Show, party: number, booked: readonly string[] = []): ShowView {
  const layout = getLayout(show.hallId);
  const taken = crowdFor(show, layout);
  for (const id of booked) taken.add(id);
  const seats = findBestSeats(layout, taken, party);
  const score = seats.length ? Math.round(seats.reduce((n, s) => n + layout.metrics[s.index].score, 0) / seats.length) : null;
  return { seats, score, fill: fillLevel(layout, taken) };
}

const CHUNK = 50;

/**
 * Seats booked or held on the site for a list of shows, refreshed every half minute.
 * Null until the first answer, so callers fall back to the simulated audience alone.
 */
export function useBookedSeats(showIds: string[]): Record<string, string[]> | null {
  const key = showIds.join(',');
  const [state, setState] = useState<{ key: string; seats: Record<string, string[]> } | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    const ids = key.split(',');
    const load = async () => {
      try {
        const parts = await Promise.all(
          Array.from({ length: Math.ceil(ids.length / CHUNK) }, (_, i) => api.availability(ids.slice(i * CHUNK, (i + 1) * CHUNK))),
        );
        if (live) setState({ key, seats: Object.assign({}, ...parts) });
      } catch {
        // offline: the listing keeps working from the simulated audience
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 30_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [key]);
  return state?.key === key ? state.seats : null;
}
