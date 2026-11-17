import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  GitCompareArrows,
  Share2,
  Lightbulb,
  Minus,
  Plus,
  RotateCcw,
  ScanEye,
  Users,
  X,
} from 'lucide-react';
import Hall3D, { type Hall3DHandle } from '../components/Hall3D';
import SeatDetails from '../components/SeatDetails';
import SeatMap2D from '../components/SeatMap2D';
import NotFound from './NotFound';
import {
  BOOKING_FEE,
  MAX_SEATS,
  POPULAR_WEEKS,
  crowdFor,
  formatDate,
  formatTime,
  getMovie,
  money,
  parseShow,
  popularSeats,
  seatPopularity,
  showsFor,
  venueOf,
  type Show,
} from '../data/movies';
import { findBestSeats, getHall, getLayout, scoreColor, seatEye, type Seat } from '../lib/hall';
import { sortSeatIds, useStore } from '../lib/store';
import { api, ApiFailure, errorMessage } from '../lib/api';
import { useTitle } from '../lib/useTitle';
import type { LightMode, ViewMode } from '../three/HallScene';

const NO_SEATS: string[] = [];

export default function BookingPage() {
  const { showId } = useParams();
  const show = useMemo(() => parseShow(showId), [showId]);
  if (!show) return <NotFound title="That showtime doesn’t exist" />;
  return <Booking key={show.id} show={show} />;
}

