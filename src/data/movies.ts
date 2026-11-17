import { hashString, mulberry32 } from '../lib/rng.js';
import type { HallLayout } from '../lib/hall';
import type { SceneKind } from '../lib/art';

export interface Movie {
  id: string;
  title: string;
  tagline: string;
  genres: string[];
  runtime: number;
  cert: string;
  rating: number;
  votes: string;
  language: string;
  director: string;
  cast: string[];
  synopsis: string;
  scene: SceneKind;
  titleFont: 'display' | 'serif';
  accent: string;
  featured?: boolean;
  schedule: { hallId: string; times: string[] }[];
}

/* All films, people and studios below are fictional, written for this demo. */
export const MOVIES: Movie[] = [
  {
    id: 'echoes-of-kepler',
    title: 'Echoes of Kepler',
    tagline: 'The signal was never meant for us.',
    genres: ['Sci-Fi', 'Adventure'],
    runtime: 148,
    cert: 'PG-13',
    rating: 8.7,
    votes: '41k',
    language: 'English',
    director: 'Mira Okonjo',
    cast: ['Dev Ashcroft', 'Lena Varga', 'Tomas Reyes', 'Yuki Tanabe'],
    synopsis:
      'When a deep-space relay starts repeating a message recorded forty years in the future, a salvage pilot and a disgraced linguist race to a ringed giant at the edge of the Kepler belt to find out who is calling — and why they sound so much like us.',
    scene: 'space',
    titleFont: 'display',
    accent: '#ff9d5c',
    featured: true,
    schedule: [
      { hallId: 'h2', times: ['10:30', '13:45', '17:00', '20:15', '23:20'] },
      { hallId: 'h3', times: ['12:00', '18:30', '21:45'] },
    ],
  },
  {
    id: 'neon-dynasty',
    title: 'Neon Dynasty',
    tagline: 'Every empire has an off switch.',
    genres: ['Action', 'Thriller'],
    runtime: 126,
    cert: 'R',
    rating: 8.1,
    votes: '28k',
    language: 'English',
    director: 'Kenji Marlowe',
    cast: ['Aria Solis', 'Marcus Thorne', 'Ines Duarte'],
    synopsis:
      'A getaway driver with one night left in the city takes a final job for the family that owns its skyline — and discovers the cargo in her back seat is the heir they have been hiding.',
    scene: 'neon',
    titleFont: 'display',
    accent: '#ff4d9d',
    featured: true,
    schedule: [
      { hallId: 'h2', times: ['11:15', '14:30', '21:30'] },
      { hallId: 'h1', times: ['16:10', '19:00', '22:40'] },
    ],
  },
  {
    id: 'saffron-skies',
    title: 'Saffron Skies',
    tagline: 'Some journeys only go up.',
    genres: ['Romance', 'Drama'],
    runtime: 117,
    cert: 'PG',
    rating: 7.9,
    votes: '19k',
    language: 'English · Hindi',
    director: 'Anaya Kapoor',
    cast: ['Rohan Mehra', 'Clara Benoit', 'Farah Siddiqui'],
    synopsis:
      'A cartographer who has never left her desert town and a balloon pilot who cannot stay in one place share a single week of the festival of winds, and a map neither of them expected to draw.',
    scene: 'desert',
    titleFont: 'serif',
    accent: '#ffb347',
    featured: true,
    schedule: [
      { hallId: 'h1', times: ['10:45', '13:30', '18:15'] },
      { hallId: 'h3', times: ['15:15', '20:00'] },
    ],
  },
  {
    id: 'the-last-lighthouse',
    title: 'The Last Lighthouse',
    tagline: 'It was never guiding ships.',
    genres: ['Mystery', 'Drama'],
    runtime: 133,
    cert: 'PG-13',
    rating: 8.3,
    votes: '22k',
    language: 'English',
    director: 'Eamon Hale',
    cast: ['Saoirse Flynn', 'Idris Cole', 'Greta Lund'],
    synopsis:
      'The new keeper of a decommissioned lighthouse finds forty years of log entries written in her own handwriting, each one warning her not to light the lamp.',
    scene: 'lighthouse',
    titleFont: 'serif',
    accent: '#7fd6d0',
    schedule: [
      { hallId: 'h1', times: ['11:30', '14:40', '20:45'] },
      { hallId: 'h3', times: ['17:20', '22:30'] },
    ],
  },
  {
    id: 'whisperwood',
    title: 'Whisperwood',
    tagline: 'The forest remembers your name.',
    genres: ['Fantasy', 'Family'],
    runtime: 104,
    cert: 'PG',
    rating: 8.0,
    votes: '33k',
    language: 'English',
    director: 'Odette Maris',
    cast: ['Pip Harrow', 'Noor El-Amin', 'Bram Okafor'],
    synopsis:
      'Sent to spend the summer with a grandfather she barely knows, eleven-year-old Wren follows a trail of fireflies into a wood where every tree keeps one secret — and one of them is hers.',
    scene: 'forest',
    titleFont: 'serif',
    accent: '#9be28a',
    schedule: [
      { hallId: 'h1', times: ['10:00', '12:20', '15:00', '17:30'] },
      { hallId: 'h2', times: ['12:45', '15:30'] },
    ],
  },
  {
    id: 'zero-meridian',
    title: 'Zero Meridian',
    tagline: 'Cross the line. Lose the day.',
    genres: ['Thriller', 'Sci-Fi'],
    runtime: 121,
    cert: 'PG-13',
    rating: 7.6,
    votes: '15k',
    language: 'English',
    director: 'Viktor Aalto',
    cast: ['Hana Lindqvist', 'Caleb Stone', 'Mateo Cruz'],
    synopsis:
      'A survey team mapping a glacier finds a perfectly straight line in the ice that nothing crosses twice. Then their youngest member walks over it to retrieve a dropped glove.',
    scene: 'alpine',
    titleFont: 'display',
    accent: '#ff5964',
    schedule: [
      { hallId: 'h2', times: ['18:10', '22:15'] },
      { hallId: 'h1', times: ['13:00', '21:50'] },
    ],
  },
  {
    id: 'midnight-at-the-orpheum',
    title: 'Midnight at the Orpheum',
    tagline: 'The last show never ends.',
    genres: ['Crime', 'Noir'],
    runtime: 139,
    cert: 'R',
    rating: 8.4,
    votes: '17k',
    language: 'English',
    director: 'Lucien Draper',
    cast: ['Vivienne Roche', 'Sam Calloway', 'Otis Brandt'],
    synopsis:
      'On the night a grand old movie palace is due to be demolished, its projectionist, a jewel thief and a detective three days from retirement are all locked inside with the same reel of film.',
    scene: 'noir',
    titleFont: 'display',
    accent: '#ff4d6a',
    schedule: [
      { hallId: 'h3', times: ['13:40', '19:10', '23:00'] },
      { hallId: 'h1', times: ['16:45', '23:15'] },
    ],
  },
  {
    id: 'tidebreakers',
    title: 'Tidebreakers',
    tagline: 'Chart your own horizon.',
    genres: ['Adventure', 'Family'],
    runtime: 112,
    cert: 'PG',
    rating: 7.8,
    votes: '26k',
    language: 'English',
    director: 'Paloma Reyes',
    cast: ['Kai Nakoa', 'Elodie Marsh', 'Jonah Pike'],
    synopsis:
      'Three cousins repair their late grandmother’s sailing boat to finish the voyage she never did — with a hand-drawn chart, a stubborn seagull and a storm that is two days ahead of the forecast.',
    scene: 'voyage',
    titleFont: 'display',
    accent: '#4fd1e0',
    schedule: [
      { hallId: 'h2', times: ['10:00', '16:20'] },
      { hallId: 'h1', times: ['11:00', '14:00', '19:30'] },
    ],
  },
];

