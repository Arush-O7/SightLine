import { hashString, mulberry32, type Rng } from './rng';

// Posters, backdrops and the picture on the cinema screen are all painted
// on a canvas at runtime, so there are no image files.

export type SceneKind = 'space' | 'lighthouse' | 'neon' | 'desert' | 'forest' | 'alpine' | 'noir' | 'voyage';

export interface ArtSubject {
  id: string;
  title: string;
  tagline: string;
  director: string;
  cast: string[];
  scene: SceneKind;
  titleFont: 'display' | 'serif';
}

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

const FONT_DISPLAY = '"Bebas Neue", Impact, "Arial Narrow", sans-serif';
const FONT_SERIF = '"Playfair Display Variable", "Playfair Display", Georgia, serif';
const FONT_UI = '"Geist Variable", Geist, system-ui, sans-serif';

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function fillV(ctx: Ctx, w: number, h: number, stops: [number, string][], y0 = 0, y1 = h) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, w, y1 - y0);
}

function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.5, rgba(color, alpha * 0.35));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function disc(ctx: Ctx, x: number, y: number, r: number, fill: string | CanvasGradient) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

function stars(ctx: Ctx, w: number, h: number, r: Rng, count: number, maxY = 1) {
  for (let i = 0; i < count; i++) {
    const x = r() * w;
    const y = r() * h * maxY;
    const s = Math.pow(r(), 3) * Math.min(w, h) * 0.0035 + 0.4;
    ctx.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.75})`;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, TAU);
    ctx.fill();
  }
}

/** smooth pseudo-noise built from a few sine waves, output in [-1, 1] */
function waves(r: Rng, octaves = 4) {
  const parts = Array.from({ length: octaves }, (_, i) => ({
    f: (i + 1) * (0.7 + r() * 0.9),
    p: r() * TAU,
    a: 1 / (i + 1),
  }));
  const total = parts.reduce((s, p) => s + p.a, 0);
  return (t: number) => parts.reduce((s, p) => s + Math.sin(t * TAU * p.f + p.p) * p.a, 0) / total;
}

/** jagged ridge line (mountains), output in [0, 1] */
function jagged(r: Rng, points = 26, rough = 0.6) {
  const pts = Array.from({ length: points + 1 }, () => r());
  for (let i = 1; i < pts.length; i++) pts[i] = pts[i - 1] * (1 - rough) + pts[i] * rough;
  return (t: number) => {
    const x = Math.min(0.9999, Math.max(0, t)) * points;
    const i = Math.floor(x);
    const k = x - i;
    return pts[i] * (1 - k) + pts[i + 1] * k;
  };
}

function layer(ctx: Ctx, w: number, h: number, yAt: (t: number) => number, fill: string | CanvasGradient, step = 3) {
  ctx.beginPath();
  ctx.moveTo(0, h + 2);
  for (let x = 0; x <= w + step; x += step) ctx.lineTo(x, yAt(x / w));
  ctx.lineTo(w, h + 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function sceneSpace(ctx: Ctx, w: number, h: number, r: Rng) {
  const u = Math.min(w, h);
  fillV(ctx, w, h, [[0, '#03040b'], [0.55, '#0a0f2e'], [1, '#261a55']]);
  ctx.globalCompositeOperation = 'screen';
  glow(ctx, w * 0.18, h * 0.28, u * 0.75, '#3b2a8c', 0.6);
  glow(ctx, w * 0.9, h * 0.8, u * 0.6, '#0e6ba8', 0.45);
  glow(ctx, w * 0.5, h * 0.08, u * 0.5, '#c2417a', 0.28);
  ctx.globalCompositeOperation = 'source-over';
  stars(ctx, w, h, r, 460);

  const cx = w * 0.64;
  const cy = h * 0.4;
  const R = u * 0.29;
  const tilt = -0.38;
  const ring = (from: number, to: number) => {
    const bands: [number, number, string][] = [
      [1.95, 0.16, 'rgba(255,214,170,0.55)'],
      [1.7, 0.07, 'rgba(255,170,120,0.5)'],
      [2.22, 0.045, 'rgba(210,190,255,0.4)'],
    ];
    bands.forEach(([k, lw, c]) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * k, R * k * 0.24, tilt, from, to);
      ctx.lineWidth = R * lw;
      ctx.strokeStyle = c;
      ctx.stroke();
    });
  };
  ring(Math.PI, TAU);
  glow(ctx, cx, cy, R * 1.5, '#ff9d5c', 0.22);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  const bands = ['#f2b680', '#e58a4e', '#c9683a', '#f7cfa0', '#b85c38', '#e9a066', '#d9773f'];
  let y = -R;
  while (y < R) {
    const bh = R * (0.05 + r() * 0.16);
    ctx.fillStyle = bands[Math.floor(r() * bands.length)];
    ctx.fillRect(-R * 1.2, y, R * 2.4, bh + 1);
    y += bh;
  }
  ctx.rotate(-tilt);
  const shade = ctx.createRadialGradient(-R * 0.5, -R * 0.5, R * 0.1, -R * 0.15, -R * 0.15, R * 1.35);
  shade.addColorStop(0, 'rgba(255,244,225,0.4)');
  shade.addColorStop(0.42, 'rgba(40,10,40,0.12)');
  shade.addColorStop(1, 'rgba(4,2,16,0.96)');
  ctx.fillStyle = shade;
  ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.restore();
  ring(0, Math.PI);

  disc(ctx, w * 0.2, h * 0.2, u * 0.032, '#d7d2f0');
  disc(ctx, w * 0.2 + u * 0.012, h * 0.2 - u * 0.006, u * 0.031, 'rgba(8,8,26,0.82)');

  const ridge = jagged(r, 34, 0.55);
  layer(ctx, w, h, (t) => h * (0.9 - ridge(t) * 0.1 - Math.sin(t * Math.PI) * 0.03), '#0d0a22');
  const ridge2 = jagged(r, 22, 0.7);
  layer(ctx, w, h, (t) => h * (0.97 - ridge2(t) * 0.08), '#04030c');

  // a lone figure on the ridge
  const fx = w * 0.27;
  const fy = h * (0.97 - ridge2(0.27) * 0.08);
  const fs = u * 0.03;
  ctx.fillStyle = '#04030c';
  ctx.fillRect(fx - fs * 0.28, fy - fs * 1.5, fs * 0.56, fs * 1.6);
  disc(ctx, fx, fy - fs * 1.75, fs * 0.36, '#04030c');
  disc(ctx, fx + fs * 0.08, fy - fs * 1.75, fs * 0.16, '#ffd9a8');
  glow(ctx, fx + fs * 0.08, fy - fs * 1.75, fs * 1.6, '#ffb26b', 0.5);
}

function sceneLighthouse(ctx: Ctx, w: number, h: number, r: Rng) {
  const u = Math.min(w, h);
  fillV(ctx, w, h, [[0, '#04121f'], [0.45, '#0c3145'], [0.72, '#2a6f7a'], [1, '#0a2a38']]);
  stars(ctx, w, h, r, 180, 0.5);
  const mx = w * 0.22;
  const my = h * 0.22;
  glow(ctx, mx, my, u * 0.5, '#bfe9e2', 0.3);
  disc(ctx, mx, my, u * 0.07, '#f4ecd0');
  for (let i = 0; i < 7; i++) {
    const cy = h * (0.3 + r() * 0.3);
    const cx = r() * w;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, u * 0.4);
    g.addColorStop(0, 'rgba(190,230,230,0.13)');
    g.addColorStop(1, 'rgba(190,230,230,0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(2.6, 0.22);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = g;
    ctx.fillRect(cx - u, cy - u, u * 2, u * 2);
    ctx.restore();
  }

  const horizon = h * 0.7;
  // headland + tower
  const lx = w * 0.72;
  const base = horizon - h * 0.07;
  const th = u * 0.36;
  const tw = u * 0.05;
  const lampY = base - th;

  ctx.globalCompositeOperation = 'lighter';
  const beam = (dir: number, spread: number, len: number, a: number) => {
    const g = ctx.createLinearGradient(lx, lampY, lx + dir * len, lampY);
    g.addColorStop(0, `rgba(255,238,180,${a})`);
    g.addColorStop(1, 'rgba(255,238,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(lx, lampY);
    ctx.lineTo(lx + dir * len, lampY - spread * 0.4);
    ctx.lineTo(lx + dir * len, lampY + spread);
    ctx.closePath();
    ctx.fill();
  };
  beam(-1, u * 0.22, w * 0.9, 0.55);
  beam(1, u * 0.1, w * 0.4, 0.4);
  ctx.globalCompositeOperation = 'source-over';
  glow(ctx, lx, lampY, u * 0.2, '#ffe9a8', 0.9);

  const cliff = waves(r, 3);
  layer(ctx, w, h, (t) => {
    const d = Math.max(0, 1 - Math.abs(t - 0.78) / 0.34);
    return horizon + h * 0.02 - Math.pow(d, 0.8) * h * 0.1 + cliff(t) * h * 0.006;
  }, '#03141d');

  ctx.fillStyle = '#041822';
  ctx.beginPath();
  ctx.moveTo(lx - tw, base + h * 0.02);
  ctx.lineTo(lx - tw * 0.55, lampY + tw * 0.5);
  ctx.lineTo(lx + tw * 0.55, lampY + tw * 0.5);
  ctx.lineTo(lx + tw, base + h * 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(lx - tw * 0.8, lampY + tw * 0.3, tw * 1.6, tw * 0.22);
  ctx.fillStyle = '#fff3c4';
  ctx.fillRect(lx - tw * 0.42, lampY - tw * 0.45, tw * 0.84, tw * 0.78);
  ctx.fillStyle = '#041822';
  ctx.beginPath();
  ctx.moveTo(lx - tw * 0.6, lampY - tw * 0.45);
  ctx.lineTo(lx, lampY - tw * 1.2);
  ctx.lineTo(lx + tw * 0.6, lampY - tw * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let i = 1; i < 4; i++) ctx.fillRect(lx - tw, base - (th * i) / 4, tw * 2, th * 0.06);

  const seaCols = ['#12556a', '#0d4455', '#093546', '#062634', '#041a25'];
  seaCols.forEach((c, i) => {
    const wv = waves(r, 4);
    const y0 = horizon + (h - horizon) * (i / seaCols.length);
    layer(ctx, w, h, (t) => y0 + wv(t * (1.5 - i * 0.15)) * h * (0.006 + i * 0.004), c);
  });
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) {
    const y = horizon + r() * (h - horizon) * 0.85;
    const spread = ((y - horizon) / (h - horizon)) * w * 0.5 + w * 0.05;
    const x = mx + (r() - 0.5) * spread;
    ctx.fillStyle = `rgba(244,236,208,${0.05 + r() * 0.2})`;
    ctx.fillRect(x, y, u * (0.02 + r() * 0.07), Math.max(1, u * 0.003));
  }
  ctx.globalCompositeOperation = 'source-over';
}

function sceneNeon(ctx: Ctx, w: number, h: number, r: Rng) {
  const u = Math.min(w, h);
  const horizon = h * 0.64;
  fillV(ctx, w, h, [[0, '#0b0120'], [0.4, '#3a0a5e'], [0.85, '#c2217a'], [1, '#ff6a8a']], 0, horizon);
  stars(ctx, w, h, r, 150, 0.38);

  const sx = w * 0.5;
  const sy = horizon - u * 0.1;
  const sr = u * 0.3;
  glow(ctx, sx, sy, sr * 2.2, '#ff3d81', 0.45);
  // the striped sun is cut out on its own layer so the sky shows through the slits
  const sun = document.createElement('canvas');
  sun.width = sun.height = Math.ceil(sr * 2);
  const sc = sun.getContext('2d')!;
  const sg = sc.createLinearGradient(0, 0, 0, sr * 2);
  sg.addColorStop(0, '#ffe66d');
  sg.addColorStop(0.5, '#ff8a4c');
  sg.addColorStop(1, '#ff2e88');
  sc.fillStyle = sg;
  sc.beginPath();
  sc.arc(sr, sr, sr, 0, TAU);
  sc.fill();
  sc.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) sc.fillRect(0, sr * (1.05 + i * 0.14), sr * 2, sr * (0.022 + i * 0.012));
  ctx.drawImage(sun, sx - sr, sy - sr);

  const skyline = (depth: number, color: string, minH: number, maxH: number, lit: number) => {
    let x = -u * 0.02;
    while (x < w) {
      const bw = u * (0.035 + r() * 0.07);
      const centre = 1 - Math.min(1, Math.abs((x + bw / 2) / w - 0.5) * 1.5);
      const bh = u * (minH + r() * (maxH - minH)) * (0.55 + centre * 0.75);
      ctx.fillStyle = color;
      ctx.fillRect(x, horizon - bh + depth, bw, bh + 4);
      if (r() < 0.35) ctx.fillRect(x + bw * 0.45, horizon - bh + depth - u * 0.04, bw * 0.06, u * 0.04);
      if (lit > 0) {
        const cols = Math.max(2, Math.floor(bw / (u * 0.014)));
        const rows = Math.floor(bh / (u * 0.02));
        for (let i = 0; i < cols; i++)
          for (let j = 1; j < rows; j++)
            if (r() < lit) {
              ctx.fillStyle = r() < 0.5 ? 'rgba(255,92,178,0.85)' : 'rgba(92,225,255,0.8)';
              ctx.fillRect(x + (i + 0.25) * (bw / cols), horizon - bh + depth + j * u * 0.02, (bw / cols) * 0.5, u * 0.007);
            }
      }
      x += bw + u * 0.004;
    }
  };
  skyline(0, '#3d0f5c', 0.06, 0.2, 0);
  skyline(0, '#16052c', 0.04, 0.15, 0.12);

  fillV(ctx, w, h, [[0, '#1b0433'], [1, '#05010d']], horizon, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon, w, h - horizon);
  ctx.clip();
  ctx.lineWidth = Math.max(1, u * 0.0028);
  ctx.strokeStyle = 'rgba(255,61,160,0.85)';
  ctx.shadowColor = '#ff3da0';
  ctx.shadowBlur = u * 0.012;
  for (let i = -22; i <= 22; i++) {
    ctx.beginPath();
    ctx.moveTo(sx, horizon);
    ctx.lineTo(sx + i * w * 0.16, h);
    ctx.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const k = Math.pow(i / 13, 2.4);
    const y = horizon + (h - horizon) * k;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
  fillV(ctx, w, h, [[0, 'rgba(255,120,200,0.55)'], [1, 'rgba(255,120,200,0)']], horizon - 1, horizon + h * 0.06);
}

function sceneDesert(ctx: Ctx, w: number, h: number, r: Rng) {
  const u = Math.min(w, h);
  fillV(ctx, w, h, [[0, '#2c0f3f'], [0.3, '#8f2a57'], [0.55, '#f2703d'], [0.72, '#ffc56b'], [1, '#ffe2a6']]);
  const sx = w * 0.42;
  const sy = h * 0.6;
  glow(ctx, sx, sy, u * 0.85, '#fff1c1', 0.55);
  disc(ctx, sx, sy, u * 0.17, '#fff4cf');

  for (let i = 0; i < 5; i++) {
    const y = h * (0.12 + r() * 0.3);
    const x = r() * w;
    ctx.fillStyle = `rgba(255,190,140,${0.1 + r() * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(x, y, u * (0.25 + r() * 0.3), u * 0.012, 0, 0, TAU);
    ctx.fill();
  }

  const balloon = (x: number, y: number, s: number, c1: string, c2: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, s * 1.25);
    ctx.bezierCurveTo(-s * 1.25, s * 0.3, -s * 1.05, -s, 0, -s);
    ctx.bezierCurveTo(s * 1.05, -s, s * 1.25, s * 0.3, 0, s * 1.25);
    ctx.closePath();
    ctx.fillStyle = c1;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = c2;
    for (let i = -2; i <= 2; i += 2) ctx.fillRect(i * s * 0.26 - s * 0.13, -s, s * 0.26, s * 2.4);
    const g = ctx.createLinearGradient(-s, 0, s, 0);
    g.addColorStop(0, 'rgba(255,240,200,0.3)');
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(30,0,30,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(-s * 1.3, -s, s * 2.6, s * 2.4);
    ctx.restore();
    ctx.fillStyle = '#2a0e1c';
    ctx.fillRect(-s * 0.14, s * 1.42, s * 0.28, s * 0.2);
    ctx.strokeStyle = '#2a0e1c';
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, s * 1.15);
    ctx.lineTo(-s * 0.12, s * 1.42);
    ctx.moveTo(s * 0.12, s * 1.15);
    ctx.lineTo(s * 0.12, s * 1.42);
    ctx.stroke();
    ctx.restore();
  };
  balloon(w * 0.7, h * 0.3, u * 0.105, '#7a1f4b', '#e8572f');
  balloon(w * 0.2, h * 0.24, u * 0.055, '#5b1a4a', '#c93a4b');
  balloon(w * 0.88, h * 0.47, u * 0.035, '#4a153f', '#a32d4c');
  balloon(w * 0.52, h * 0.17, u * 0.025, '#4a153f', '#8f2a57');

  const dunes: [number, number, string][] = [
    [0.7, 0.03, '#e2693a'],
    [0.76, 0.045, '#b9432f'],
    [0.83, 0.05, '#7d2730'],
    [0.9, 0.05, '#4a1528'],
    [0.97, 0.04, '#1e0814'],
  ];
  dunes.forEach(([base, amp, c], i) => {
    const wv = waves(r, 3);
    layer(ctx, w, h, (t) => h * (base + wv(t * (0.8 + i * 0.1)) * amp), c);
  });
}

