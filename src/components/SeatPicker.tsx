import { memo, type MouseEvent } from 'react';
import type { HallLayout, Seat } from '../lib/hall';

const K = 10; // svg units per metre, as in the booking seat map

interface Props {
  layout: HallLayout;
  taken: Set<string>;
  current: string | null;
  onPick: (seat: Seat) => void;
}

/**
 * A pocket seat plan for the home page: tap a free seat and the 3D hall behind moves to it.
 * Pointer only; the preset buttons beside it give keyboard and screen-reader users the same choice.
 */
function SeatPicker({ layout, taken, current, onPick }: Props) {
  const { config, grid, seatsWidth } = layout;
  const size = config.seatPitch * K * 0.8;
  const rowGap = config.seatPitch * K * 1.12;
  const pad = 4;
  const top = 13;
  const mapW = seatsWidth * K;
  const width = pad * 2 + mapW;
  const height = top + grid.length * rowGap + pad;
  const ox = pad + mapW / 2;

  const click = (e: MouseEvent) => {
    const id = (e.target as Element).getAttribute?.('data-seat');
    const seat = id ? layout.byId.get(id) : undefined;
    if (seat && !taken.has(seat.id)) onPick(seat);
  };

  return (
    <svg className="seat-picker" viewBox={`0 0 ${width} ${height}`} onClick={click} aria-hidden="true" focusable="false">
      <path d={`M ${pad + 2} 6 Q ${ox} 0.5 ${pad + mapW - 2} 6`} className="seat-picker-screen" fill="none" strokeLinecap="round" />
      {grid.map((row, r) =>
        row.map((seat) => {
          const isTaken = taken.has(seat.id);
          return (
            <rect
              key={seat.id}
              data-seat={seat.id}
              x={ox + seat.x * K - size / 2}
              y={top + r * rowGap}
              width={size}
              height={size}
              rx={size * 0.3}
              className={seat.id === current ? 'on' : isTaken ? 'taken' : 'free'}
            />
          );
        }),
      )}
    </svg>
  );
}

export default memo(SeatPicker);
