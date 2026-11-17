import { clamp } from './rng.js';

// Hall definitions. Everything is in metres; the screen sits on z = 0 and
// the audience looks towards -z.

export interface Zone {
  id: string;
  name: string;
  price: number;
  fromRow: number;
  toRow: number;
  blurb: string;
}

export interface HallConfig {
  id: string;
  name: string;
  format: string;
  badge: string;
  blurb: string;
  sound: string;
  projection: string;
  screen: { width: number; height: number; bottom: number; curve: number };
  rows: number;
  blocks: number[];
  seatPitch: number;
  rowPitch: number;
  riser: number;
  firstRowZ: number;
  aisle: number;
  seatScale: [number, number];
  zones: Zone[];
}

export interface Seat {
  id: string;
  index: number;
  row: number;
  col: number;
  block: number;
  rowLabel: string;
  number: number;
  x: number;
  y: number;
  z: number;
  zone: Zone;
  accessible: boolean;
}

export interface ViewMetrics {
  /** straight-line distance from eyes to screen centre */
  distance: number;
  /** horizontal angle the screen fills in your vision (degrees) */
  hAngle: number;
  /** how far you look up (+) or down (-) to the screen centre (degrees) */
  elevation: number;
  /** how far off the centre line you sit (degrees) */
  offAxis: number;
  score: number;
  label: string;
  hint: string;
}

export interface HallLayout {
  config: HallConfig;
  seats: Seat[];
  byId: Map<string, Seat>;
  grid: Seat[][];
  metrics: ViewMetrics[];
  /** view scores grouped by row; stable arrays so memoised rows can compare them by reference */
  rowScores: number[][];
  perRow: number;
  width: number;
  height: number;
  zFront: number;
  zBack: number;
  rowsY: number[];
  rowsZ: number[];
  aisleXs: number[];
  sideAisleWidth: number;
  seatsWidth: number;
  screenCenter: [number, number, number];
  bestSeatId: string;
}

export const HALLS: HallConfig[] = [
  {
    id: 'h1',
    name: 'Hall 1',
    format: 'Laser',
    badge: '4K Laser',
    blurb: 'Our all-rounder. Stadium seating, a 14-metre scope screen and razor-sharp 4K laser projection.',
    sound: 'Dolby 7.1 surround',
    projection: '4K RGB laser',
    screen: { width: 14.4, height: 6.0, bottom: 1.7, curve: 0.004 },
    rows: 12,
    blocks: [4, 10, 4],
    seatPitch: 0.62,
    rowPitch: 1.18,
    riser: 0.36,
    firstRowZ: 6.6,
    aisle: 1.25,
    seatScale: [1, 1],
    zones: [
      { id: 'value', name: 'Front', price: 180, fromRow: 0, toRow: 2, blurb: 'Closest to the action' },
      { id: 'classic', name: 'Classic', price: 240, fromRow: 3, toRow: 6, blurb: 'Balanced, great value' },
      { id: 'prime', name: 'Prime', price: 300, fromRow: 7, toRow: 11, blurb: 'The sweet-spot rows' },
    ],
  },
  {
    id: 'h2',
    name: 'Hall 2',
    format: 'XL',
    badge: 'XL Screen',
    blurb: 'The big one. A 21-metre wall-to-wall curved screen, dual laser projection and 360 seats.',
    sound: 'Dolby Atmos · 48 speakers',
    projection: 'Dual 4K laser',
    screen: { width: 21, height: 8.8, bottom: 1.9, curve: 0.0035 },
    rows: 15,
    blocks: [5, 14, 5],
    seatPitch: 0.62,
    rowPitch: 1.2,
    riser: 0.42,
    firstRowZ: 9,
    aisle: 1.3,
    seatScale: [1, 1],
    zones: [
      { id: 'value', name: 'Front', price: 250, fromRow: 0, toRow: 3, blurb: 'Closest to the action' },
      { id: 'classic', name: 'Classic', price: 340, fromRow: 4, toRow: 8, blurb: 'Balanced, great value' },
      { id: 'prime', name: 'Prime', price: 420, fromRow: 9, toRow: 14, blurb: 'The sweet-spot rows' },
    ],
  },
  {
    id: 'h3',
    name: 'Hall 3',
    format: 'Lounge',
    badge: 'Lounge',
    blurb: 'Sixty powered recliners, nearly two metres of legroom per row and at-seat service.',
    sound: 'Dolby Atmos',
    projection: '4K laser',
    screen: { width: 10.5, height: 4.4, bottom: 1.5, curve: 0.003 },
    rows: 6,
    blocks: [2, 6, 2],
    seatPitch: 1.0,
    rowPitch: 1.95,
    riser: 0.4,
    firstRowZ: 5.6,
    aisle: 1.3,
    seatScale: [1.5, 1.45],
    zones: [
      { id: 'recliner', name: 'Recliner', price: 550, fromRow: 0, toRow: 1, blurb: 'Full recline, up close' },
      { id: 'reclinerPrime', name: 'Recliner Prime', price: 700, fromRow: 2, toRow: 5, blurb: 'Best sightlines in the lounge' },
    ],
  },
];

