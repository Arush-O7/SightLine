import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, setSignedOutHandler, type Booking, type MovieMedia, type SiteConfig, type User } from './api';
import { MAX_SEATS } from '../data/movies';

export type { Booking, User };

interface Snapshot {
  seat: string;
  url: string;
}

interface State {
  /** null while signed out */
  user: User | null;
  /** false until the first "who am I" request has answered */
  authReady: boolean;
  /** what the server offers (demo tools, real email); null until it answers */
  config: SiteConfig | null;
  /** official posters by movie id, when the server has a TMDB key */
  media: Record<string, MovieMedia>;
  /** null until loaded for the signed-in user */
  bookings: Booking[] | null;
  selections: Record<string, string[]>;
  /** how many seats the visitor is booking together; showtimes and Pick for Me both use it */
  party: number;
  snapshots: Record<string, Snapshot>;

  initAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
  signOut: () => Promise<void>;
  loadBookings: () => Promise<void>;
  addBooking: (b: Booking) => void;
  removeBooking: (id: string) => void;

  toggleSeat: (showId: string, seatId: string) => void;
  setSeats: (showId: string, seatIds: string[]) => void;
  clearSelection: (showId: string) => void;
  setParty: (n: number | ((current: number) => number)) => void;
  setSnapshot: (showId: string, snap: Snapshot | null) => void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      user: null,
      authReady: false,
      config: null,
      media: {},
      bookings: null,
      selections: {},
      party: 2,
      snapshots: {},

      initAuth: async () => {
        api.config().then((config) => set({ config })).catch(() => {});
        api.media().then((media) => set({ media })).catch(() => {});
        try {
          const user = await api.me();
          set({ user, authReady: true });
          if (user) void get().loadBookings();
        } catch {
          // server unreachable: browsing still works, anything needing an account will say so
          set({ user: null, authReady: true });
        }
      },
      setUser: (user) => {
        set({ user, bookings: null });
        if (user) void get().loadBookings();
      },
      signOut: async () => {
        try {
          await api.logout();
        } finally {
          set({ user: null, bookings: null, snapshots: {} });
        }
      },
      loadBookings: async () => {
        try {
          set({ bookings: await api.bookings() });
        } catch {
          set({ bookings: [] });
        }
      },
      // replace rather than append, so a retried confirm can never list the same ticket twice
      addBooking: (b) => set((s) => ({ bookings: [{ ...b, snapshot: null }, ...(s.bookings ?? []).filter((x) => x.id !== b.id)] })),
      removeBooking: (id) => set((s) => ({ bookings: (s.bookings ?? []).filter((b) => b.id !== id) })),

      toggleSeat: (showId, seatId) =>
        set((s) => {
          const cur = s.selections[showId] ?? [];
          const next = cur.includes(seatId) ? cur.filter((x) => x !== seatId) : [...cur, seatId];
          return { selections: { ...s.selections, [showId]: next } };
        }),
      setSeats: (showId, seatIds) => set((s) => ({ selections: { ...s.selections, [showId]: seatIds } })),
      clearSelection: (showId) =>
        set((s) => {
          const { [showId]: _drop, ...rest } = s.selections;
          return { selections: rest };
        }),
      setParty: (n) => set((s) => ({ party: Math.min(MAX_SEATS, Math.max(1, Math.round(typeof n === 'function' ? n(s.party) : n) || 1)) })),
      setSnapshot: (showId, snap) =>
        set((s) => {
          const next = { ...s.snapshots };
          if (snap) next[showId] = snap;
          else delete next[showId];
          return { snapshots: next };
        }),
    }),
    {
      name: 'sightline',
      version: 2,
      // only the in-progress seat choice and group size are kept in the browser; accounts and bookings live on the server
      partialize: (s) => ({ selections: s.selections, party: s.party }),
      migrate: (persisted) => ({ selections: (persisted as { selections?: Record<string, string[]> })?.selections ?? {} }),
    },
  ),
);

// a request that finds the session gone flips the whole site to signed out
setSignedOutHandler(() => {
  if (useStore.getState().user) useStore.setState({ user: null, bookings: null });
});

/** natural seat order: A2 before A10 before B1 */
export function sortSeatIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => a[0].localeCompare(b[0]) || Number(a.slice(1)) - Number(b.slice(1)));
}
