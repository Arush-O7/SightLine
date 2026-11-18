import { useEffect, useRef } from 'react';
import { HallScene } from '../three/HallScene';
import { paintArt, paintPhoto } from '../lib/art';
import { screenPhoto } from '../lib/screenPhoto';
import type { HallLayout, Seat } from '../lib/hall';
import type { Movie } from '../data/movies';

interface Props {
  layout: HallLayout;
  movie: Movie;
  occupied: Set<string>;
  /** seats to visit, in order */
  tour: Seat[];
  onSeat: (seat: Seat | null) => void;
  onReady: () => void;
}

const HOLD_SEAT = 7000;
const HOLD_HALL = 3800;

/** The real 3D hall as the home page backdrop: it flies from the whole hall into a few seats and back. */
export default function HeroHall({ layout, movie, occupied, tour, onSeat, onReady }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onSeat, onReady });
  cb.current = { onSeat, onReady };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !tour.length) return;
    let scene: HallScene;
    let art: HTMLCanvasElement;
    let live = true;
    try {
      const s = layout.config.screen;
      art = paintArt(movie, 'backdrop', 1792, 1792 / (s.width / s.height));
      scene = new HallScene(mount, layout, art);
    } catch {
      return; // no WebGL: the still backdrop behind stays visible
    }
    const photo = screenPhoto(movie);
    if (photo) void paintPhoto(art, photo).then((ok) => ok && live && scene.refreshScreen());
    scene.setSeatState({ occupied, selected: new Set(), focusId: null, heatmap: false });
    scene.setAudience(true);
    scene.setLights('movie');
    cb.current.onReady();

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let step = 0;
    let timer = 0;
    let visible = true;

    const next = () => {
      if (!visible || document.hidden) return;
      const seat = tour[step % tour.length];
      scene.enterSeatView(seat.id);
      cb.current.onSeat(seat);
      if (reduced) return; // one still seat view, no tour
      timer = window.setTimeout(() => {
        scene.exitSeatView();
        cb.current.onSeat(null);
        step += 1;
        timer = window.setTimeout(next, HOLD_HALL);
      }, HOLD_SEAT);
    };
    timer = window.setTimeout(next, reduced ? 0 : 1800);

    // pause the tour while the hero is off screen
    const io = new IntersectionObserver(([entry]) => {
      const was = visible;
      visible = entry.isIntersecting;
      if (visible && !was) {
        window.clearTimeout(timer);
        timer = window.setTimeout(next, 600);
      } else if (!visible) {
        window.clearTimeout(timer);
      }
    });
    io.observe(mount);

    return () => {
      live = false;
      window.clearTimeout(timer);
      io.disconnect();
      scene.dispose();
    };
  }, [layout, movie, occupied, tour]);

  return <div className="hero-hall" ref={mountRef} aria-hidden="true" />;
}