export const GENRES = Array.from(new Set(MOVIES.flatMap((m) => m.genres)));

export const getMovie = (id: string | undefined) => MOVIES.find((m) => m.id === id);

const pad = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

export function parseDateKey(key: string): Date {
  return new Date(Number(key.slice(0, 4)), Number(key.slice(4, 6)) - 1, Number(key.slice(6, 8)));
}

export interface Day {
  key: string;
  date: Date;
  weekday: string;
  dayNum: string;
  month: string;
  isToday: boolean;
}

export function upcomingDays(count = 7): Day[] {
  const out: Day[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    out.push({
      key: dateKey(d),
      date: d,
      weekday: i === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' }),
      dayNum: String(d.getDate()),
      month: d.toLocaleDateString(undefined, { month: 'short' }),
      isToday: i === 0,
    });
  }
  return out;
}

export interface Show {
  id: string;
  movieId: string;
  hallId: string;
  dateKey: string;
  time: string;
  start: Date;
}

function makeShow(movieId: string, key: string, hallId: string, time: string): Show {
  const d = parseDateKey(key);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return { id: `${movieId}.${key}.${hallId}.${time.replace(':', '')}`, movieId, hallId, dateKey: key, time, start: d };
}

export function showsFor(movie: Movie, key: string): { hallId: string; shows: Show[] }[] {
  return movie.schedule.map((s) => ({
    hallId: s.hallId,
    shows: s.times.map((t) => makeShow(movie.id, key, s.hallId, t)),
  }));
}

