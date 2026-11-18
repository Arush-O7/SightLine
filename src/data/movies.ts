import { hashString, mulberry32 } from '../lib/rng.js';
import type { HallLayout } from '../lib/hall';
import type { SceneKind } from '../lib/art';
import { CINEMAS, getCinema, type Cinema, type Screen } from './cinemas.js';
import { PHOTOS, type Photo } from './photos.js';

export type Kind = 'movie' | 'comedy' | 'music' | 'sports' | 'theatre';

export const KIND_LABEL: Record<Kind, string> = { movie: 'Movie', comedy: 'Comedy', music: 'Music', sports: 'Sports', theatre: 'Theatre' };

/** Anything that plays in an auditorium: a movie or a live show. */
export interface Movie {
  id: string;
  kind: Kind;
  /** The Movie Database id, used to load the official poster when a TMDB key is set */
  tmdbId?: number;
  /** a live show's photo; movies use TMDB artwork or painted art */
  photo?: Photo;
  /** the theatrical release poster as shown on Wikipedia, used when there is no TMDB key */
  poster?: { src: string; page: string };
  title: string;
  tagline: string;
  genres: string[];
  runtime: number;
  /** Indian certificate when known, otherwise empty */
  cert: string;
  language: string;
  director: string;
  cast: string[];
  synopsis: string;
  released: string;
  scene: SceneKind;
  titleFont: 'display' | 'serif';
  featured?: boolean;
}

const wiki = (path: string, page: string) => ({ src: `https://upload.wikimedia.org/wikipedia/en/${path}`, page: `https://en.wikipedia.org/wiki/${page}` });