function pine(ctx: Ctx, x: number, baseY: number, height: number, width: number) {
  const tiers = 6;
  ctx.beginPath();
  ctx.moveTo(x, baseY - height);
  for (let i = 1; i <= tiers; i++) {
    const k = i / tiers;
    ctx.lineTo(x + width * k * 0.5, baseY - height * (1 - k) + height * 0.02);
    ctx.lineTo(x + width * k * 0.26, baseY - height * (1 - k));
  }
  ctx.lineTo(x + width * 0.05, baseY - height * 0.04);
  ctx.lineTo(x + width * 0.05, baseY + height * 0.3);
  ctx.lineTo(x - width * 0.05, baseY + height * 0.3);
  ctx.lineTo(x - width * 0.05, baseY - height * 0.04);
  for (let i = tiers; i >= 1; i--) {
    const k = i / tiers;
    ctx.lineTo(x - width * k * 0.26, baseY - height * (1 - k));
    ctx.lineTo(x - width * k * 0.5, baseY - height * (1 - k) + height * 0.02);
  }
  ctx.closePath();
  ctx.fill();
}

function sceneForest(ctx: Ctx, w: number, h: number, r: Rng) {
  const u = Math.min(w, h);
  fillV(ctx, w, h, [[0, '#04201f'], [0.4, '#0d5247'], [0.7, '#5fae84'], [1, '#0a2f2a']]);
  glow(ctx, w * 0.56, h * 0.5, u * 0.8, '#e9f7b8', 0.6);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.translate(w * 0.56, h * 0.16);
    ctx.rotate(-0.5 + i * 0.2 + r() * 0.05);
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.9);
    g.addColorStop(0, 'rgba(240,255,200,0.11)');
    g.addColorStop(1, 'rgba(240,255,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-u * 0.01, 0);
    ctx.lineTo(u * 0.01, 0);
    ctx.lineTo(u * 0.1, h * 0.9);
    ctx.lineTo(-u * 0.1, h * 0.9);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';

  const rows: [number, number, string, number][] = [
    [0.62, 0.2, '#2f7d64', 26],
    [0.72, 0.3, '#17584a', 18],
    [0.84, 0.42, '#0a3a33', 12],
    [1.0, 0.62, '#041d1b', 8],
  ];
  rows.forEach(([base, size, color, count], li) => {
    ctx.fillStyle = color;
    const ground = waves(r, 2);
    for (let i = 0; i <= count; i++) {
      const t = (i + (r() - 0.5) * 0.7) / count;
      const hh = u * size * (0.6 + r() * 0.6);
      pine(ctx, t * w, h * base + ground(t) * h * 0.01, hh, hh * 0.42);
    }
    layer(ctx, w, h, (t) => h * (base + 0.01) + ground(t) * h * 0.012, color);
    if (li < rows.length - 1) {
      fillV(ctx, w, h, [[0, 'rgba(200,240,200,0)'], [1, `rgba(200,240,200,${0.2 - li * 0.04})`]], h * (base - 0.16), h * (base + 0.02));
    }
  });

  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const x = r() * w;
    const y = h * (0.35 + r() * 0.6);
    const s = u * (0.003 + r() * 0.006);
    glow(ctx, x, y, s * 6, '#f8f29a', 0.5);
    disc(ctx, x, y, s, 'rgba(255,255,220,0.95)');
  }
  ctx.globalCompositeOperation = 'source-over';
}