export function parseShow(id: string | undefined): Show | null {
  if (!id) return null;
  const parts = id.split('.');
  if (parts.length !== 4) return null;
  const [movieId, key, hallId, hhmm] = parts;
  const movie = getMovie(movieId);
  if (!movie || !/^\d{8}$/.test(key) || !/^\d{4}$/.test(hhmm)) return null;
  const time = `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`;
  const slot = movie.schedule.find((s) => s.hallId === hallId);
  if (!slot || !slot.times.includes(time)) return null;
  return makeShow(movieId, key, hallId, time);
}

export function nextShow(movie: Movie): Show {
  const now = Date.now();
  for (const day of upcomingDays(3)) {
    const all = showsFor(movie, day.key)
      .flatMap((g) => g.shows)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const hit = all.find((s) => s.start.getTime() > now + 10 * 60 * 1000);
    if (hit) return hit;
  }
  return showsFor(movie, upcomingDays(2)[1].key)[0].shows[0];
}

export const formatTime = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const formatDate = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export const formatRuntime = (min: number) => `${Math.floor(min / 60)}h ${pad(min % 60)}m`;

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const money = (n: number) => currency.format(n);

/** convenience fee per ticket, in rupees */
export const BOOKING_FEE = 30;
export const MAX_SEATS = 8;

/**
 * A believable, repeatable crowd for a showtime: evening shows are busier,
 * better seats go first, and people arrive in groups that sit together.
 */
const crowdCache = new Map<string, Set<string>>();

/** Returns a fresh copy each time, so callers are free to add their own bookings to it. */
export function crowdFor(show: Show, layout: HallLayout): Set<string> {
  const cached = crowdCache.get(show.id);
  if (cached) return new Set(cached);
  const rng = mulberry32(hashString(show.id));
  const hour = show.start.getHours();
  const base = hour < 12 ? 0.16 : hour < 16 ? 0.26 : hour < 19 ? 0.4 : hour < 22 ? 0.56 : 0.34;
  const fill = base + (rng() - 0.5) * 0.16;
  const taken = new Set<string>();
  for (const row of layout.grid) {
    let c = 0;
    while (c < row.length) {
      const seat = row[c];
      const weight = 0.3 + 1.0 * Math.pow(layout.metrics[seat.index].score / 100, 1.6);
      if (rng() < fill * weight * 0.62) {
        const group = 1 + Math.floor(rng() * rng() * 4) + (rng() < 0.55 ? 1 : 0);
        let placed = 0;
        while (placed < group && c < row.length && row[c].block === seat.block) {
          taken.add(row[c].id);
          c++;
          placed++;
        }
      } else {
        c++;
      }
    }
  }
  crowdCache.set(show.id, taken);
  return new Set(taken);
}

export function fillLevel(show: Show, layout: HallLayout, extra = 0): { ratio: number; label: string; tone: 'ok' | 'warm' | 'hot' } {
  const ratio = (crowdFor(show, layout).size + extra) / layout.seats.length;
  if (ratio > 0.5) return { ratio, label: 'Almost full', tone: 'hot' };
  if (ratio > 0.3) return { ratio, label: 'Filling fast', tone: 'warm' };
  return { ratio, label: 'Available', tone: 'ok' };
}