// Titles, people and runtimes are from TMDB listings (November 2026); the
// summaries and taglines are written for SightLine.
export const MOVIES: Movie[] = [
  {
    id: 'ramayana-rise-of-a-legend',
    kind: 'movie',
    tmdbId: 656908,
    poster: wiki('4/48/Ramayana_Part_1_%28poster%29.jpg', 'Ramayana:_Part_1'),
    title: 'Ramayana: Rise of a Legend',
    tagline: 'Part one of the epic',
    genres: ['Mythology', 'Action', 'Drama'],
    runtime: 195,
    cert: '',
    language: 'Hindi',
    director: 'Nitesh Tiwari',
    cast: ['Ranbir Kapoor', 'Yash', 'Sai Pallavi', 'Ravi Dubey'],
    synopsis:
      'The first half of Nitesh Tiwari’s two-part retelling of the Ramayana follows Rama from Ayodhya into exile, and towards his collision with Ravana, King of Lanka.',
    released: '2026-11-05',
    scene: 'desert',
    titleFont: 'serif',
    featured: true,
  },
  {
    id: 'drishyam-the-conclusion',
    kind: 'movie',
    tmdbId: 1269325,
    poster: wiki('d/d9/Drishyam-_The_Conclusion_poster.jpg', 'Drishyam:_The_Conclusion'),
    title: 'Drishyam: The Conclusion',
    tagline: 'The last chapter of the case',
    genres: ['Crime', 'Thriller'],
    runtime: 150,
    cert: '',
    language: 'Hindi',
    director: '',
    cast: ['Ajay Devgn', 'Tabu', 'Jaideep Ahlawat', 'Shriya Saran'],
    synopsis:
      'Years after the case went quiet, new evidence puts Vijay Salgaonkar’s family back in the spotlight, and he has to outthink the investigation one final time.',
    released: '2026-10-02',
    scene: 'noir',
    titleFont: 'display',
    featured: true,
  },
  {
    id: 'jailer-2',
    kind: 'movie',
    tmdbId: 1234139,
    poster: wiki('d/dc/Jailer_2_poster.jpg', 'Jailer_2'),
    title: 'Jailer 2',
    tagline: 'Tiger is back',
    genres: ['Action', 'Comedy'],
    runtime: 165,
    cert: '',
    language: 'Tamil',
    director: 'Nelson Dilipkumar',
    cast: ['Rajinikanth', 'Ramya Krishnan', 'S. J. Suryah', 'Vidya Balan'],
    synopsis:
      'Retired jailer Tiger Muthuvel Pandian goes undercover as a driver when a crime syndicate comes after his family, and fights them from the shadows.',
    released: '2026-10-16',
    scene: 'neon',
    titleFont: 'display',
    featured: true,
  },
  {
    id: 'prahaar',
    kind: 'movie',
    tmdbId: 1081010,
    poster: wiki('a/a0/Prahaar-_The_Untold_Story_of_Ujjwal_Nikam_film_poster.jpg', 'Prahaar:_The_Untold_Story_of_Ujjwal_Nikam'),
    title: 'Prahaar: The Untold Story of Ujjwal Nikam',
    tagline: 'The prosecutor who took on 26/11',
    genres: ['Crime', 'Drama'],
    runtime: 141,
    cert: 'UA 16+',
    language: 'Hindi',
    director: 'Avinash Arun',
    cast: ['Rajkummar Rao', 'Wamiqa Gabbi', 'Jaideep Ahlawat', 'Sikandar Kher'],
    synopsis:
      'Public prosecutor Ujjwal Nikam leads the case against Ajmal Kasab after the 26/11 Mumbai attacks, one of the most closely watched trials in India.',
    released: '2026-10-16',
    scene: 'lighthouse',
    titleFont: 'serif',
  },
  {
    id: 'i-play-rocky',
    kind: 'movie',
    tmdbId: 1286656,
    poster: wiki('5/5e/I_Play_Rocky_poster.png', 'I_Play_Rocky'),
    title: 'I Play Rocky',
    tagline: 'He wrote it. He had to play it.',
    genres: ['Drama', 'Biography'],
    runtime: 128,
    cert: '',
    language: 'English',
    director: 'Peter Farrelly',
    cast: ['Anthony Ippolito', 'AnnaSophia Robb', 'Toby Kebbell', 'P. J. Byrne'],
    synopsis:
      'An unknown actor writes Rocky and refuses to sell the script unless he plays the lead himself. The true story of how Sylvester Stallone got his film made.',
    released: '2026-11-13',
    scene: 'alpine',
    titleFont: 'display',
  },
  {
    id: 'wildwood',
    kind: 'movie',
    tmdbId: 791523,
    poster: wiki('a/aa/Wildwood_2026_poster.jpg', 'Wildwood_(film)'),
    title: 'Wildwood',
    tagline: 'From the makers of Coraline',
    genres: ['Animation', 'Fantasy', 'Adventure'],
    runtime: 132,
    cert: '',
    language: 'English',
    director: 'Travis Knight',
    cast: ['Peyton Elizabeth Lee', 'Jacob Tremblay', 'Carey Mulligan', 'Mahershala Ali'],
    synopsis:
      'When crows carry off her baby brother, Prue follows them into the forbidden forest outside Portland, a world of talking animals, rival kingdoms and old magic.',
    released: '2026-11-13',
    scene: 'forest',
    titleFont: 'serif',
  },
  {
    id: 'the-cat-in-the-hat',
    kind: 'movie',
    tmdbId: 1117898,
    poster: wiki('e/e4/The_Cat_in_the_Hat_%282026_film_poster%29.png', 'The_Cat_in_the_Hat_(2026_film)'),
    title: 'The Cat in the Hat',
    tagline: 'A very rainy day',
    genres: ['Animation', 'Family', 'Comedy'],
    runtime: 108,
    cert: '',
    language: 'English',
    director: 'Erica Rivinoja, Alessandro Carloni',
    cast: ['Bill Hader', 'Xochitl Gomez', 'Quinta Brunson', 'Bowen Yang'],
    synopsis:
      'Two siblings who have just moved to a new town get an unexpected visitor: a cat in a hat who is very good at cheering people up and very bad at keeping the house tidy.',
    released: '2026-11-06',
    scene: 'voyage',
    titleFont: 'display',
  },
];

