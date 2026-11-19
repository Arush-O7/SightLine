// Real Delhi cinemas. Their names and neighbourhoods are real; the auditorium
// layouts reuse SightLine's three hall models, so seat maps, showtimes and
// prices are illustrative, not the cinemas' own.
import { PHOTOS, type Photo } from './photos.js';

export interface Screen {
  id: string;
  name: string;
  /** which hall model (src/lib/hall.ts) this auditorium uses */
  hallId: 'h1' | 'h2' | 'h3';
}

export interface Cinema {
  id: string;
  name: string;
  chain: string;
  area: string;
  /** the building, or a representative photo when none is freely licensed */
  photo: Photo;
  /** the lobby and snack counter, where people wait before the show */
  lobby: Photo;
  screens: Screen[];
}

/** Directions in Google Maps, from wherever the visitor is. */
export const directionsUrl = (cinema: Pick<Cinema, 'name' | 'area'>) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cinema.name}, ${cinema.area}, Delhi`)}`;

export const CINEMAS: Cinema[] = [
  {
    id: 'pvr-select-citywalk',
    name: 'PVR Select Citywalk',
    chain: 'PVR INOX',
    area: 'Saket',
    photo: PHOTOS.selectCitywalk,
    lobby: PHOTOS.lobbyAmc,
    screens: [
      { id: 'a1', name: 'Audi 1', hallId: 'h2' },
      { id: 'a3', name: 'Audi 3', hallId: 'h1' },
      { id: 'a5', name: 'Audi 5', hallId: 'h3' },
    ],
  },
  {
    id: 'pvr-directors-cut',
    name: 'PVR Director’s Cut',
    chain: 'PVR INOX',
    area: 'Ambience Mall, Vasant Kunj',
    photo: PHOTOS.reclinerHall,
    lobby: PHOTOS.lobbyStar,
    screens: [
      { id: 'a1', name: 'Audi 1', hallId: 'h3' },
      { id: 'a2', name: 'Audi 2', hallId: 'h3' },
    ],
  },
  {
    id: 'cinepolis-dlf-avenue',
    name: 'Cinépolis DLF Avenue',
    chain: 'Cinépolis',
    area: 'Saket',
    photo: PHOTOS.dlfAvenue,
    lobby: PHOTOS.lobbyCinepolis,
    screens: [
      { id: 'a1', name: 'Audi 1', hallId: 'h2' },
      { id: 'a4', name: 'Audi 4', hallId: 'h1' },
      { id: 'a6', name: 'Audi 6', hallId: 'h3' },
    ],
  },
  {
    id: 'pvr-plaza',
    name: 'PVR Plaza',
    chain: 'PVR INOX',
    area: 'Connaught Place',
    photo: PHOTOS.pvrPlaza,
    lobby: PHOTOS.lobbyOdeon,
    screens: [{ id: 'a1', name: 'Audi 1', hallId: 'h1' }],
  },
  {
    id: 'inox-nehru-place',
    name: 'INOX Nehru Place',
    chain: 'PVR INOX',
    area: 'Nehru Place',
    photo: PHOTOS.nehruPlace,
    lobby: PHOTOS.lobbyShowcase,
    screens: [
      { id: 'a1', name: 'Audi 1', hallId: 'h1' },
      { id: 'a2', name: 'Audi 2', hallId: 'h3' },
    ],
  },
  {
    id: 'delite-cinema',
    name: 'Delite Cinema',
    chain: 'Independent',
    area: 'Asaf Ali Road, Daryaganj',
    photo: PHOTOS.singleScreen,
    lobby: PHOTOS.lobbyRetro,
    screens: [{ id: 'main', name: 'Main Hall', hallId: 'h2' }],
  },
  {
    id: 'pvr-pacific-mall',
    name: 'PVR Pacific Mall',
    chain: 'PVR INOX',
    area: 'Tagore Garden',
    photo: PHOTOS.pacificMall,
    lobby: PHOTOS.lobbyStarMain,
    screens: [
      { id: 'a2', name: 'Audi 2', hallId: 'h2' },
      { id: 'a4', name: 'Audi 4', hallId: 'h1' },
    ],
  },
  {
    id: 'pvr-vegas-dwarka',
    name: 'PVR Vegas',
    chain: 'PVR INOX',
    area: 'Dwarka',
    photo: PHOTOS.vegasMall,
    lobby: PHOTOS.lobbyAmcQueue,
    screens: [
      { id: 'a1', name: 'Audi 1', hallId: 'h2' },
      { id: 'a3', name: 'Audi 3', hallId: 'h1' },
      { id: 'a7', name: 'Audi 7', hallId: 'h3' },
    ],
  },
];

export const getCinema = (id: string | undefined) => CINEMAS.find((c) => c.id === id);

export const getScreen = (cinemaId: string | undefined, screenId: string | undefined) =>
  getCinema(cinemaId)?.screens.find((s) => s.id === screenId);
