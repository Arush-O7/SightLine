import { memo } from 'react';
import type { HallLayout } from '../lib/hall';

const K = 10; // svg units per metre, as in the booking seat map

/** A small static seating plan drawn from the hall's real geometry, with one seat marked. */
function HallPlan({ layout, highlight, className = '' }: { layout: HallLayout; highlight: string; className?: string }) {
  const { config, grid, seatsWidth } = layout;
  const size = config.seatPitch * K * 0.8;
  const rowGap = config.seatPitch * K * 1.12;
  const pad = 4;
  const top = 13;
  const mapW = seatsWidth * K;
  const width = pad * 2 + mapW;
  const height = top + grid.length * rowGap + pad;
  const ox = pad + mapW / 2;
  return (
    <svg className={`hall-plan ${className}`} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <path d={`M ${pad + 2} 6 Q ${ox} 0.5 ${pad + mapW - 2} 6`} className="hall-plan-screen" fill="none" strokeLinecap="round" />
      {grid.map((row, r) =>
        row.map((seat) => (
          <rect
            key={seat.id}
            x={ox + seat.x * K - size / 2}
            y={top + r * rowGap}
            width={size}
            height={size}
            rx={size * 0.3}
            className={seat.id === highlight ? 'on' : undefined}
          />
        )),
      )}
    </svg>
  );
}

export default memo(HallPlan);