// Live shows staged in the cinemas' auditoriums. These are illustrative: the
// formats are real, but the titles and line-ups are written for SightLine.
export const EVENTS: Movie[] = [
  {
    id: 'delhi-comedy-night',
    kind: 'comedy',
    title: 'Delhi Comedy Night',
    tagline: 'Five comics, one mic',
    genres: ['Stand-up'],
    runtime: 100,
    cert: 'A',
    language: 'Hindi, English',
    director: '',
    cast: ['A host and four stand-up comics, new line-up every night'],
    synopsis: 'An evening of stand-up in Hindi and English about Delhi traffic, Delhi weddings and Delhi parents. Every night has a different line-up of club comics and one surprise headliner.',
    released: '2026-11-01',
    scene: 'neon',
    titleFont: 'display',
    photo: PHOTOS.comedyStage,
  },
  {
    id: 'bollywood-live',
    kind: 'music',
    title: 'Bollywood Live: The Big Band',
    tagline: 'Three decades of hits, played live',
    genres: ['Live music', 'Bollywood'],
    runtime: 150,
    cert: 'U',
    language: 'Hindi',
    director: '',
    cast: ['A 12-piece band with four singers'],
    synopsis: 'A twelve-piece band and four singers work through film songs from the nineties to now, with the cinema sound system turned all the way up. Singing along is encouraged.',
    released: '2026-11-07',
    scene: 'neon',
    titleFont: 'display',
    photo: PHOTOS.concertCrowd,
  },
  {
    id: 'symphony-of-cinema',
    kind: 'music',
    title: 'The Symphony of Cinema',
    tagline: 'Film scores, played by a full orchestra',
    genres: ['Orchestra', 'Film music'],
    runtime: 120,
    cert: 'U',
    language: 'Instrumental',
    director: '',
    cast: ['A 40-piece chamber orchestra and conductor'],
    synopsis: 'A chamber orchestra plays the scores of Indian and world cinema while scenes from the films run on the screen behind them, from classic title themes to recent soundtracks.',
    released: '2026-11-14',
    scene: 'space',
    titleFont: 'serif',
    photo: PHOTOS.concertHall,
  },
  {
    id: 'jazz-after-dark',
    kind: 'music',
    title: 'Jazz After Dark',
    tagline: 'A late set in the recliners',
    genres: ['Jazz'],
    runtime: 90,
    cert: 'U',
    language: 'Instrumental',
    director: '',
    cast: ['A saxophone-led quartet'],
    synopsis: 'A quartet plays standards and a few Hindi film tunes rearranged as jazz, in the smallest auditorium with the lights down low.',
    released: '2026-11-10',
    scene: 'noir',
    titleFont: 'serif',
    photo: PHOTOS.saxophone,
  },
  {
    id: 'cricket-night-live',
    kind: 'sports',
    title: 'Cricket Night, Live',
    tagline: 'Every evening match on the big screen',
    genres: ['Cricket', 'Live screening'],
    runtime: 210,
    cert: 'U',
    language: 'Hindi, English',
    director: '',
    cast: ['Live broadcast with Hindi and English commentary'],
    synopsis: 'The evening’s international or league match shown live on the largest screen in the building, with stadium-level sound and a full food menu at your seat.',
    released: '2026-11-01',
    scene: 'alpine',
    titleFont: 'display',
    photo: PHOTOS.stadiumNight,
  },
  {
    id: 'weekend-cricket-live',
    kind: 'sports',
    title: 'Weekend Cricket, Live',
    tagline: 'Day matches, from the first ball',
    genres: ['Cricket', 'Live screening'],
    runtime: 240,
    cert: 'U',
    language: 'Hindi, English',
    director: '',
    cast: ['Live broadcast with Hindi and English commentary'],
    synopsis: 'Weekend day matches shown live from the first ball, with the house lights half up so you can see your food.',
    released: '2026-11-01',
    scene: 'desert',
    titleFont: 'display',
    photo: PHOTOS.stadiumDay,
  },
  {
    id: 'the-last-train-from-daryaganj',
    kind: 'theatre',
    title: 'The Last Train from Daryaganj',
    tagline: 'A play in one act',
    genres: ['Drama', 'Play'],
    runtime: 110,
    cert: 'UA 13+',
    language: 'Hindi',
    director: '',
    cast: ['An ensemble of six actors'],
    synopsis: 'On the night the old cinema on Asaf Ali Road closes for good, its projectionist, its ticket seller and a stranger with a reel of lost film wait for a train that may not come.',
    released: '2026-11-08',
    scene: 'lighthouse',
    titleFont: 'serif',
    photo: PHOTOS.stageSet,
  },
];

/** Movies and live shows together. */
export const TITLES: Movie[] = [...MOVIES, ...EVENTS];

/** The movies' languages, including any a cinema has added. */
export const languages = () => Array.from(new Set(MOVIES.map((m) => m.language)));
export const EVENT_KINDS: Kind[] = ['comedy', 'music', 'sports', 'theatre'];

// the built-in programme only ever rotates these, so adding a title never moves existing showtimes
const BASE_MOVIES = [...MOVIES];
const BASE_EVENTS = [...EVENTS];
const BASE_IDS = new Set([...BASE_MOVIES, ...BASE_EVENTS].map((t) => t.id));
export const isCustomTitle = (id: string) => !BASE_IDS.has(id);

