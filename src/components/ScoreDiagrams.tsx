// Small line drawings of the three measurements behind a seat's view score. Each one shows
// the geometry SightLine computes in the 3D model, with the measured angle in Tungsten.

const SCREEN = 'M56 30Q140 20 224 30';

/** A cinema seat from above or the side: backrest and cushion, like the logo's seat. */
function SeatGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x - 12} ${y - 7})`} className="sd-seat">
      <path d="M3 4.5a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4V9H3Z" />
      <rect x="0" y="7" width="24" height="8" rx="3.5" />
    </g>
  );
}

/** An arc of radius r around (cx, cy) from one angle to another, in degrees (0 = right, 90 = down). */
function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x1, y1] = p(from);
  const [x2, y2] = p(to);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

const angleTo = (x1: number, y1: number, x2: number, y2: number) => (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

/** Top-down: the wedge of your vision the screen takes up. */
export function FieldOfViewDiagram() {
  const ex = 140;
  const ey = 128;
  return (
    <svg viewBox="0 0 280 168" className="sd" aria-hidden="true" focusable="false">
      <path d={`M${ex} ${ey}L56 30L224 30Z`} className="sd-wedge" />
      <path d={SCREEN} className="sd-screen" />
      <path d={`M${ex} ${ey}L56 30M${ex} ${ey}L224 30`} className="sd-line" />
      <path d={arc(ex, ey, 40, angleTo(ex, ey, 56, 30), angleTo(ex, ey, 224, 30))} className="sd-angle" />
      <SeatGlyph x={ex} y={ey + 10} />
    </svg>
  );
}

/** Top-down: how far your line to the screen's centre swings away from straight ahead. */
export function OffCentreDiagram() {
  const ex = 72;
  const ey = 128;
  return (
    <svg viewBox="0 0 280 168" className="sd" aria-hidden="true" focusable="false">
      <path d={SCREEN} className="sd-screen" />
      <path d="M140 26V160" className="sd-guide" />
      <path d={`M${ex} ${ey}V58`} className="sd-guide" />
      <path d={`M${ex} ${ey}L140 26`} className="sd-line" />
      <path d={arc(ex, ey, 46, -90, angleTo(ex, ey, 140, 26))} className="sd-angle" />
      <SeatGlyph x={ex} y={ey + 10} />
    </svg>
  );
}

/** Side view: how far you look up from eye level to the middle of the screen. */
export function HeadTiltDiagram() {
  const ex = 92;
  const ey = 118;
  const sx = 236;
  const sy = 66;
  return (
    <svg viewBox="0 0 280 168" className="sd" aria-hidden="true" focusable="false">
      <path d="M20 152H252" className="sd-guide" />
      <path d={`M${sx} 28V104`} className="sd-screen" />
      <path d={`M${ex} ${ey}H${sx - 6}`} className="sd-guide" />
      <path d={`M${ex} ${ey}L${sx} ${sy}`} className="sd-line" />
      <path d={arc(ex, ey, 64, angleTo(ex, ey, sx, sy), 0)} className="sd-angle" />
      <circle cx={ex} cy={ey} r="4" className="sd-eye" />
      <path d={`M${ex - 14} ${ey + 8}v24h26`} className="sd-chair" />
    </svg>
  );
}