function sceneAlpine(ctx: Ctx, w: number, h: number, r: Rng) {
  const u = Math.min(w, h);
  fillV(ctx, w, h, [[0, '#0a1622'], [0.45, '#34506a'], [0.78, '#b9c8d4'], [1, '#e6edf2']]);
  const sx = w * 0.5;
  const sy = h * 0.4;
  glow(ctx, sx, sy, u * 0.7, '#e8f1f7', 0.4);
  disc(ctx, sx, sy, u * 0.2, 'rgba(238,244,248,0.92)');
  ctx.lineWidth = u * 0.006;
  ctx.strokeStyle = 'rgba(255,60,74,0.9)';
  ctx.beginPath();
  ctx.arc(sx, sy, u * 0.245, 0, TAU);
  ctx.stroke();

  const ranges: [number, number, string, string][] = [
    [0.66, 0.24, '#8ea4b7', '#c9d6e0'],
    [0.76, 0.26, '#56708a', '#9fb3c4'],
    [0.88, 0.26, '#23384d', '#5b7389'],
    [1.0, 0.22, '#08121c', '#1b2b3a'],
  ];
  ranges.forEach(([base, amp, dark, light]) => {
    const j = jagged(r, 22, 0.78);
    const fine = jagged(r, 90, 0.9);
    const yAt = (t: number) => h * (base - j(t) * amp - fine(t) * 0.022);
    const g = ctx.createLinearGradient(0, h * (base - amp), 0, h * base);
    g.addColorStop(0, light);
    g.addColorStop(0.6, dark);
    layer(ctx, w, h, yAt, g, 2);
    fillV(ctx, w, h, [[0, 'rgba(220,232,240,0)'], [1, 'rgba(220,232,240,0.28)']], h * (base - 0.08), h * (base + 0.01));
  });

  // the meridian
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, sx, h * 0.5, u * 0.5, '#ff2e3e', 0.12);
  const lg = ctx.createLinearGradient(sx - u * 0.03, 0, sx + u * 0.03, 0);
  lg.addColorStop(0, 'rgba(255,46,62,0)');
  lg.addColorStop(0.5, 'rgba(255,46,62,0.5)');
  lg.addColorStop(1, 'rgba(255,46,62,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(sx - u * 0.03, 0, u * 0.06, h);
  ctx.fillStyle = 'rgba(255,120,130,1)';
  ctx.fillRect(sx - Math.max(1, u * 0.0022), 0, Math.max(2, u * 0.0044), h);
  ctx.globalCompositeOperation = 'source-over';

  // tiny survey figure
  const fy = h * 0.93;
  const fs = u * 0.022;
  ctx.fillStyle = '#05090e';
  ctx.fillRect(sx - u * 0.09 - fs * 0.25, fy - fs * 1.5, fs * 0.5, fs * 1.6);
  disc(ctx, sx - u * 0.09, fy - fs * 1.75, fs * 0.32, '#05090e');

  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.5})`;
    ctx.beginPath();
    ctx.arc(r() * w, r() * h, u * (0.001 + r() * 0.003), 0, TAU);
    ctx.fill();
  }
}

function sceneNoir(ctx: Ctx, w: number, h: number, r: Rng) {
  const u = Math.min(w, h);
  const street = h * 0.76;
  fillV(ctx, w, h, [[0, '#03050a'], [0.5, '#0e1622'], [1, '#2c3d4f']], 0, street);
  glow(ctx, w * 0.74, h * 0.2, u * 0.5, '#9fb6c9', 0.3);
  disc(ctx, w * 0.74, h * 0.2, u * 0.055, 'rgba(226,234,240,0.85)');

  const block = (color: string, minH: number, maxH: number, lit: number) => {
    let x = -u * 0.03;
    while (x < w) {
      const bw = u * (0.07 + r() * 0.11);
      const bh = u * (minH + r() * (maxH - minH));
      ctx.fillStyle = color;
      ctx.fillRect(x, street - bh, bw, bh);
      if (r() < 0.3) ctx.fillRect(x + bw * 0.2, street - bh - u * 0.03, bw * 0.3, u * 0.03);
      const cols = Math.max(2, Math.floor(bw / (u * 0.024)));
      const rows = Math.floor(bh / (u * 0.036));
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows - 1; j++)
          if (r() < lit) {
            ctx.fillStyle = `rgba(255,217,138,${0.35 + r() * 0.55})`;
            ctx.fillRect(x + (i + 0.25) * (bw / cols), street - bh + (j + 0.4) * u * 0.036, (bw / cols) * 0.5, u * 0.018);
          }
      x += bw + u * 0.006;
    }
  };
  block('#16222f', 0.3, 0.62, 0.05);
  fillV(ctx, w, h, [[0, 'rgba(60,84,104,0)'], [1, 'rgba(60,84,104,0.5)']], street - u * 0.5, street);
  block('#080d14', 0.14, 0.42, 0.16);

  // the marquee
  const mx = w * 0.3;
  const mw = u * 0.085;
  const mh = u * 0.42;
  const mtop = street - u * 0.56;
  ctx.fillStyle = '#05070b';
  ctx.fillRect(mx - u * 0.13, street - u * 0.3, u * 0.26, u * 0.3);
  ctx.fillRect(mx - mw / 2 - u * 0.01, mtop - u * 0.01, mw + u * 0.02, mh + u * 0.02);
  glow(ctx, mx, mtop + mh / 2, u * 0.42, '#ff2d55', 0.38);
  ctx.strokeStyle = '#ff5c7a';
  ctx.lineWidth = u * 0.006;
  ctx.shadowColor = '#ff2d55';
  ctx.shadowBlur = u * 0.03;
  ctx.strokeRect(mx - mw / 2, mtop, mw, mh);
  ctx.fillStyle = '#ffd3db';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 ${mh / 8.4}px ${FONT_DISPLAY}`;
  'ORPHEUM'.split('').forEach((ch, i) => ctx.fillText(ch, mx, mtop + (mh / 7) * (i + 0.55)));
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,224,160,0.95)';
  ctx.fillRect(mx - u * 0.13, street - u * 0.13, u * 0.26, u * 0.012);
  glow(ctx, mx, street - u * 0.1, u * 0.24, '#ffd98a', 0.35);

  // wet street
  fillV(ctx, w, h, [[0, '#0b121b'], [1, '#020305']], street, h);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 90; i++) {
    const x = r() * w;
    const near = Math.abs(x - mx) < u * 0.2;
    const len = (h - street) * (0.2 + r() * 0.8);
    const g = ctx.createLinearGradient(0, street, 0, street + len);
    const c = near ? '255,70,105' : r() < 0.5 ? '255,217,138' : '120,160,190';
    g.addColorStop(0, `rgba(${c},${near ? 0.4 : 0.16})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, street, u * (0.004 + r() * 0.014), len);
  }
  ctx.globalCompositeOperation = 'source-over';

  // a figure under the marquee
  const fs = u * 0.05;
  ctx.fillStyle = '#010203';
  ctx.beginPath();
  ctx.moveTo(mx + u * 0.2 - fs * 0.34, street + fs * 0.1);
  ctx.lineTo(mx + u * 0.2 - fs * 0.26, street - fs * 1.5);
  ctx.lineTo(mx + u * 0.2 + fs * 0.26, street - fs * 1.5);
  ctx.lineTo(mx + u * 0.2 + fs * 0.4, street + fs * 0.1);
  ctx.fill();
  disc(ctx, mx + u * 0.2, street - fs * 1.75, fs * 0.25, '#010203');
  ctx.fillRect(mx + u * 0.2 - fs * 0.44, street - fs * 1.93, fs * 0.88, fs * 0.09);

  ctx.strokeStyle = 'rgba(190,210,230,0.22)';
  ctx.lineWidth = Math.max(1, u * 0.0016);
  for (let i = 0; i < 260; i++) {
    const x = r() * w * 1.1;
    const y = r() * h;
    const l = u * (0.02 + r() * 0.045);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - l * 0.28, y + l);
    ctx.stroke();
  }
}

function sceneVoyage(ctx: Ctx, w: number, h: number, r: Rng) {
  const u = Math.min(w, h);
  const horizon = h * 0.62;
  fillV(ctx, w, h, [[0, '#135a9e'], [0.5, '#4fb2de'], [0.85, '#bfe6ee'], [1, '#ffe7c2']], 0, horizon + 2);
  const sx = w * 0.72;
  const sy = h * 0.3;
  glow(ctx, sx, sy, u * 0.6, '#fff6d6', 0.6);
  disc(ctx, sx, sy, u * 0.085, '#fffbe8');

  const cloud = (cx: number, cy: number, s: number) => {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const puffs = 6;
    for (let i = 0; i < puffs; i++) {
      const k = i / (puffs - 1) - 0.5;
      disc(ctx, cx + k * s * 2.6, cy - Math.cos(k * Math.PI) * s * 0.45, s * (0.5 + Math.cos(k * Math.PI) * 0.45), 'rgba(255,255,255,0.92)');
    }
    ctx.fillRect(cx - s * 1.5, cy - s * 0.1, s * 3, s * 0.5);
  };
  cloud(w * 0.2, h * 0.22, u * 0.06);
  cloud(w * 0.5, h * 0.4, u * 0.04);
  cloud(w * 0.9, h * 0.47, u * 0.05);
  cloud(w * 0.06, h * 0.5, u * 0.035);

  const island = waves(r, 3);
  layer(ctx, w, h, (t) => {
    const d = Math.max(0, 1 - Math.abs(t - 0.14) / 0.2);
    return horizon + 4 - Math.pow(d, 1.4) * h * 0.09 * (1 + island(t * 3) * 0.2);
  }, '#2b7f95');

  const sea = ['#1aa3b8', '#1289a6', '#0b6d92', '#085478', '#063a5e', '#042a48'];
  const boatLayer = 2;
  const bx = w * 0.46;
  sea.forEach((c, i) => {
    const wv = waves(r, 4);
    const y0 = horizon + (h - horizon) * Math.pow(i / sea.length, 1.25);
    const amp = h * (0.004 + i * 0.006);
    const yAt = (t: number) => y0 + wv(t * (2.2 - i * 0.2)) * amp;
    if (i === boatLayer) {
      const s = u * 0.15;
      const by = yAt(bx / w) + s * 0.06;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(-0.05);
      ctx.fillStyle = '#0a2238';
      ctx.beginPath();
      ctx.moveTo(-s * 0.62, -s * 0.16);
      ctx.lineTo(s * 0.7, -s * 0.16);
      ctx.lineTo(s * 0.46, s * 0.1);
      ctx.lineTo(-s * 0.5, s * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-s * 0.02, -s * 1.5, s * 0.035, s * 1.36);
      ctx.fillStyle = '#fff7e6';
      ctx.beginPath();
      ctx.moveTo(s * 0.05, -s * 1.46);
      ctx.quadraticCurveTo(s * 0.62, -s * 0.8, s * 0.6, -s * 0.24);
      ctx.lineTo(s * 0.05, -s * 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff7b54';
      ctx.beginPath();
      ctx.moveTo(-s * 0.05, -s * 1.3);
      ctx.quadraticCurveTo(-s * 0.52, -s * 0.7, -s * 0.5, -s * 0.24);
      ctx.lineTo(-s * 0.05, -s * 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    layer(ctx, w, h, yAt, c);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(1, u * 0.003);
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const y = yAt(x / w) + 1;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

  ctx.strokeStyle = '#0a2238';
  ctx.lineWidth = Math.max(1.5, u * 0.004);
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const x = w * (0.3 + r() * 0.55);
    const y = h * (0.12 + r() * 0.3);
    const s = u * (0.012 + r() * 0.014);
    ctx.beginPath();
    ctx.moveTo(x - s, y - s * 0.3);
    ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.7, x, y);
    ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.7, x + s, y - s * 0.3);
    ctx.stroke();
  }
}

const SCENES: Record<SceneKind, (ctx: Ctx, w: number, h: number, r: Rng) => void> = {
  space: sceneSpace,
  lighthouse: sceneLighthouse,
  neon: sceneNeon,
  desert: sceneDesert,
  forest: sceneForest,
  alpine: sceneAlpine,
  noir: sceneNoir,
  voyage: sceneVoyage,
};

let grainTile: HTMLCanvasElement | null = null;
function grain(ctx: Ctx, w: number, h: number, alpha: number) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = grainTile.height = 160;
    const g = grainTile.getContext('2d')!;
    const img = g.createImageData(160, 160);
    const r = mulberry32(7);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(r() * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grainTile, 'repeat')!;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function vignette(ctx: Ctx, w: number, h: number, strength: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function tracked(ctx: Ctx, em: number) {
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${em}em`;
}

function splitLines(words: string[], n: number): string[] {
  if (n <= 1 || words.length <= 1) return [words.join(' ')];
  const total = words.join(' ').length;
  const lines: string[] = [];
  let cur = '';
  let remainingLines = n;
  let used = 0;
  words.forEach((word, i) => {
    const target = (total - used) / remainingLines;
    const next = cur ? `${cur} ${word}` : word;
    const wordsLeft = words.length - i;
    if (cur && remainingLines > 1 && (next.length > target + 2 || wordsLeft < remainingLines)) {
      lines.push(cur);
      used += cur.length + 1;
      remainingLines--;
      cur = word;
    } else {
      cur = next;
    }
  });
  if (cur) lines.push(cur);
  return lines;
}

/** choose the line-break that lets the title be set as large as possible */
function fitTitle(ctx: Ctx, title: string, font: (px: number) => string, maxW: number, maxSize: number, maxH: number, lh: number) {
  const words = title.split(' ');
  let best = { lines: [title], size: 10 };
  for (let n = 1; n <= Math.min(3, words.length); n++) {
    const lines = splitLines(words, n);
    ctx.font = font(100);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    let size = Math.min(maxSize, (maxW / widest) * 100);
    size = Math.min(size, maxH / (lines.length * lh));
    if (size > best.size * 1.08) best = { lines, size };
  }
  return best;
}

function titleFont(subject: ArtSubject) {
  return subject.titleFont === 'serif'
    ? (px: number) => `italic 700 ${px}px ${FONT_SERIF}`
    : (px: number) => `400 ${px}px ${FONT_DISPLAY}`;
}

function posterText(ctx: Ctx, w: number, h: number, s: ArtSubject) {
  fillV(ctx, w, h, [[0, 'rgba(0,0,0,0)'], [0.55, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0.92)']], h * 0.5, h);
  fillV(ctx, w, h, [[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']], 0, h * 0.16);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  tracked(ctx, 0.32);
  ctx.font = `600 ${w * 0.026}px ${FONT_UI}`;
  if (s.director) ctx.fillText(`A FILM BY ${s.director.toUpperCase()}`, w / 2 + w * 0.004, h * 0.062);

  const isSerif = s.titleFont === 'serif';
  const lh = isSerif ? 1.02 : 0.9;
  tracked(ctx, isSerif ? 0 : 0.02);
  const text = isSerif ? s.title : s.title.toUpperCase();
  const fit = fitTitle(ctx, text, titleFont(s), w * 0.84, w * (isSerif ? 0.2 : 0.3), h * 0.26, lh);
  ctx.font = titleFont(s)(fit.size);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = w * 0.03;
  const blockBottom = h * 0.865;
  fit.lines.forEach((line, i) => {
    const y = blockBottom - (fit.lines.length - 1 - i) * fit.size * lh;
    ctx.fillText(line, w / 2, y);
  });
  const top = blockBottom - fit.lines.length * fit.size * lh;
  ctx.shadowBlur = w * 0.015;
  tracked(ctx, 0.2);
  ctx.font = `500 ${w * 0.031}px ${FONT_UI}`;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillText(s.tagline.toUpperCase(), w / 2 + w * 0.003, top + fit.size * (isSerif ? 0.02 : -0.06));
  ctx.shadowBlur = 0;

  tracked(ctx, 0.14);
  ctx.font = `500 ${w * 0.021}px ${FONT_UI}`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(s.cast.slice(0, 3).join('   ·   ').toUpperCase(), w / 2, h * 0.915);
  tracked(ctx, 0.4);
  ctx.font = `700 ${w * 0.021}px ${FONT_UI}`;
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillText('ONLY IN CINEMAS', w / 2 + w * 0.004, h * 0.958);
  tracked(ctx, 0);
}

function screenText(ctx: Ctx, w: number, h: number, s: ArtSubject) {
  const g = ctx.createLinearGradient(0, 0, w * 0.75, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.6)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  fillV(ctx, w, h, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.6)']], h * 0.5, h);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const isSerif = s.titleFont === 'serif';
  const lh = isSerif ? 1.02 : 0.9;
  const text = isSerif ? s.title : s.title.toUpperCase();
  tracked(ctx, isSerif ? 0 : 0.02);
  const fit = fitTitle(ctx, text, titleFont(s), w * 0.5, h * (isSerif ? 0.2 : 0.27), h * 0.44, lh);
  ctx.font = titleFont(s)(fit.size);
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = h * 0.04;
  const x = w * 0.06;
  const bottom = h * 0.84;
  fit.lines.forEach((line, i) => ctx.fillText(line, x, bottom - (fit.lines.length - 1 - i) * fit.size * lh));
  const top = bottom - fit.lines.length * fit.size * lh;
  tracked(ctx, 0.3);
  ctx.font = `600 ${h * 0.03}px ${FONT_UI}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(s.tagline.toUpperCase(), x + h * 0.004, top + fit.size * (isSerif ? 0.0 : -0.08));
  ctx.shadowBlur = 0;
  tracked(ctx, 0.36);
  ctx.font = `600 ${h * 0.024}px ${FONT_UI}`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`DIRECTED BY ${s.director.toUpperCase()}`, x + h * 0.004, h * 0.92);
  tracked(ctx, 0);
}

export type ArtVariant = 'poster' | 'backdrop' | 'screen';

export function paintArt(subject: ArtSubject, variant: ArtVariant, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const rng = mulberry32(hashString(subject.id));
  ctx.save();
  SCENES[subject.scene](ctx, w, h, rng);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  vignette(ctx, w, h, variant === 'poster' ? 0.5 : 0.4);
  grain(ctx, w, h, 0.09);
  if (variant === 'poster') posterText(ctx, w, h, subject);
  if (variant === 'screen') screenText(ctx, w, h, subject);
  return canvas;
}

const urlCache = new Map<string, string>();

/** a short blob: URL keeps megabytes of base64 out of the DOM */
function toObjectUrl(dataUrl: string): string {
  try {
    const [head, body] = dataUrl.split(',');
    const mime = head.slice(5, head.indexOf(';'));
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  } catch {
    return dataUrl;
  }
}

export function artUrl(subject: ArtSubject, variant: 'poster' | 'backdrop'): string {
  const key = `${subject.id}:${variant}`;
  let url = urlCache.get(key);
  if (!url) {
    const canvas = variant === 'poster' ? paintArt(subject, 'poster', 560, 840) : paintArt(subject, 'backdrop', 1680, 840);
    url = toObjectUrl(canvas.toDataURL('image/jpeg', 0.88));
    urlCache.set(key, url);
  }
  return url;
}

export function screenCanvas(subject: ArtSubject, aspect: number): HTMLCanvasElement {
  const w = 1792;
  return paintArt(subject, 'screen', w, w / aspect);
}

/** mean colour of an image, used to tint the light spilling off the screen */
export function averageColor(canvas: HTMLCanvasElement): [number, number, number] {
  const tiny = document.createElement('canvas');
  tiny.width = tiny.height = 8;
  const ctx = tiny.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0, 8, 8);
  const d = ctx.getImageData(0, 0, 8, 8).data;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
  }
  const n = d.length / 4;
  const max = Math.max(r, g, b) / n || 1;
  const k = 255 / max;
  return [((r / n) * k) / 255, ((g / n) * k) / 255, ((b / n) * k) / 255];
}

/** wait for the web fonts the art uses, so canvas text is set in the right face */
export async function loadArtFonts(): Promise<void> {
  if (!document.fonts) return;
  const faces = [`400 48px "Bebas Neue"`, `italic 700 48px "Playfair Display Variable"`, `600 20px "Geist Variable"`];
  const timeout = new Promise<void>((res) => setTimeout(res, 2500));
  await Promise.race([Promise.all(faces.map((f) => document.fonts.load(f))).then(() => undefined), timeout]);
}

/**
 * Draws a photo over a screen canvas, cropped to fill it. Resolves false when the
 * photo can't be used (failed to load, or served without CORS headers).
 */
export function paintPhoto(canvas: HTMLCanvasElement, url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx || !img.naturalWidth) return resolve(false);
      const scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}