/** A movie or live show added by cinema staff, as stored on the server. */
export interface TitleRecord {
  id: string;
  kind: Kind;
  title: string;
  tagline: string;
  genres: string[];
  runtime: number;
  cert: string;
  language: string;
  director: string;
  cast: string[];
  synopsis: string;
  released: string;
  /** a poster or photo on upload.wikimedia.org or image.tmdb.org, or empty for painted art */
  image: string;
}

const KIND_SCENE: Record<Kind, SceneKind> = { movie: 'voyage', comedy: 'neon', music: 'neon', sports: 'alpine', theatre: 'lighthouse' };

export function titleFromRecord(r: TitleRecord): Movie {
  const image = r.image || undefined;
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    tagline: r.tagline,
    genres: r.genres,
    runtime: r.runtime,
    cert: r.cert,
    language: r.language,
    director: r.director,
    cast: r.cast,
    synopsis: r.synopsis,
    released: r.released,
    scene: KIND_SCENE[r.kind],
    titleFont: 'display',
    poster: image && r.kind === 'movie' ? { src: image, page: image } : undefined,
    photo: image && r.kind !== 'movie' ? { src: image, author: '', license: '', page: image } : undefined,
  };
}

/** Adds the titles cinema staff created to the movie and live show lists. */
export function setCustomTitles(records: TitleRecord[]) {
  const added = records.map(titleFromRecord);
  MOVIES.splice(0, MOVIES.length, ...BASE_MOVIES, ...added.filter((t) => t.kind === 'movie'));
  EVENTS.splice(0, EVENTS.length, ...BASE_EVENTS, ...added.filter((t) => t.kind !== 'movie'));
  TITLES.splice(0, TITLES.length, ...MOVIES, ...EVENTS);
  programmeCache.clear();
  popularityCache.clear();
}

export const getMovie = (id: string | undefined) => TITLES.find((m) => m.id === id);
export const isLive = (m: Movie) => m.kind !== 'movie';

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
  cinemaId: string;
  screenId: string;
  /** hall model used by the auditorium */
  hallId: string;
  dateKey: string;
  time: string;
  start: Date;
}

const programmeCache = new Map<string, { time: string; movieId: string }[]>();
const SCREEN_SLOTS = new Map(CINEMAS.flatMap((c) => c.screens.map((s) => `${c.id}|${s.id}`)).map((k, i) => [k, i]));

/** Which hall models suit each live show, and which only run at weekends (as day events). */
const EVENT_HALLS: Record<string, string[]> = {
  'delhi-comedy-night': ['h1', 'h3'],
  'bollywood-live': ['h1', 'h2'],
  'symphony-of-cinema': ['h2'],
  'jazz-after-dark': ['h3'],
  'cricket-night-live': ['h2', 'h1'],
  'weekend-cricket-live': ['h2'],
  'the-last-train-from-daryaganj': ['h1', 'h3'],
};
const DAY_EVENTS = new Set(['weekend-cricket-live']);

/** An admin's change to the generated programme: an extra show, or a cancelled one. */
export interface ScheduleChange {
  action: 'add' | 'cancel';
  movieId: string;
  cinemaId: string;
  screenId: string;
  dateKey: string;
  time: string;
}

let scheduleChanges: ScheduleChange[] = [];

/** Applies the admin's changes everywhere shows are listed or checked. */
export function setScheduleChanges(changes: ScheduleChange[]) {
  scheduleChanges = changes;
  programmeCache.clear();
  popularityCache.clear();
}
export const getScheduleChanges = () => scheduleChanges;

const toTime = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/**
 * One auditorium's day, run like a real cinema: two titles alternate (the bigger
 * release more often), each show starting after the last one ends plus cleaning time.
 * On some days the evening slot goes to a live show instead.
 */