export const EYE_HEIGHT = 1.14;
const ROW_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O, like real auditoriums

const deg = (r: number) => (r * 180) / Math.PI;

function scoreView(hAngle: number, elevation: number, offAxis: number) {
  const sH = Math.exp(-Math.pow((hAngle - 50) / (hAngle < 50 ? 20 : 22), 2));
  const e = Math.max(0, Math.abs(elevation) - 8);
  const sV = Math.exp(-Math.pow(e / 12, 2));
  const sO = Math.exp(-Math.pow(offAxis / 28, 2));
  return Math.round(100 * (0.45 * sH + 0.25 * sV + 0.3 * sO));
}

function describe(score: number, hAngle: number, elevation: number, offAxis: number) {
  const label =
    score >= 92 ? 'Best in the house' : score >= 80 ? 'Excellent' : score >= 66 ? 'Great' : score >= 50 ? 'Good' : 'Fair';
  let hint: string;
  if (hAngle > 78) hint = 'Very close — a huge, immersive image, but you will be looking up and scanning the screen.';
  else if (elevation > 16) hint = 'Close to the screen. Expect to tilt your head back a little.';
  else if (offAxis > 20) hint = 'Off to the side — the picture is slightly angled from here.';
  else if (hAngle > 60) hint = 'Up close and immersive — the screen wraps well into your peripheral vision.';
  else if (hAngle < 40) hint = 'Further back — a relaxed view with the whole screen in sight at a glance.';
  else if (offAxis > 11) hint = 'Comfortable distance, slightly off-centre.';
  else hint = 'The sweet spot — the screen fills your vision without any head movement.';
  return { label, hint };
}

export function seatEye(seat: Seat): [number, number, number] {
  return [seat.x, seat.y + EYE_HEIGHT, seat.z + 0.1];
}

