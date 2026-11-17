import { memo, useEffect, useRef, type MouseEvent } from 'react';
import { scoreColor, type HallLayout, type Seat } from '../lib/hall';
import { money } from '../data/movies';

interface Props {
  layout: HallLayout;
  occupied: Set<string>;
  selected: Set<string>;
  focusId: string | null;
  heatmap: boolean;
  onHover: (seat: Seat | null) => void;
  onSeatClick: (seat: Seat) => void;
}

const K = 10; // svg units per metre
const STATE_CLASS = { p: 'picked', t: 'taken', a: 'access', f: 'free' } as const;
type StateCode = keyof typeof STATE_CLASS;

interface RowProps {
  seats: Seat[];
  /** one character per seat (picked / taken / accessible / free) — a cheap value to compare */
  states: string;
  /** column of the focused seat in this row, or -1 */
  focusCol: number;
  /** view scores for this row when the heatmap is on, otherwise null */
  scores: number[] | null;
  y: number;
  size: number;
  ox: number;
  labelX: number;
}

/**
 * A hall has hundreds of seats and they must all stay on screen, so the map can't be
 * windowed. Instead each row is memoised: selecting or focusing a seat re-renders
 * only the one or two rows that actually changed, not every seat in the hall.
 */
const SeatRow = memo(function SeatRow({ seats, states, focusCol, scores, y, size, ox, labelX }: RowProps) {
  return (
    <g>
      <text x={labelX} y={y + size / 2 + 1.85} className="seatmap-row" textAnchor="end">
        {seats[0].rowLabel}
      </text>
      {seats.map((seat, i) => {
        const code = states[i] as StateCode;
        const taken = code === 't';
        const picked = code === 'p';
        const heat = scores && !picked && !taken ? scoreColor(scores[i]) : undefined;
        const focused = focusCol === i;
        return (
          <rect
            key={seat.id}
            x={ox + seat.x * K - size / 2}
            y={y}
            width={size}
            height={size}
            rx={size * 0.3}
            style={heat ? { fill: heat } : undefined}
            className={`seatmap-seat ${STATE_CLASS[code]}${focused ? ' focus' : ''}`}
            data-seat={seat.id}
            role="button"
            tabIndex={focused ? 0 : -1}
            aria-label={`Row ${seat.rowLabel}, seat ${seat.number}, ${taken ? 'taken' : `${seat.zone.name} ${money(seat.zone.price)}`}`}
            aria-pressed={picked}
            aria-disabled={taken}
          >
            <title>{`${seat.id} · ${taken ? 'Taken' : seat.zone.name}`}</title>
          </rect>
        );
      })}
    </g>
  );
});

function SeatMap2D({ layout, occupied, selected, focusId, heatmap, onHover, onSeatClick }: Props) {
  const { config, grid, seatsWidth } = layout;
  const size = config.seatPitch * K * 0.78;
  const rowGap = config.seatPitch * K * 1.14;
  // the labels are sized in map units; these margins leave room for them at a readable size
  const padL = 12;
  const padR = 36;
  const top = 19;
  const mapW = seatsWidth * K;
  const width = padL + mapW + padR;
  const height = top + grid.length * rowGap + 2;
  const ox = padL + mapW / 2;
  const svgRef = useRef<SVGSVGElement>(null);
  const hovered = useRef<string | null>(null);

  // roving focus: when the arrow keys move the focused seat, keyboard focus follows it
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !focusId || !svg.contains(document.activeElement)) return;
    svg.querySelector<SVGRectElement>(`[data-seat="${focusId}"]`)?.focus();
  }, [focusId]);

  // one listener for the whole map instead of three per seat
  const seatAt = (e: MouseEvent): Seat | null => {
    const id = (e.target as Element).closest?.('[data-seat]')?.getAttribute('data-seat');
    return id ? (layout.byId.get(id) ?? null) : null;
  };
  const handleClick = (e: MouseEvent) => {
    const seat = seatAt(e);
    if (seat) onSeatClick(seat);
  };
  const handleOver = (e: MouseEvent) => {
    const seat = seatAt(e);
    if ((seat?.id ?? null) === hovered.current) return;
    hovered.current = seat?.id ?? null;
    if (seat) onHover(seat);
  };
  const handleLeave = () => {
    hovered.current = null;
    onHover(null);
  };

  const focusSeat = focusId ? layout.byId.get(focusId) : undefined;

  return (
    <svg
      ref={svgRef}
      className="seatmap"
      viewBox={`0 0 ${width} ${height}`}
      role="group"
      aria-label="Seat map. Use the arrow keys to move between seats and Enter to select."
      onClick={handleClick}
      onMouseOver={handleOver}
      onMouseLeave={handleLeave}
    >
      <defs>
        <linearGradient id="screen-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M ${padL + 2} 6 Q ${ox} 0.5 ${padL + mapW - 2} 6 L ${padL + mapW - 8} 15 L ${padL + 8} 15 Z`} fill="url(#screen-glow)" />
      <path d={`M ${padL + 2} 6 Q ${ox} 0.5 ${padL + mapW - 2} 6`} className="seatmap-screen" fill="none" strokeLinecap="round" />
      <text x={ox} y={12.6} className="seatmap-label" textAnchor="middle">
        SCREEN
      </text>

      {config.zones.map((zone) => {
        const y0 = top + zone.fromRow * rowGap;
        const y1 = top + zone.toRow * rowGap + size;
        const x = padL + mapW + 5;
        return (
          <g key={zone.id} className="seatmap-zone">
            <path d={`M ${x - 1.4} ${y0} H ${x} V ${y1} H ${x - 1.4}`} fill="none" />
            {/* long zone names ("Recliner Prime") take two lines so they stay inside the map */}
            {(() => {
              const lines = zone.name.length > 9 && zone.name.includes(' ') ? zone.name.split(' ') : [zone.name];
              const first = (y0 + y1) / 2 - 0.8 - (lines.length - 1) * 3;
              return lines.map((line, i) => (
                <text key={line} x={x + 2.4} y={first + i * 6}>
                  {line}
                </text>
              ));
            })()}
            <text x={x + 2.4} y={(y0 + y1) / 2 + 5.2 + (zone.name.length > 9 && zone.name.includes(' ') ? 3 : 0)} className="price">
              {money(zone.price)}
            </text>
          </g>
        );
      })}

      {grid.map((row, r) => {
        let states = '';
        for (const seat of row) states += selected.has(seat.id) ? 'p' : occupied.has(seat.id) ? 't' : seat.accessible ? 'a' : 'f';
        return (
          <SeatRow
            key={r}
            seats={row}
            states={states}
            focusCol={focusSeat && focusSeat.row === r ? focusSeat.col : -1}
            scores={heatmap ? layout.rowScores[r] : null}
            y={top + r * rowGap}
            size={size}
            ox={ox}
            labelX={padL - 3.5}
          />
        );
      })}
    </svg>
  );
}

export default memo(SeatMap2D);