function baseProgramme(cinema: Cinema, screen: Screen, key: string): { time: string; movieId: string }[] {
  const rng = mulberry32(hashString(`${cinema.id}|${screen.id}|${key}`));
  // every auditorium in the city gets a slot number, so the smaller releases are spread across all of them
  const slot = SCREEN_SLOTS.get(`${cinema.id}|${screen.id}`) ?? 0;
  const day = Number(key.slice(6, 8));
  const weekend = [0, 6].includes(parseDateKey(key).getDay());
  const headliners = BASE_MOVIES.filter((m) => m.featured);
  const rest = BASE_MOVIES.filter((m) => !m.featured);
  const lead = headliners[(slot + day) % headliners.length];
  const second = rest[(slot + day * 3) % rest.length];
  const pattern = rng() < 0.5 ? [lead, second, lead, lead, second] : [lead, lead, second, lead, second];

  const suited = BASE_EVENTS.filter((e) => EVENT_HALLS[e.id]?.includes(screen.hallId) && (weekend || !DAY_EVENTS.has(e.id)));
  const event = suited.length && (slot * 5 + day * 3) % 7 < 3 ? suited[(slot + day) % suited.length] : null;
  const eventFrom = event && DAY_EVENTS.has(event.id) ? 13 * 60 + 30 : 18 * 60 + 15;

  let minutes = 9 * 60 + 30 + Math.floor(rng() * 6) * 10;
  let placed = false;
  let i = 0;
  const out: { time: string; movieId: string }[] = [];
  while (minutes <= 22 * 60 + 45) {
    const title = event && !placed && minutes >= eventFrom ? event : pattern[i++ % pattern.length];
    if (title === event) placed = true;
    out.push({ time: toTime(minutes), movieId: title.id });
    minutes += title.runtime + (isLive(title) ? 30 : 20) + Math.floor(rng() * 3) * 5;
    minutes = Math.ceil(minutes / 5) * 5;
  }
  return out;
}

function programme(cinema: Cinema, screen: Screen, key: string): { time: string; movieId: string }[] {
  const cacheKey = `${cinema.id}|${screen.id}|${key}`;
  const hit = programmeCache.get(cacheKey);
  if (hit) return hit;
  let out = baseProgramme(cinema, screen, key);
  const here = scheduleChanges.filter((c) => c.cinemaId === cinema.id && c.screenId === screen.id && c.dateKey === key);
  if (here.length) {
    const cancelled = new Set(here.filter((c) => c.action === 'cancel').map((c) => `${c.movieId}@${c.time}`));
    out = out.filter((p) => !cancelled.has(`${p.movieId}@${p.time}`));
    for (const c of here) if (c.action === 'add' && !cancelled.has(`${c.movieId}@${c.time}`)) out.push({ time: c.time, movieId: c.movieId });
    out.sort((a, b) => a.time.localeCompare(b.time));
  }
  programmeCache.set(cacheKey, out);
  return out;
}

/** The generated show, before any admin changes; used to tell added shows from regular ones. */
export const isRegularShow = (cinema: Cinema, screen: Screen, key: string, time: string, movieId: string) =>
  baseProgramme(cinema, screen, key).some((p) => p.time === time && p.movieId === movieId);

/** Every show on one auditorium's day, with the admin's cancelled ones still listed. */
export function screenDay(cinema: Cinema, screen: Screen, key: string): { show: Show; cancelled: boolean; added: boolean }[] {
  const base = baseProgramme(cinema, screen, key);
  const live = programme(cinema, screen, key);
  const key2 = (p: { time: string; movieId: string }) => `${p.movieId}@${p.time}`;
  const liveKeys = new Set(live.map(key2));
  const baseKeys = new Set(base.map(key2));
  const all = [...base, ...live.filter((p) => !baseKeys.has(key2(p)))].sort((a, b) => a.time.localeCompare(b.time));
  return all.map((p) => ({
    show: makeShow(p.movieId, key, cinema, screen, p.time),
    cancelled: !liveKeys.has(key2(p)),
    added: !baseKeys.has(key2(p)),
  }));
}

function makeShow(movieId: string, key: string, cinema: Cinema, screen: Screen, time: string): Show {
  const d = parseDateKey(key);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return {
    id: `${movieId}.${key}.${cinema.id}~${screen.id}.${time.replace(':', '')}`,
    movieId,
    cinemaId: cinema.id,
    screenId: screen.id,
    hallId: screen.hallId,
    dateKey: key,
    time,
    start: d,
  };
}

export interface ShowGroup {
  cinemaId: string;
  screenId: string;
  hallId: string;
  shows: Show[];
}

/** Every screening of a movie on a day, grouped by cinema and auditorium. */
export function showsFor(movie: Movie, key: string): ShowGroup[] {
  const out: ShowGroup[] = [];
  for (const cinema of CINEMAS) {
    for (const screen of cinema.screens) {
      const shows = programme(cinema, screen, key)
        .filter((p) => p.movieId === movie.id)
        .map((p) => makeShow(movie.id, key, cinema, screen, p.time));
      if (shows.length) out.push({ cinemaId: cinema.id, screenId: screen.id, hallId: screen.hallId, shows });
    }
  }
  return out;
}

