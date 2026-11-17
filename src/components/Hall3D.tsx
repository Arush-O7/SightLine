import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { HallScene, type LightMode, type ViewMode } from '../three/HallScene';
import { paintArt } from '../lib/art';
import type { HallLayout, Seat } from '../lib/hall';
import { money, type Movie } from '../data/movies';

export interface Hall3DHandle {
  enterSeat: (seatId: string) => void;
  exitSeat: () => void;
  recenter: () => void;
  look: (dYaw: number, dPitch: number) => void;
  capture: (seatId: string, width?: number) => string | null;
}

interface Props {
  layout: HallLayout;
  movie: Movie;
  occupied: Set<string>;
  selected: Set<string>;
  focusId: string | null;
  mode: ViewMode;
  heatmap: boolean;
  lights: LightMode;
  audience: boolean;
  onHover: (seat: Seat | null) => void;
  onSeatClick: (seat: Seat) => void;
  onSeatDoubleClick: (seat: Seat) => void;
  onModeChange: (mode: ViewMode, seat: Seat | null) => void;
  initialSeatId?: string | null;
  children?: ReactNode;
}

const Hall3D = forwardRef<Hall3DHandle, Props>(function Hall3D(props, ref) {
  const { layout, movie, occupied, selected, focusId, mode, heatmap, lights, audience, children } = props;
  const mountRef = useRef<HTMLDivElement>(null);
  const pipRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HallScene | null>(null);
  const handlers = useRef(props);
  handlers.current = props;
  const [tip, setTip] = useState<Seat | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let scene: HallScene;
    try {
      const s = layout.config.screen;
      scene = new HallScene(mount, layout, paintArt(movie, 'backdrop', 1792, 1792 / (s.width / s.height)), {
        onHover: (seat, x, y) => {
          handlers.current.onHover(seat);
          setTip(seat);
          const el = tipRef.current;
          const box = mount.getBoundingClientRect();
          if (el && seat) {
            const left = Math.min(box.width - 190, Math.max(8, x - box.left + 16));
            const top = Math.max(8, y - box.top - 74);
            el.style.transform = `translate(${left}px, ${top}px)`;
          }
        },
        onSeatClick: (seat) => handlers.current.onSeatClick(seat),
        onSeatDoubleClick: (seat) => handlers.current.onSeatDoubleClick(seat),
        onModeChange: (m, seat) => handlers.current.onModeChange(m, seat),
      });
    } catch (err) {
      console.error('3D hall failed to start', err);
      setFailed(true);
      return;
    }
    sceneRef.current = scene;
    setReady(true);
    // open straight into the seat the page is focused on, otherwise the overview
    const start = handlers.current.initialSeatId;
    if (start && layout.byId.has(start)) scene.enterSeatView(start);
    else handlers.current.onModeChange('orbit', null);
    return () => {
      sceneRef.current = null;
      setReady(false);
      scene.dispose();
    };
  }, [layout, movie]);

  useEffect(() => {
    sceneRef.current?.setSeatState({ occupied, selected, focusId, heatmap });
  }, [occupied, selected, focusId, heatmap, ready]);

  useEffect(() => {
    sceneRef.current?.setLights(lights);
  }, [lights, ready]);

  useEffect(() => {
    sceneRef.current?.setAudience(audience);
  }, [audience, ready]);

  const pipSeat = mode === 'orbit' && focusId ? layout.byId.get(focusId) ?? null : null;
  useEffect(() => {
    sceneRef.current?.setPipElement(pipSeat ? pipRef.current : null);
  }, [pipSeat, ready]);

  useImperativeHandle(
    ref,
    () => ({
      enterSeat: (id) => sceneRef.current?.enterSeatView(id),
      exitSeat: () => sceneRef.current?.exitSeatView(),
      recenter: () => sceneRef.current?.recenter(),
      look: (dYaw, dPitch) => sceneRef.current?.look(dYaw, dPitch),
      capture: (id, width) => sceneRef.current?.capture(id, width) ?? null,
    }),
    [],
  );

  const tipTaken = tip ? occupied.has(tip.id) : false;
  const tipMetrics = tip ? layout.metrics[tip.index] : null;

  return (
    <div className="hall3d">
      <div className="hall3d-canvas" ref={mountRef} />
      {failed && (
        <div className="hall3d-fallback">
          <strong>3D preview isn’t available on this device.</strong>
          <span>You can still choose seats on the seat map.</span>
        </div>
      )}

      <div className={`pip ${pipSeat ? 'on' : ''}`} aria-hidden={!pipSeat}>
        <div className="pip-frame" ref={pipRef} />
        <div className="pip-label">
          <span>
            View from <b>{pipSeat?.id}</b>
          </span>
          <button type="button" onClick={() => pipSeat && props.onSeatDoubleClick(pipSeat)}>
            Open
          </button>
        </div>
      </div>

      <div className={`seat-tip ${tip && mode === 'orbit' ? 'on' : ''}`} ref={tipRef}>
        {tip && tipMetrics && (
          <>
            <div className="seat-tip-head">
              <b>{tip.id}</b>
              <span>{tipTaken ? 'Taken' : money(tip.zone.price)}</span>
            </div>
            <div className="seat-tip-sub">
              {tip.accessible ? 'Accessible · ' : ''}
              {tip.zone.name} · view {tipMetrics.score}
            </div>
          </>
        )}
      </div>

      {children}
    </div>
  );
});

export default Hall3D;