function Booking({ show }: { show: Show }) {
  const movie = getMovie(show.movieId)!;
  const layout = useMemo(() => getLayout(show.hallId), [show.hallId]);
  const hall = layout.config;
  const navigate = useNavigate();

  const user = useStore((s) => s.user);
  const [params, setParams] = useSearchParams();
  useTitle(movie.title);
  const selectedIds = useStore((s) => s.selections[show.id]) ?? NO_SEATS;
  const toggleSeat = useStore((s) => s.toggleSeat);
  const setSeats = useStore((s) => s.setSeats);
  const setSnapshot = useStore((s) => s.setSnapshot);

  // live availability from the server; until it answers (or if it can't) fall back to the demo crowd
  const [serverTaken, setServerTaken] = useState<string[] | null>(null);
  const [offline, setOffline] = useState(false);
  const refreshSeats = useCallback(async () => {
    try {
      const { taken } = await api.seats(show.id);
      setServerTaken(taken);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [show.id]);
  useEffect(() => {
    void refreshSeats();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refreshSeats();
    }, 20000);
    const onFocus = () => void refreshSeats();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshSeats]);

  const occupied = useMemo(() => (serverTaken ? new Set(serverTaken) : crowdFor(show, layout)), [serverTaken, show, layout]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  // a shared link (?seat=H10) opens the hall at that seat; otherwise start at the best free one
  const [startSeat] = useState<string | null>(() => {
    const shared = params.get('seat');
    if (shared && layout.byId.has(shared)) return shared;
    return findBestSeats(layout, occupied, 1)[0]?.id ?? layout.bestSeatId;
  });
  // the starting seat was picked from the simulated crowd; live availability may disagree once it arrives
  const autoPicked = useRef(!(params.get('seat') && layout.byId.has(params.get('seat')!)));
  const [compareId, setCompareId] = useState<string | null>(null);
  const [shots, setShots] = useState<Record<string, string>>({});
  const [holding, setHolding] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinId, setPinId] = useState<string | null>(startSeat);
  const [mode, setMode] = useState<ViewMode>('seat');
  const [viewSeatId, setViewSeatId] = useState<string | null>(startSeat);
  const [heatmap, setHeatmap] = useState(false);
  const [lights, setLights] = useState<LightMode>('movie');
  const [audience, setAudience] = useState(true);
  const [party, setParty] = useState(2);
  const [toast, setToast] = useState<string | null>(null);
  const hallRef = useRef<Hall3DHandle>(null);
  const toastTimer = useRef<number>(0);

  const say = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  // if the seat chosen for the visitor turns out to be taken, move to the best free one (once, before they act)
  useEffect(() => {
    if (!serverTaken || !autoPicked.current) return;
    autoPicked.current = false;
    if (startSeat && occupied.has(startSeat) && viewSeatId === startSeat && pinId === startSeat) {
      const next = findBestSeats(layout, occupied, 1)[0]?.id;
      if (next) {
        setPinId(next);
        setViewSeatId(next);
      }
    }
    // runs when the first live answer arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverTaken]);

  // a seat picked earlier may have been booked since — drop it quietly
  useEffect(() => {
    const clean = selectedIds.filter((id) => !occupied.has(id) && layout.byId.has(id));
    if (clean.length !== selectedIds.length) setSeats(show.id, clean);
  }, [selectedIds, occupied, layout, setSeats, show.id]);

  const anchorId = mode === 'seat' ? viewSeatId : pinId;
  const focusId = mode === 'seat' ? viewSeatId : (hoverId ?? pinId);
  const focusSeat = focusId ? (layout.byId.get(focusId) ?? null) : null;
  const metrics = focusSeat ? layout.metrics[focusSeat.index] : null;
  const focusTaken = focusSeat ? occupied.has(focusSeat.id) : false;
  const focusPicked = focusSeat ? selected.has(focusSeat.id) : false;

  // the seats people book most in this kind of auditorium, and the ones still free for this show
  const popular = useMemo(() => popularSeats(show.hallId, layout), [show.hallId, layout]);
  const bookedShare = useMemo(() => seatPopularity(show.hallId, layout), [show.hallId, layout]);
  const popularFree = useMemo(
    () =>
      [...popular]
        .map((id) => layout.byId.get(id)!)
        .filter((seat) => !occupied.has(seat.id) && !selected.has(seat.id))
        .sort((a, b) => layout.metrics[b.index].score - layout.metrics[a.index].score)
        .slice(0, 6),
    [popular, layout, occupied, selected],
  );

  const toggle = useCallback(
    (seat: Seat) => {
      if (occupied.has(seat.id)) {
        say(`Seat ${seat.id} is already taken`);
        return;
      }
      const current = useStore.getState().selections[show.id] ?? [];
      if (!current.includes(seat.id) && current.length >= MAX_SEATS) {
        say(`You can book up to ${MAX_SEATS} seats at once`);
        return;
      }
      toggleSeat(show.id, seat.id);
    },
    [occupied, say, show.id, toggleSeat],
  );

  /** first tap looks from a seat, a second tap on the same seat selects it */
  const choose = useCallback(
    (seat: Seat) => {
      if (seat.id === anchorId) {
        toggle(seat);
        return;
      }
      setPinId(seat.id);
      if (mode === 'seat') hallRef.current?.enterSeat(seat.id);
    },
    [anchorId, mode, toggle],
  );

  const sitIn = useCallback((seat: Seat) => {
    setPinId(seat.id);
    hallRef.current?.enterSeat(seat.id);
  }, []);

  const onModeChange = useCallback((m: ViewMode, seat: Seat | null) => {
    setMode(m);
    setViewSeatId(seat?.id ?? null);
    if (seat) setPinId(seat.id);
    setLights(m === 'seat' ? 'movie' : 'house');
    setHoverId(null);
  }, []);

  const hop = useCallback(
    (dRow: number, dCol: number) => {
      const seat = anchorId ? layout.byId.get(anchorId) : null;
      if (!seat) return;
      const next = layout.grid[seat.row + dRow]?.[seat.col + dCol];
      if (!next) return;
      if (mode === 'seat') hallRef.current?.enterSeat(next.id);
      else setPinId(next.id);
    },
    [layout, anchorId, mode],
  );

  // keyboard: arrows move between seats and Enter selects, from the seat map or the 3D view
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const inMap = !!el?.closest?.('.seatmap');
      const neutral = !el || el === document.body || el.tagName === 'CANVAS' || el.id === 'main';
      if (!inMap && !neutral) return;
      const arrow = e.key.startsWith('Arrow');
      if (arrow && e.shiftKey && mode === 'seat') {
        // Shift + arrows turn your head instead of changing seat
        const step = 0.12;
        hallRef.current?.look(
          e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0,
          e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0,
        );
      } else if (e.key === 'ArrowLeft') hop(0, -1);
      else if (e.key === 'ArrowRight') hop(0, 1);
      else if (e.key === 'ArrowUp') hop(-1, 0);
      else if (e.key === 'ArrowDown') hop(1, 0);
      else if ((e.key === 'Enter' || (e.key === ' ' && inMap)) && focusSeat) toggle(focusSeat);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hop, toggle, focusSeat, mode]);

  const autoPick = () => {
    const seats = findBestSeats(layout, occupied, party);
    if (!seats.length) {
      say(`No ${party} seats left together — try a smaller group`);
      return;
    }
    setSeats(show.id, seats.map((s) => s.id));
    const mid = seats[Math.floor((seats.length - 1) / 2)];
    setPinId(mid.id);
    if (mode === 'seat') hallRef.current?.enterSeat(mid.id);
  };

  const picked = sortSeatIds(selectedIds)
    .map((id) => layout.byId.get(id))
    .filter((s): s is Seat => !!s);
  const subtotal = picked.reduce((sum, s) => sum + s.zone.price, 0);
  const fees = picked.length * BOOKING_FEE;

  const proceed = async () => {
    if (!picked.length || holding) return;
    let best = picked[0];
    for (const s of picked) if (layout.metrics[s.index].score > layout.metrics[best.index].score) best = s;
    const url = hallRef.current?.capture(best.id) ?? null;
    setSnapshot(show.id, url ? { seat: best.id, url } : null);
    if (!user) {
      // the seat choice is kept in the browser, so it is still here after signing in
      navigate(`/login?next=${encodeURIComponent(`/checkout/${show.id}`)}`);
      return;
    }
    setHolding(true);
    try {
      await api.hold(show.id, picked.map((s) => s.id));
      navigate(`/checkout/${show.id}`);
    } catch (err) {
      setHolding(false);
      say(errorMessage(err));
      if (err instanceof ApiFailure && err.code === 'seats_taken') void refreshSeats();
    }
  };

  // keep the address in step with the seat being viewed, so the page can be shared or reloaded as is
  useEffect(() => {
    if (!anchorId || params.get('seat') === anchorId) return;
    setParams({ seat: anchorId }, { replace: true });
  }, [anchorId, params, setParams]);

  const share = async (seat: Seat) => {
    const url = `${window.location.origin}${window.location.pathname}#/book/${show.id}?seat=${seat.id}`;
    const text = `${movie.title}: the view from seat ${seat.id}`;
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      say(`Link to seat ${seat.id} copied`);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      say('Copy the link from the address bar to share this seat');
    }
  };

  // compare: capture the view from the pinned seat and from the one being looked at now
  const compareSeat = compareId ? (layout.byId.get(compareId) ?? null) : null;
  const anchorSeat = anchorId ? (layout.byId.get(anchorId) ?? null) : null;
  const otherSeat = compareSeat && anchorSeat && anchorSeat.id !== compareSeat.id ? anchorSeat : null;
  useEffect(() => {
    if (!compareSeat) return;
    const need = [compareSeat.id, otherSeat?.id].filter((id): id is string => !!id && !shots[id]);
    if (!need.length) return;
    const added: Record<string, string> = {};
    for (const id of need) {
      const url = hallRef.current?.capture(id, 480);
      if (url) added[id] = url;
    }
    if (Object.keys(added).length) setShots((s) => ({ ...s, ...added }));
  }, [compareSeat, otherSeat, shots]);

  const viewSeat = viewSeatId ? layout.byId.get(viewSeatId) : null;
  const canHop = (dRow: number, dCol: number) => !!(viewSeat && layout.grid[viewSeat.row + dRow]?.[viewSeat.col + dCol]);

  const now = Date.now();
  const venue = venueOf(show);
  const sameDay = useMemo(
    () =>
      showsFor(movie, show.dateKey)
        .filter((g) => g.cinemaId === show.cinemaId)
        .flatMap((g) => g.shows)
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [movie, show.dateKey],
  );

  // keep the current showtime visible when the strip overflows on small screens
  useEffect(() => {
    document.querySelector('.bk-times a.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, []);


  return (
    <div className="bk">
      <header className="bk-bar">
        <Link to={`/movie/${movie.id}`} className="icon-btn" aria-label="Back to showtimes">
          <ChevronLeft size={18} />
        </Link>
        <div className="bk-title">
          <h1>{movie.title}</h1>
          <span>
            {venue ? `${venue.cinema.name} · ${venue.screen.name}, ${hall.format}` : hall.format} · {formatDate(show.start)}
          </span>
        </div>
        <nav className="bk-times" aria-label="Showtimes at this cinema">
          {sameDay.map((s) =>
            s.start.getTime() < now && s.id !== show.id ? null : (
              <Link key={s.id} to={`/book/${s.id}`} replace className={s.id === show.id ? 'on' : ''} aria-current={s.id === show.id}>
                {formatTime(s.start)}
                <small>{venueOf(s)?.screen.name ?? getHall(s.hallId).format}</small>
              </Link>
            ),
          )}
        </nav>
      </header>

      <div className="bk-main">
        <section className="stage" aria-label="3D hall preview">
          <Hall3D
            ref={hallRef}
            layout={layout}
            movie={movie}
            occupied={occupied}
            selected={selected}
            focusId={focusId}
            mode={mode}
            heatmap={heatmap}
            lights={lights}
            audience={audience}
            initialSeatId={startSeat}
            onHover={(seat) => setHoverId(seat?.id ?? null)}
            onSeatClick={choose}
            onSeatDoubleClick={sitIn}
            onModeChange={onModeChange}
          >
            <div className="stage-top">
              <div className="seg" role="tablist" aria-label="View">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'seat'}
                  className={mode === 'seat' ? 'on' : ''}
                  onClick={() => {
                    const id = pinId ?? startSeat;
                    if (mode !== 'seat' && id) hallRef.current?.enterSeat(id);
                  }}
                >
                  From Seat
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'orbit'}
                  className={mode === 'orbit' ? 'on' : ''}
                  onClick={() => hallRef.current?.exitSeat()}
                >
                  Whole Hall
                </button>
              </div>

              <div className="stage-tools" role="toolbar" aria-label="View options">
                <button
                  type="button"
                  className={lights === 'house' ? 'on' : ''}
                  aria-pressed={lights === 'house'}
                  onClick={() => setLights((l) => (l === 'movie' ? 'house' : 'movie'))}
                  title="House lights"
                  aria-label="House lights"
                >
                  <Lightbulb size={16} />
                </button>
                <button
                  type="button"
                  className={audience ? 'on' : ''}
                  aria-pressed={audience}
                  onClick={() => setAudience((a) => !a)}
                  title="Show audience"
                  aria-label="Show audience"
                >
                  <Users size={16} />
                </button>
                <button
                  type="button"
                  className={heatmap ? 'on' : ''}
                  aria-pressed={heatmap}
                  onClick={() => setHeatmap((h) => !h)}
                  title="Colour seats by view quality"
                  aria-label="Colour seats by view quality"
                >
                  <ScanEye size={16} />
                </button>
                <button type="button" onClick={() => hallRef.current?.recenter()} title="Reset view" aria-label="Reset view">
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>

            {mode === 'seat' && viewSeat && (
              <>
                <div className="stage-caption">
                  <i className={focusPicked ? 'on' : ''} />
                  View from {viewSeat.id}
                  <span>Drag or Shift + arrows to look around</span>
                </div>
                <div className="hop" aria-label="Move to a neighbouring seat">
                  <button type="button" disabled={!canHop(0, -1)} onClick={() => hop(0, -1)} aria-label="Seat to the left">
                    <ArrowLeft size={15} />
                  </button>
                  <div>
                    <button type="button" disabled={!canHop(-1, 0)} onClick={() => hop(-1, 0)} aria-label="Row in front">
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" disabled={!canHop(1, 0)} onClick={() => hop(1, 0)} aria-label="Row behind">
                      <ArrowDown size={15} />
                    </button>
                  </div>
                  <button type="button" disabled={!canHop(0, 1)} onClick={() => hop(0, 1)} aria-label="Seat to the right">
                    <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}
            {mode === 'orbit' && <div className="stage-caption plain">Drag to rotate · scroll to zoom · click a seat</div>}

            {offline ? <div className="stage-offline">Live availability is unavailable. Seats shown may be out of date.</div> : null}
            {toast && (
              <div className="toast" role="status">
                {toast}
              </div>
            )}
          </Hall3D>
        </section>

        <aside className="side">
          <div className="side-scroll">
            <section className="map-block">
              <div className="block-head">
                <h2>Choose Your Seats</h2>
                <label className="switch">
                  <input type="checkbox" checked={heatmap} onChange={(e) => setHeatmap(e.target.checked)} />
                  <span>View Quality</span>
                </label>
              </div>
              <SeatMap2D
                layout={layout}
                occupied={occupied}
                selected={selected}
                focusId={focusId}
                heatmap={heatmap}
                popular={popular}
                onHover={(seat) => mode === 'orbit' && setHoverId(seat?.id ?? null)}
                onSeatClick={choose}
              />
              {heatmap ? (
                <div className="legend heat">
                  <span>Fair</span>
                  <i style={{ background: `linear-gradient(90deg, ${scoreColor(30)}, ${scoreColor(61)}, ${scoreColor(92)})` }} />
                  <span>Best view</span>
                </div>
              ) : (
                <div className="legend">
                  <span>
                    <i className="free" /> Available
                  </span>
                  <span>
                    <i className="taken" /> Taken
                  </span>
                  <span>
                    <i className="access" /> Accessible
                  </span>
                  <span>
                    <i className="picked" /> Selected
                  </span>
                  <span>
                    <i className="popular" /> Most booked
                  </span>
                </div>
              )}
              {popularFree.length ? (
                <div className="popular-picks">
                  <p>Most booked seats still free</p>
                  <div className="popular-picks-list" role="group" aria-label="Most booked seats still free">
                    {popularFree.map((seat) => (
                      <button
                        key={seat.id}
                        type="button"
                        className={`chip ${focusId === seat.id ? 'on' : ''}`}
                        aria-pressed={focusId === seat.id}
                        onClick={() => choose(seat)}
                      >
                        {seat.id}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            {focusSeat && metrics && (
              <section className="seat-card" aria-live="polite">
                <div className="seat-card-head">
                  <div>
                    <h2>
                      Row {focusSeat.rowLabel}, Seat {focusSeat.number}
                    </h2>
                    <p>
                      {focusSeat.zone.name}
                      {focusSeat.accessible ? ' · Accessible' : ''} · {money(focusSeat.zone.price)}
                    </p>
                    <p className="verdict">{metrics.label}</p>
                  </div>
                  <div className="seat-card-side">
                    <div className="score" title="View score out of 100">
                      <b>{metrics.score}</b>
                      <span>view score</span>
                    </div>
                    <SeatDetails layout={layout} seat={focusSeat} />
                  </div>
                </div>
                {popular.has(focusSeat.id) ? (
                  <p className="seat-card-pop">
                    <i aria-hidden="true" /> One of the most booked seats here, taken at {Math.round((bookedShare.get(focusSeat.id) ?? 0) * 100)}% of shows in the
                    last {POPULAR_WEEKS} weeks
                  </p>
                ) : null}
                <div className="seat-card-tools">
                  <button
                    type="button"
                    className={`btn btn-secondary ${compareId === focusSeat.id ? 'on' : ''}`}
                    aria-pressed={compareId === focusSeat.id}
                    onClick={() => {
                      if (compareId === focusSeat.id) setCompareId(null);
                      else {
                        setCompareId(focusSeat.id);
                        setPinId(focusSeat.id);
                        say(`Now pick another seat to compare with ${focusSeat.id}`);
                      }
                    }}
                  >
                    <GitCompareArrows size={15} /> {compareId === focusSeat.id ? 'Comparing' : 'Compare'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => share(focusSeat)}>
                    <Share2 size={15} /> Share
                  </button>
                </div>
                <button
                  type="button"
                  className={`btn btn-block ${focusPicked ? 'btn-secondary' : 'btn-primary'}`}
                  disabled={focusTaken}
                  onClick={() => toggle(focusSeat)}
                >
                  {focusTaken ? 'This Seat Is Taken' : focusPicked ? `Remove Seat ${focusSeat.id}` : `Select Seat · ${money(focusSeat.zone.price)}`}
                </button>
              </section>
            )}

            {compareSeat ? (
              <section className="compare" aria-live="polite">
                <div className="block-head">
                  <h2>Compare Seats</h2>
                  <button type="button" className="btn btn-text" onClick={() => setCompareId(null)}>
                    Done
                  </button>
                </div>
                {otherSeat ? (
                  <>
                    <div className="compare-views">
                      {[compareSeat, otherSeat].map((seat) => (
                        <figure key={seat.id}>
                          {shots[seat.id] ? (
                            <img src={shots[seat.id]} width={480} height={270} alt={`View from seat ${seat.id}`} />
                          ) : (
                            <div className="compare-blank" />
                          )}
                          <figcaption>
                            <b>{seat.id}</b> {seat.zone.name}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                    <table className="compare-table">
                      <thead>
                        <tr>
                          <th scope="col">
                            <span className="sr-only">Measure</span>
                          </th>
                          <th scope="col">{compareSeat.id}</th>
                          <th scope="col">{otherSeat.id}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const a = layout.metrics[compareSeat.index];
                          const b = layout.metrics[otherSeat.index];
                          const pa = bookedShare.get(compareSeat.id) ?? 0;
                          const pb = bookedShare.get(otherSeat.id) ?? 0;
                          const rows: [string, string, string, number][] = [
                            ['View score', String(a.score), String(b.score), Math.sign(a.score - b.score)],
                            ['Booked at', `${Math.round(pa * 100)}% of shows`, `${Math.round(pb * 100)}% of shows`, Math.sign(Math.round(pa * 100) - Math.round(pb * 100))],
                            ['Price', money(compareSeat.zone.price), money(otherSeat.zone.price), Math.sign(otherSeat.zone.price - compareSeat.zone.price)],
                          ];
                          return rows.map(([label, av, bv, better]) => (
                            <tr key={label}>
                              <th scope="row">{label}</th>
                              <td className={better > 0 ? 'best' : ''}>{av}</td>
                              <td className={better < 0 ? 'best' : ''}>{bv}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <p className="muted small">Pick another seat on the map to compare it with {compareSeat.id}.</p>
                )}
              </section>
            ) : null}

            <section className="autopick">
              <div>
                <b>Not sure?</b>
                <span>We’ll pick the best free seats together.</span>
              </div>
              <div className="stepper" role="group" aria-label="Group size">
                <button type="button" onClick={() => setParty((p) => Math.max(1, p - 1))} disabled={party <= 1} aria-label="Fewer seats">
                  <Minus size={14} />
                </button>
                <output>{party}</output>
                <button type="button" onClick={() => setParty((p) => Math.min(MAX_SEATS, p + 1))} disabled={party >= MAX_SEATS} aria-label="More seats">
                  <Plus size={14} />
                </button>
              </div>
              <button type="button" className="btn btn-secondary" onClick={autoPick}>
                Pick for Me
              </button>
            </section>
          </div>

          <div className="side-foot">
            <div className="side-foot-info">
              {picked.length ? (
                <>
                  <div className="picked">
                    {picked.map((s) => (
                      <button key={s.id} type="button" onClick={() => toggleSeat(show.id, s.id)} title={`Remove ${s.id}`}>
                        {s.id} <X size={11} />
                      </button>
                    ))}
                  </div>
                  <span className="total">
                    <b>{money(subtotal + fees)}</b>
                    <small>incl. {money(fees)} fee</small>
                  </span>
                </>
              ) : (
                <span className="muted small">Tap a seat to see its view, tap again to select it.</span>
              )}
            </div>
            <button type="button" className="btn btn-primary btn-lg" disabled={!picked.length || holding} onClick={proceed}>
              {holding ? 'Holding Seats…' : user ? 'Continue to Payment' : 'Sign In to Continue'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