/** Everything a cinema shows on a day, by movie. */
export function showsAt(cinema: Cinema, key: string): { movie: Movie; groups: { screen: Screen; shows: Show[] }[] }[] {
  return TITLES
    .map((movie) => ({
      movie,
      groups: cinema.screens
        .map((screen) => ({
          screen,
          shows: programme(cinema, screen, key)
            .filter((p) => p.movieId === movie.id)
            .map((p) => makeShow(movie.id, key, cinema, screen, p.time)),
        }))
        .filter((g) => g.shows.length),
    }))
    .filter((m) => m.groups.length);
}

export function parseShow(id: string | undefined): Show | null {
  if (!id) return null;
  const parts = id.split('.');
  if (parts.length !== 4) return null;
  const [movieId, key, venue, hhmm] = parts;
  const [cinemaId, screenId] = venue.split('~');
  const movie = getMovie(movieId);
  const cinema = getCinema(cinemaId);
  const screen = cinema?.screens.find((s) => s.id === screenId);
  if (!movie || !cinema || !screen || !/^\d{8}$/.test(key) || !/^\d{4}$/.test(hhmm)) return null;
  const time = `${hhmm.slice(0, 2)}:${hhmm.slice(2)}`;
  if (!programme(cinema, screen, key).some((p) => p.time === time && p.movieId === movieId)) return null;
  return makeShow(movieId, key, cinema, screen, time);
}

/** The next show of a movie that can still be booked, anywhere. */
export function nextShow(movie: Movie): Show {
  const soon = Date.now() + 10 * 60 * 1000;
  for (const day of upcomingDays(3)) {
    const all = showsFor(movie, day.key)
      .flatMap((g) => g.shows)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const hit = all.find((s) => s.start.getTime() > soon);
    if (hit) return hit;
  }
  return showsFor(movie, upcomingDays(2)[1].key)[0].shows[0];
}

/** The soonest show still to start in the coming days, or null when there is none. */
export function nextShowWithin(movie: Movie, days = 7): Show | null {
  const soon = Date.now() + 10 * 60 * 1000;
  for (const day of upcomingDays(days)) {
    const hit = showsFor(movie, day.key)
      .flatMap((g) => g.shows)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .find((s) => s.start.getTime() > soon);
    if (hit) return hit;
  }
  return null;
}

/** Cinema name and auditorium for a show, e.g. "PVR Select Citywalk, Saket · Audi 3". */
export function venueOf(show: Pick<Show, 'cinemaId' | 'screenId'>): { cinema: Cinema; screen: Screen } | null {
  const cinema = getCinema(show.cinemaId);
  const screen = cinema?.screens.find((s) => s.id === show.screenId);
  return cinema && screen ? { cinema, screen } : null;
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

const popularityCache = new Map<string, Map<string, number>>();

export const POPULAR_WEEKS = 4;

/**
 * How often each seat of a hall model was booked over the last four weeks, from 0
 * to 1. Every cinema auditorium built on the same model counts.
 */
export function seatPopularity(hallId: string, layout: HallLayout): Map<string, number> {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const cacheKey = `${hallId}|${dateKey(today)}`;
  const hit = popularityCache.get(cacheKey);
  if (hit) return hit;
  const counts = new Map<string, number>();
  let total = 0;
  for (let back = 1; back <= POPULAR_WEEKS * 7; back++) {
    const key = dateKey(new Date(today.getTime() - back * 86400000));
    for (const cinema of CINEMAS) {
      for (const screen of cinema.screens) {
        if (screen.hallId !== hallId) continue;
        for (const p of programme(cinema, screen, key)) {
          total++;
          for (const id of crowdFor(makeShow(p.movieId, key, cinema, screen, p.time), layout)) counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
    }
  }
  const share = new Map<string, number>();
  for (const seat of layout.seats) share.set(seat.id, total ? (counts.get(seat.id) ?? 0) / total : 0);
  popularityCache.set(cacheKey, share);
  return share;
}

/** The most booked seats of a hall model: about one in sixteen, at least six. */
export function popularSeats(hallId: string, layout: HallLayout): Set<string> {
  const share = seatPopularity(hallId, layout);
  const count = Math.max(6, Math.round(layout.seats.length / 16));
  return new Set([...share].sort((a, b) => b[1] - a[1]).slice(0, count).map(([id]) => id));
}
