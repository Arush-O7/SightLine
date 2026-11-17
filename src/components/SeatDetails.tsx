import { useEffect, useId, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';
import { seatEye, type HallLayout, type Seat } from '../lib/hall';

interface Props {
  layout: HallLayout;
  seat: Seat;
}

/** A small button that opens the seat's measurements: distance, field of view, position and head tilt. */
export default function SeatDetails({ layout, seat }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const m = layout.metrics[seat.index];
  const offCentre = seatEye(seat)[0];
  const tilt = Math.round(m.elevation);

  // close on Escape or a click anywhere else, and when another seat is chosen
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);
  useEffect(() => setOpen(false), [seat.id]);
  // the pop-up can open below the fold of a scrolling panel
  useEffect(() => {
    if (open) popRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open]);

  return (
    <div className="seat-details" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="seat-details-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <Info size={14} aria-hidden="true" /> Details
      </button>
      {open ? (
        <div className="seat-details-pop" ref={popRef} id={id} role="dialog" aria-label={`Measurements for seat ${seat.id}`}>
          <div className="seat-details-head">
            <p>From seat {seat.id}</p>
            <button type="button" className="icon-btn" aria-label="Close details" onClick={() => setOpen(false)} autoFocus>
              <X size={15} />
            </button>
          </div>
          <dl className="stats">
            <div>
              <dt>to screen</dt>
              <dd>{m.distance.toFixed(1)} m</dd>
            </div>
            <div>
              <dt>field of view</dt>
              <dd>{Math.round(m.hAngle)}°</dd>
            </div>
            <div>
              <dt>{Math.abs(offCentre) < 0.15 ? 'position' : offCentre < 0 ? 'left of centre' : 'right of centre'}</dt>
              <dd>{Math.abs(offCentre) < 0.15 ? 'Centre' : `${Math.abs(offCentre).toFixed(1)} m`}</dd>
            </div>
            <div>
              <dt>head tilt</dt>
              <dd>
                {Math.abs(tilt)}°{tilt > 0 ? ' up' : tilt < 0 ? ' down' : ''}
              </dd>
            </div>
          </dl>
          <p className="seat-details-hint">{m.hint}</p>
        </div>
      ) : null}
    </div>
  );
}