export function buildLayout(config: HallConfig): HallLayout {
  const { blocks, seatPitch, aisle, rows, rowPitch, riser, firstRowZ, screen } = config;
  const perRow = blocks.reduce((a, b) => a + b, 0);
  const seatsWidth = perRow * seatPitch + (blocks.length - 1) * aisle;
  const width = Math.max(seatsWidth + 2.7, screen.width + 2.6);
  const sideAisleWidth = (width - seatsWidth) / 2;

  const cols: { x: number; block: number }[] = [];
  const aisleXs: number[] = [-(seatsWidth / 2 + sideAisleWidth / 2)];
  let cursor = -seatsWidth / 2;
  blocks.forEach((n, b) => {
    for (let i = 0; i < n; i++) {
      cols.push({ x: cursor + seatPitch / 2, block: b });
      cursor += seatPitch;
    }
    if (b < blocks.length - 1) {
      aisleXs.push(cursor + aisle / 2);
      cursor += aisle;
    }
  });
  aisleXs.push(seatsWidth / 2 + sideAisleWidth / 2);

  const rowsY: number[] = [];
  const rowsZ: number[] = [];
  for (let r = 0; r < rows; r++) {
    rowsY.push(r * riser);
    rowsZ.push(firstRowZ + r * rowPitch);
  }

  const zFront = -0.9;
  const zBack = rowsZ[rows - 1] + rowPitch / 2 + 1.7;
  const height = Math.max(screen.bottom + screen.height + 1.15, rowsY[rows - 1] + 3.15);
  const screenCenter: [number, number, number] = [0, screen.bottom + screen.height / 2, 0];

  const seats: Seat[] = [];
  const grid: Seat[][] = [];
  const byId = new Map<string, Seat>();
  for (let r = 0; r < rows; r++) {
    const zone = config.zones.find((z) => r >= z.fromRow && r <= z.toRow) ?? config.zones[0];
    const rowLabel = ROW_LETTERS[r];
    const line: Seat[] = [];
    cols.forEach((c, i) => {
      const accessible = r === rows - 1 && (i < 2 || i >= perRow - 2);
      const seat: Seat = {
        id: `${rowLabel}${i + 1}`,
        index: seats.length,
        row: r,
        col: i,
        block: c.block,
        rowLabel,
        number: i + 1,
        x: c.x,
        y: rowsY[r],
        z: rowsZ[r] + 0.08,
        zone,
        accessible,
      };
      seats.push(seat);
      line.push(seat);
      byId.set(seat.id, seat);
    });
    grid.push(line);
  }

  const metrics: ViewMetrics[] = seats.map((seat) => {
    const [ex, ey, ez] = seatEye(seat);
    const dx = screenCenter[0] - ex;
    const dy = screenCenter[1] - ey;
    const dz = ez - screenCenter[2];
    const distance = Math.hypot(dx, dy, dz);
    const hAngle = deg(Math.atan2(screen.width / 2 - ex, dz) - Math.atan2(-screen.width / 2 - ex, dz));
    const elevation = deg(Math.atan2(dy, Math.hypot(dx, dz)));
    const offAxis = deg(Math.atan2(Math.abs(ex), dz));
    const score = clamp(scoreView(hAngle, elevation, offAxis), 0, 100);
    return { distance, hAngle, elevation, offAxis, score, ...describe(score, hAngle, elevation, offAxis) };
  });

  let best = 0;
  metrics.forEach((m, i) => {
    if (m.score > metrics[best].score) best = i;
  });

  return {
    config,
    seats,
    byId,
    grid,
    metrics,
    rowScores: grid.map((row) => row.map((s) => metrics[s.index].score)),
    perRow,
    width,
    height,
    zFront,
    zBack,
    rowsY,
    rowsZ,
    aisleXs,
    sideAisleWidth,
    seatsWidth,
    screenCenter,
    bestSeatId: seats[best].id,
  };
}

const layoutCache = new Map<string, HallLayout>();
export function getLayout(hallId: string): HallLayout {
  let l = layoutCache.get(hallId);
  if (!l) {
    const cfg = HALLS.find((h) => h.id === hallId) ?? HALLS[0];
    l = buildLayout(cfg);
    layoutCache.set(hallId, l);
  }
  return l;
}

export function getHall(hallId: string): HallConfig {
  return HALLS.find((h) => h.id === hallId) ?? HALLS[0];
}

/** Floor height of the stepped platform at a given depth. */
export function floorYAt(layout: HallLayout, z: number): number {
  const { firstRowZ, rowPitch } = layout.config;
  if (z < firstRowZ - rowPitch / 2) return 0;
  const r = clamp(Math.floor((z - (firstRowZ - rowPitch / 2)) / rowPitch), 0, layout.rowsY.length - 1);
  return layout.rowsY[r];
}

/** green → amber → red ramp used by the view-quality heatmap */
export function scoreColor(score: number): string {
  const t = clamp((score - 30) / 62, 0, 1);
  const stops: [number, [number, number, number]][] = [
    [0, [255, 77, 94]],
    [0.5, [255, 194, 75]],
    [1, [53, 224, 138]],
  ];
  let a = stops[0];
  let b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      a = stops[i];
      b = stops[i + 1];
    }
  }
  const k = (t - a[0]) / (b[0] - a[0] || 1);
  const c = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/**
 * Find the best-scoring run of `count` free seats that sit together
 * (same row, same block, no gaps).
 */
export function findBestSeats(layout: HallLayout, taken: Set<string>, count: number): Seat[] {
  let best: Seat[] = [];
  let bestScore = -1;
  for (const row of layout.grid) {
    for (let start = 0; start + count <= row.length; start++) {
      const run = row.slice(start, start + count);
      if (run.some((s) => taken.has(s.id) || s.block !== run[0].block || s.accessible)) continue;
      const avg = run.reduce((a, s) => a + layout.metrics[s.index].score, 0) / count;
      if (avg > bestScore) {
        bestScore = avg;
        best = run;
      }
    }
  }
  return best;
}
