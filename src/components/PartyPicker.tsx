import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { MAX_SEATS } from '../data/movies';
import { useStore } from '../lib/store';

/** How many seats are booked together. Showtimes score the best seats left for that many, and Pick for Me picks that many. */
export default function PartyPicker() {
  const party = useStore((s) => s.party);
  const setParty = useStore((s) => s.setParty);
  const label = useId();
  return (
    <div className="party">
      <span id={label}>Seats</span>
      <div className="stepper" role="group" aria-labelledby={label}>
        <button type="button" onClick={() => setParty((p) => p - 1)} disabled={party <= 1} aria-label="Fewer seats">
          <Minus size={14} />
        </button>
        <output aria-live="polite">{party}</output>
        <button type="button" onClick={() => setParty((p) => p + 1)} disabled={party >= MAX_SEATS} aria-label="More seats">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
