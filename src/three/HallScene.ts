import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { floorYAt, scoreColor, seatEye, type HallLayout, type Seat } from '../lib/hall';
import { averageColor } from '../lib/art';
import { clamp, hashString, lerp, mulberry32 } from '../lib/rng';

export type ViewMode = 'orbit' | 'seat';
export type LightMode = 'house' | 'movie';

export interface HallSceneEvents {
  onHover?: (seat: Seat | null, clientX: number, clientY: number) => void;
  onSeatClick?: (seat: Seat) => void;
  onSeatDoubleClick?: (seat: Seat) => void;
  onModeChange?: (mode: ViewMode, seat: Seat | null) => void;
}

export interface SeatVisualState {
  occupied: Set<string>;
  selected: Set<string>;
  focusId: string | null;
  heatmap: boolean;
}

const COLOR_VELVET = '#8a1a20';
const COLOR_OCCUPIED = '#3b0f13';
const ORBIT_FOV = 40;
const SEAT_FOV = 64;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Flight {
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  q0: THREE.Quaternion;
  q1: THREE.Quaternion;
  f0: number;
  f1: number;
  t: number;
  dur: number;
  lift: number;
  done?: () => void;
}

function paint(g: THREE.BufferGeometry, shade: number) {
  const geo = g.index ? g.toNonIndexed() : g;
  const n = geo.attributes.position.count;
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(shade), 3));
  return geo;
}

function buildSeatGeometry(): THREE.BufferGeometry {
  const cushion = new RoundedBoxGeometry(0.5, 0.15, 0.5, 3, 0.055);
  cushion.translate(0, 0.45, -0.03);
  const back = new RoundedBoxGeometry(0.5, 0.7, 0.13, 3, 0.055);
  back.rotateX(0.16);
  back.translate(0, 0.83, 0.27);
  const head = new RoundedBoxGeometry(0.36, 0.17, 0.09, 2, 0.04);
  head.rotateX(0.16);
  head.translate(0, 1.1, 0.25);
  const armL = new RoundedBoxGeometry(0.075, 0.24, 0.5, 2, 0.03);
  armL.translate(-0.285, 0.52, 0.0);
  const armR = armL.clone().translate(0.57, 0, 0);
  const base = new THREE.BoxGeometry(0.4, 0.4, 0.38);
  base.translate(0, 0.2, 0.02);
  const parts = [paint(cushion, 1), paint(back, 0.92), paint(head, 1.12), paint(armL, 0.1), paint(armR, 0.1), paint(base, 0.07)];
  const merged = mergeGeometries(parts, false)!;
  merged.computeBoundingSphere();
  merged.computeBoundingBox();
  return merged;
}

function buildPersonGeometry(): THREE.BufferGeometry {
  const torso = new THREE.CapsuleGeometry(0.17, 0.3, 4, 10);
  torso.scale(1.28, 1, 0.82);
  torso.translate(0, 0.78, 0.1);
  const head = new THREE.SphereGeometry(0.108, 14, 10);
  head.translate(0, 1.19, 0.11);
  const strip = (g: THREE.BufferGeometry) => {
    const geo = g.index ? g.toNonIndexed() : g;
    geo.deleteAttribute('uv');
    return geo;
  };
  return mergeGeometries([strip(torso), strip(head)], false)!;
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class HallScene {
  readonly layout: HallLayout;
  private container: HTMLElement;
  private events: HallSceneEvents;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private pipCamera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private last = 0;
  private time = 0;
  private raf = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;

  private seatMesh!: THREE.InstancedMesh;
  private peopleMesh!: THREE.InstancedMesh;
  private marker!: THREE.Mesh;
  private screenMat!: THREE.MeshBasicMaterial;
  private screenTex!: THREE.CanvasTexture;
  private beamMat!: THREE.MeshBasicMaterial;
  private glowMats: THREE.MeshBasicMaterial[] = [];
  private lampMats: THREE.MeshBasicMaterial[] = [];
  private ambient!: THREE.AmbientLight;
  private hemi!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private screenLight!: THREE.PointLight;

  private state: SeatVisualState = { occupied: new Set(), selected: new Set(), focusId: null, heatmap: false };
  private audience = true;
  private lightMode: LightMode = 'house';
  private lightT = 0; // 0 = house lights, 1 = movie
  private mode: ViewMode = 'orbit';
  private flight: Flight | null = null;
  private orbitPose = { position: new THREE.Vector3(), fov: ORBIT_FOV };
  private homePosition = new THREE.Vector3();
  private homeTarget = new THREE.Vector3();
  private baseYaw = 0;
  private basePitch = 0;
  private yawOff = 0;
  private pitchOff = 0;
  private seatFov = SEAT_FOV;
  private pipEl: HTMLElement | null = null;
  private pipBox: { x: number; y: number; width: number; height: number; canvasW: number; canvasH: number } | null = null;
  private reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private pointer = { ndc: new THREE.Vector2(), clientX: 0, clientY: 0, inside: false, dirty: false };
  private down: { x: number; y: number; t: number; id: number } | null = null;
  private dragging = false;
  private hoverId: string | null = null;
  private tmpColor = new THREE.Color();
  private white = new THREE.Color('#ffffff');
  private dummy = new THREE.Object3D();

  /** Call after drawing new art onto the screen canvas passed to the constructor. */
  refreshScreen() {
    this.screenTex.needsUpdate = true;
  }

  constructor(container: HTMLElement, layout: HallLayout, screenImage: HTMLCanvasElement, events: HallSceneEvents = {}) {
    this.container = container;
    this.layout = layout;
    this.events = events;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setClearColor('#0b0b0c', 1);
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.setAttribute(
      'aria-label',
      `Interactive 3D view of ${layout.config.name}. Arrow keys change seat, Shift plus arrow keys look around, Enter selects.`,
    );
    this.renderer.domElement.setAttribute('role', 'application');
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(ORBIT_FOV, w / h, 0.05, 400);
    this.pipCamera = new THREE.PerspectiveCamera(SEAT_FOV, 16 / 9, 0.05, 400);

    this.buildRoom();
    this.buildScreen(screenImage);
    this.buildSeats();
    this.buildLights(screenImage);

    // camera home: three-quarter view from the back corner, looking down into the hall
    const span = Math.max(layout.width, layout.zBack - layout.zFront);
    const midZ = (layout.zBack + layout.zFront) / 2;
    this.homeTarget.set(0, layout.rowsY[layout.rowsY.length - 1] * 0.4 + 0.6, midZ * 0.92);
    const fit = Math.pow(Math.max(1, 1.45 / (w / h)), 0.55); // step back on tall, narrow viewports
    this.homePosition
      .set(-0.52, 0.6, 0.6)
      .normalize()
      .multiplyScalar(span * 1.5 * fit)
      .add(this.homeTarget);
    this.camera.position.copy(this.homePosition).add(new THREE.Vector3(-span * 0.5, span * 0.7, span * 0.5));
    this.camera.lookAt(this.homeTarget);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.homeTarget);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 5;
    this.controls.maxDistance = span * 2.6;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.06;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 0.8;
    this.controls.panSpeed = 0.6;
    this.controls.enabled = false;
    this.controls.addEventListener('change', () => {
      const t = this.controls.target;
      t.x = clamp(t.x, -layout.width / 2, layout.width / 2);
      t.y = clamp(t.y, 0, layout.height);
      t.z = clamp(t.z, layout.zFront, layout.zBack);
    });

    // post-processing: a touch of bloom so the screen and aisle lights glow
    const target = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.3, 0.55, 0.93);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // opening move
    this.startFlight(this.homePosition, this.lookQuat(this.homePosition, this.homeTarget), ORBIT_FOV, 1.7, 0, () => {
      this.controls.enabled = true;
    });

    const el = this.renderer.domElement;
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerCancel);
    el.addEventListener('pointerleave', this.onPointerLeave);
    el.addEventListener('dblclick', this.onDoubleClick);
    el.addEventListener('wheel', this.onWheel, { passive: false });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);

    this.applySeatColors();
    this.applyAudience();
    this.raf = requestAnimationFrame(this.frame);
  }

  private buildRoom() {
    const L = this.layout;
    const { width: W, height: H, zFront, zBack } = L;
    const len = zBack - zFront;
    const midZ = (zBack + zFront) / 2;
    const cfg = L.config;

    // soft pool of light under the model so it doesn't float in a void
    const haloTex = canvasTexture(256, 256, (ctx) => {
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, 'rgba(58,54,50,0.5)');
      g.addColorStop(0.5, 'rgba(34,32,30,0.22)');
      g.addColorStop(1, 'rgba(11,11,12,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    });
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, depthWrite: false, toneMapped: false }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.scale.setScalar(Math.max(W, len) * 3.4);
    halo.position.set(0, -0.06, midZ);
    halo.renderOrder = -1;
    this.scene.add(halo);

    const carpet = new THREE.MeshStandardMaterial({ color: '#1a1817', roughness: 0.96 });
    const riserMat = new THREE.MeshStandardMaterial({ color: '#211e1d', roughness: 0.95 });

    // slab + floor
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, len), riserMat);
    slab.position.set(0, -0.15, midZ);
    this.scene.add(slab);

    // stepped platforms
    for (let r = 1; r < cfg.rows; r++) {
      const zStart = L.rowsZ[r] - cfg.rowPitch / 2;
      const zEnd = r === cfg.rows - 1 ? zBack : L.rowsZ[r] + cfg.rowPitch / 2;
      const depth = zEnd - zStart;
      const top = L.rowsY[r];
      const step = new THREE.Mesh(new THREE.BoxGeometry(W, cfg.riser, depth), r % 2 ? carpet : riserMat);
      step.position.set(0, top - cfg.riser / 2, zStart + depth / 2);
      this.scene.add(step);
      // fill underneath so the cut-away side reads as a solid stand
      if (top - cfg.riser > 0.001) {
        const fill = new THREE.Mesh(new THREE.BoxGeometry(W, top - cfg.riser, depth), riserMat);
        fill.position.set(0, (top - cfg.riser) / 2, zStart + depth / 2);
        this.scene.add(fill);
      }
    }

    // walls: single-sided, so whichever wall is between you and the hall simply disappears
    const wallTex = canvasTexture(256, 512, (ctx) => {
      ctx.fillStyle = '#181615';
      ctx.fillRect(0, 0, 256, 512);
      const g = ctx.createLinearGradient(0, 0, 256, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.5)');
      g.addColorStop(0.08, 'rgba(255,255,255,0.05)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.02)');
      g.addColorStop(0.92, 'rgba(0,0,0,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 512);
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      for (let y = 0; y < 512; y += 6) ctx.fillRect(0, y, 256, 1);
    });
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    const sideTex = wallTex.clone();
    sideTex.repeat.set(Math.round(len / 1.6), 1);
    sideTex.needsUpdate = true;
    const backTex = wallTex.clone();
    backTex.repeat.set(Math.round(W / 1.6), 1);
    backTex.needsUpdate = true;
    const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 1 });
    const backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 1 });

    const plane = (w: number, h: number, mat: THREE.Material, pos: [number, number, number], rotY = 0, rotX = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(...pos);
      m.rotation.set(rotX, rotY, 0);
      this.scene.add(m);
      return m;
    };
    plane(len, H, sideMat, [-W / 2, H / 2, midZ], Math.PI / 2);
    plane(len, H, sideMat, [W / 2, H / 2, midZ], -Math.PI / 2);
    plane(W, H, backMat, [0, H / 2, zBack], Math.PI);

    // front wall: pleated curtain
    const curtainTex = canvasTexture(256, 64, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 256, 0);
      for (let i = 0; i <= 8; i++) {
        g.addColorStop(i / 8, i % 2 ? '#211d1b' : '#0c0b0a');
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 64);
    });
    curtainTex.wrapS = THREE.RepeatWrapping;
    curtainTex.repeat.set(Math.round(W / 2.2), 1);
    plane(W, H, new THREE.MeshStandardMaterial({ map: curtainTex, roughness: 1 }), [0, H / 2, zFront]);

    // ceiling
    plane(W, len, new THREE.MeshStandardMaterial({ color: '#0c0b0b', roughness: 1 }), [0, H, midZ], 0, Math.PI / 2);

    // ceiling down-lights
    const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.86, 0.66) });
    this.lampMats.push(lampMat);
    const lampGeo = new THREE.CircleGeometry(0.1, 14);
    lampGeo.rotateX(Math.PI / 2);
    const nx = Math.max(2, Math.round(W / 3.2));
    const nz = Math.max(2, Math.round(len / 3.2));
    const lamps = new THREE.InstancedMesh(lampGeo, lampMat, nx * nz);
    let li = 0;
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        this.dummy.position.set(-W / 2 + (W * (i + 0.5)) / nx, H - 0.02, zFront + 2.5 + ((len - 3.5) * (j + 0.5)) / nz);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        lamps.setMatrixAt(li++, this.dummy.matrix);
      }
    this.scene.add(lamps);

    // wall sconces — a warm strip and a soft glow, both facing inwards only
    const glowTex = canvasTexture(128, 256, (ctx) => {
      const g = ctx.createRadialGradient(64, 128, 0, 64, 128, 128);
      g.addColorStop(0, 'rgba(255,190,120,0.8)');
      g.addColorStop(0.35, 'rgba(255,150,80,0.22)');
      g.addColorStop(1, 'rgba(255,150,80,0)');
      ctx.save();
      ctx.translate(64, 128);
      ctx.scale(0.5, 1);
      ctx.translate(-64, -128);
      ctx.fillStyle = g;
      ctx.fillRect(-128, 0, 384, 256);
      ctx.restore();
    });
    const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.15, 0.55) });
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.9,
    });
    this.lampMats.push(stripMat);
    this.glowMats.push(glowMat);
    const sconceCount = Math.max(3, Math.round(len / 3.4));
    for (let i = 0; i < sconceCount; i++) {
      const z = zFront + 2.4 + ((len - 3.6) * (i + 0.5)) / sconceCount;
      const y = Math.min(H - 1.2, floorYAt(L, z) + 2.35);
      for (const side of [-1, 1]) {
        const rotY = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        plane(1.9, 3.4, glowMat, [side * (W / 2 - 0.02), y, z], rotY).renderOrder = 2;
        plane(0.09, 1.25, stripMat, [side * (W / 2 - 0.035), y, z], rotY);
      }
    }

    // aisle step lights
    const stepGeo = new THREE.BoxGeometry(0.46, 0.028, 0.03);
    const stepMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.25, 0.45) });
    const stepCount = (cfg.rows - 1) * L.aisleXs.length * 2;
    const steps = new THREE.InstancedMesh(stepGeo, stepMat, stepCount);
    let si = 0;
    for (let r = 1; r < cfg.rows; r++) {
      const z = L.rowsZ[r] - cfg.rowPitch / 2 - 0.016;
      L.aisleXs.forEach((ax, ai) => {
        const edge = ai === 0 || ai === L.aisleXs.length - 1;
        const half = (edge ? L.sideAisleWidth : cfg.aisle) / 2 - 0.32;
        for (const s of [-1, 1]) {
          this.dummy.position.set(ax + s * Math.max(0.05, half), L.rowsY[r] - 0.03, z);
          this.dummy.rotation.set(0, 0, 0);
          this.dummy.scale.set(1, 1, 1);
          this.dummy.updateMatrix();
          steps.setMatrixAt(si++, this.dummy.matrix);
        }
      });
    }
    this.scene.add(steps);

    // row letters on the outer aisles
    for (let r = 0; r < cfg.rows; r++) {
      const letter = L.grid[r][0].rowLabel;
      const tex = canvasTexture(96, 96, (ctx) => {
        ctx.clearRect(0, 0, 96, 96);
        ctx.fillStyle = 'rgba(236,235,231,0.9)';
        ctx.font = '700 64px "Geist Variable", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, 48, 52);
      });
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 });
      for (const side of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), mat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(side * (L.seatsWidth / 2 + 0.42), L.rowsY[r] + 0.012, L.rowsZ[r] + 0.05);
        this.scene.add(m);
      }
    }

    // projector port and beam
    const port: [number, number, number] = [0, H - 0.75, zBack - 0.03];
    plane(0.5, 0.26, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.6, 3.2) }), port, Math.PI);
    const s = cfg.screen;
    const corners = [
      [-s.width / 2, s.bottom, 0],
      [s.width / 2, s.bottom, 0],
      [s.width / 2, s.bottom + s.height, 0],
      [-s.width / 2, s.bottom + s.height, 0],
    ];
    const beamGeo = new THREE.BufferGeometry();
    beamGeo.setAttribute('position', new THREE.Float32BufferAttribute([...port, ...corners.flat()], 3));
    beamGeo.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]);
    this.beamMat = new THREE.MeshBasicMaterial({
      color: '#b9cdff', // projector-beam (DESIGN.md)
      transparent: true,
      opacity: 0.03,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(beamGeo, this.beamMat);
    beam.renderOrder = 3;
    this.scene.add(beam);
  }

  private buildScreen(image: HTMLCanvasElement) {
    const s = this.layout.config.screen;
    const curved = (w: number, h: number) => {
      const g = new THREE.PlaneGeometry(w, h, 48, 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, s.curve * p.getX(i) * p.getX(i));
      g.computeVertexNormals();
      return g;
    };
    const cy = s.bottom + s.height / 2;

    const mask = new THREE.Mesh(curved(s.width + 0.5, s.height + 0.5), new THREE.MeshBasicMaterial({ color: '#030304' }) /* screen-mask (DESIGN.md) */);
    mask.position.set(0, cy, -0.04);
    this.scene.add(mask);

    this.screenTex = new THREE.CanvasTexture(image);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    this.screenTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.screenTex.repeat.set(0.94, 0.94);
    this.screenMat = new THREE.MeshBasicMaterial({ map: this.screenTex });
    const screen = new THREE.Mesh(curved(s.width, s.height), this.screenMat);
    screen.position.set(0, cy, 0);
    this.scene.add(screen);

    const stage = new THREE.Mesh(
      new THREE.BoxGeometry(s.width + 1.2, 0.45, 1.3),
      new THREE.MeshStandardMaterial({ color: '#0c0b0b', roughness: 0.9 }),
    );
    stage.position.set(0, 0.225, -0.2);
    this.scene.add(stage);
  }

  private buildSeats() {
    const L = this.layout;
    const [sx, sz] = L.config.seatScale;
    const n = L.seats.length;

    const seatMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0,
      sheen: 1,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color('#ff7a6b'),
    });
    // let each seat's own colour glow a little, so states stay readable with the lights down
    seatMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += vColor.rgb * 0.1;',
      );
    };
    this.seatMesh = new THREE.InstancedMesh(buildSeatGeometry(), seatMat, n);
    this.seatMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    const personMat = new THREE.MeshStandardMaterial({ roughness: 1, color: '#ffffff' });
    this.peopleMesh = new THREE.InstancedMesh(buildPersonGeometry(), personMat, n);
    this.peopleMesh.raycast = () => {};

    const rng = mulberry32(hashString(L.config.id));
    const tones = ['#1a1c26', '#23202b', '#1c2430', '#2a2226', '#181a20', '#262a36'];
    L.seats.forEach((seat, i) => {
      this.dummy.position.set(seat.x, seat.y, seat.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(sx, 1, sz);
      this.dummy.updateMatrix();
      this.seatMesh.setMatrixAt(i, this.dummy.matrix);
      this.seatMesh.setColorAt(i, this.tmpColor.set(COLOR_VELVET));
      this.peopleMesh.setColorAt(i, this.tmpColor.set(tones[Math.floor(rng() * tones.length)]));
    });
    this.seatMesh.computeBoundingSphere();
    this.scene.add(this.seatMesh, this.peopleMesh);

    // marker that floats over the seat you are previewing
    const markerGeo = new THREE.ConeGeometry(0.13, 0.3, 4);
    markerGeo.rotateX(Math.PI);
    this.marker = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 1.15) }));
    this.marker.visible = false;
    this.scene.add(this.marker);
  }

  private buildLights(image: HTMLCanvasElement) {
    const L = this.layout;
    this.ambient = new THREE.AmbientLight('#b8b0aa', 1.5);
    this.hemi = new THREE.HemisphereLight('#efe6dc', '#1c1612', 1.2);
    this.keyLight = new THREE.DirectionalLight('#ffe6cc', 1.6);
    this.keyLight.position.set(-0.5, 1, 0.7);
    const [r, g, b] = averageColor(image);
    this.screenLight = new THREE.PointLight(new THREE.Color(lerp(1, r, 0.75), lerp(1, g, 0.75), lerp(1, b, 0.75)), 8, 0, 1);
    this.screenLight.position.set(0, L.screenCenter[1], 2.6);
    this.scene.add(this.ambient, this.hemi, this.keyLight, this.screenLight);
  }

  setEvents(events: HallSceneEvents) {
    this.events = events;
  }

  setSeatState(next: Partial<SeatVisualState>) {
    const prevOccupied = this.state.occupied;
    this.state = { ...this.state, ...next };
    this.applySeatColors();
    if (next.occupied && next.occupied !== prevOccupied) this.applyAudience();
    this.updateMarker();
  }

  private seatColor(seat: Seat): THREE.Color {
    const { occupied, selected, heatmap, focusId } = this.state;
    const c = this.tmpColor;
    // selected seats are lit well past white so they read as "glowing" in a dark room
    if (selected.has(seat.id)) c.setRGB(2.6, 1.95, 1.05);
    else if (occupied.has(seat.id)) c.set(COLOR_OCCUPIED);
    else if (heatmap) c.set(scoreColor(this.layout.metrics[seat.index].score));
    else c.set(COLOR_VELVET);
    if (focusId === seat.id && !selected.has(seat.id)) c.lerp(this.white, 0.3).multiplyScalar(1.5);
    return c;
  }

  private applySeatColors() {
    this.layout.seats.forEach((seat, i) => this.seatMesh.setColorAt(i, this.seatColor(seat)));
    if (this.seatMesh.instanceColor) this.seatMesh.instanceColor.needsUpdate = true;
  }

  private applyAudience() {
    const rng = mulberry32(hashString(this.layout.config.id + 'people'));
    this.layout.seats.forEach((seat, i) => {
      const lean = (rng() - 0.5) * 0.14;
      const tall = 0.93 + rng() * 0.12;
      const show = this.audience && this.state.occupied.has(seat.id);
      this.dummy.position.set(seat.x + lean * 0.3, seat.y, seat.z);
      this.dummy.rotation.set(0, lean, lean * 0.4);
      this.dummy.scale.setScalar(show ? 1 : 0).multiply(new THREE.Vector3(1, tall, 1));
      this.dummy.updateMatrix();
      this.peopleMesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.peopleMesh.instanceMatrix.needsUpdate = true;
  }

  setAudience(visible: boolean) {
    if (this.audience === visible) return;
    this.audience = visible;
    this.applyAudience();
  }

  setLights(mode: LightMode) {
    this.lightMode = mode;
  }

  setPipElement(el: HTMLElement | null) {
    this.pipEl = el;
    this.pipBox = null;
  }

  private updateMarker() {
    const seat = this.state.focusId ? this.layout.byId.get(this.state.focusId) : null;
    this.marker.visible = !!seat && this.mode === 'orbit';
    if (seat) this.marker.userData.base = new THREE.Vector3(seat.x, seat.y + 1.72, seat.z + 0.1);
  }

  private lookQuat(from: THREE.Vector3, to: THREE.Vector3): THREE.Quaternion {
    const m = new THREE.Matrix4().lookAt(from, to, new THREE.Vector3(0, 1, 0));
    return new THREE.Quaternion().setFromRotationMatrix(m);
  }

  private startFlight(p1: THREE.Vector3, q1: THREE.Quaternion, f1: number, dur: number, lift = 0, done?: () => void) {
    this.flight = {
      p0: this.camera.position.clone(),
      p1: p1.clone(),
      q0: this.camera.quaternion.clone(),
      q1: q1.clone(),
      f0: this.camera.fov,
      f1,
      t: 0,
      dur: this.reducedMotion ? 0.001 : dur,
      lift,
      done,
    };
  }

  private seatPose(seat: Seat) {
    const [ex, ey, ez] = seatEye(seat);
    const [tx, ty, tz] = this.layout.screenCenter;
    const dx = tx - ex;
    const dy = ty - ey;
    const dz = tz - ez;
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(dy, Math.hypot(dx, dz));
    return { eye: new THREE.Vector3(ex, ey, ez), yaw, pitch };
  }

  getMode(): ViewMode {
    return this.mode;
  }

  enterSeatView(seatId: string) {
    const seat = this.layout.byId.get(seatId);
    if (!seat) return;
    const hop = this.mode === 'seat';
    if (!hop) {
      const from = this.flight ? this.homePosition : this.camera.position;
      this.orbitPose.position.copy(from);
      this.orbitPose.fov = ORBIT_FOV;
      this.seatFov = SEAT_FOV;
    }
    this.controls.enabled = false;
    this.mode = 'seat';
    this.yawOff = 0;
    this.pitchOff = 0;
    const pose = this.seatPose(seat);
    this.baseYaw = pose.yaw;
    this.basePitch = pose.pitch;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.pitch, pose.yaw, 0, 'YXZ'));
    this.startFlight(pose.eye, q, this.seatFov, hop ? 0.55 : 1.5, hop ? 0.0 : 0);
    this.marker.visible = false;
    this.setHover(null);
    this.renderer.domElement.style.cursor = 'grab';
    this.events.onModeChange?.('seat', seat);
  }

  exitSeatView() {
    if (this.mode !== 'seat') return;
    this.mode = 'orbit';
    const p = this.orbitPose.position;
    this.startFlight(p, this.lookQuat(p, this.controls.target), this.orbitPose.fov, 1.25, 0, () => {
      this.controls.enabled = true;
      this.updateMarker();
    });
    this.renderer.domElement.style.cursor = '';
    this.events.onModeChange?.('orbit', null);
  }

  /** Turn the head by a step (radians) while seated: the keyboard equivalent of dragging. */
  look(dYaw: number, dPitch: number) {
    if (this.mode !== 'seat' || this.flight) return;
    this.yawOff = clamp(this.yawOff + dYaw, -2.3, 2.3);
    this.pitchOff = clamp(this.pitchOff + dPitch, -1.2 - this.basePitch, 1.2 - this.basePitch);
  }

  recenter() {
    if (this.mode === 'seat') {
      this.yawOff = 0;
      this.pitchOff = 0;
      this.seatFov = SEAT_FOV;
      return;
    }
    this.controls.enabled = false;
    this.controls.target.copy(this.homeTarget);
    this.startFlight(this.homePosition, this.lookQuat(this.homePosition, this.homeTarget), ORBIT_FOV, 0.9, 0, () => {
      this.controls.enabled = true;
    });
  }

  /** Render the view from a seat and return it as a JPEG data URL (used on the ticket). */
  capture(seatId: string, width = 720): string | null {
    const seat = this.layout.byId.get(seatId);
    if (!seat) return null;
    try {
      const canvas = this.renderer.domElement;
      const aspect = 16 / 9;
      this.placePipCamera(seat, aspect, 56);
      const markerWas = this.marker.visible;
      this.marker.visible = false;
      this.applyLights(1);
      const size = this.renderer.getSize(new THREE.Vector2());
      let vw = size.x;
      let vh = size.x / aspect;
      if (vh > size.y) {
        vh = size.y;
        vw = size.y * aspect;
      }
      this.renderer.setRenderTarget(null);
      this.renderer.setViewport(0, 0, vw, vh);
      this.renderer.setScissor(0, 0, vw, vh);
      this.renderer.setScissorTest(true);
      this.renderer.clear();
      this.renderer.render(this.scene, this.pipCamera);
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, size.x, size.y);
      this.marker.visible = markerWas;
      this.applyLights(this.lightT);

      const out = document.createElement('canvas');
      out.width = width;
      out.height = Math.round(width / aspect);
      const pr = canvas.width / size.x;
      // WebGL's origin is bottom-left, so the region we drew sits at the bottom of the canvas
      out.getContext('2d')!.drawImage(canvas, 0, canvas.height - vh * pr, vw * pr, vh * pr, 0, 0, out.width, out.height);
      return out.toDataURL('image/jpeg', 0.84);
    } catch {
      return null;
    }
  }

  private placePipCamera(seat: Seat, aspect: number, fov = SEAT_FOV) {
    const pose = this.seatPose(seat);
    this.pipCamera.position.copy(pose.eye);
    this.pipCamera.rotation.set(pose.pitch, pose.yaw, 0, 'YXZ');
    this.pipCamera.fov = fov;
    this.pipCamera.aspect = aspect;
    this.pipCamera.updateProjectionMatrix();
  }

  private setPointer(e: PointerEvent | MouseEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.pointer.clientX = e.clientX;
    this.pointer.clientY = e.clientY;
  }

  private pick(): Seat | null {
    this.raycaster.setFromCamera(this.pointer.ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.seatMesh, false)[0];
    if (!hit || hit.instanceId === undefined) return null;
    return this.layout.seats[hit.instanceId] ?? null;
  }

  private setHover(seat: Seat | null) {
    const id = seat?.id ?? null;
    if (id !== this.hoverId) {
      this.hoverId = id;
      if (this.mode === 'orbit') this.renderer.domElement.style.cursor = seat ? 'pointer' : '';
    }
    this.events.onHover?.(seat, this.pointer.clientX, this.pointer.clientY);
  }

  private onPointerMove = (e: PointerEvent) => {
    this.setPointer(e);
    this.pointer.inside = true;
    if (this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5) this.dragging = true;
    if (this.mode === 'seat') {
      if (this.down && !this.flight) {
        const sens = THREE.MathUtils.degToRad(this.camera.fov) / this.renderer.domElement.clientHeight;
        this.yawOff = clamp(this.yawOff + e.movementX * sens, -2.3, 2.3);
        this.pitchOff = clamp(this.pitchOff + e.movementY * sens, -1.2 - this.basePitch, 1.2 - this.basePitch);
      }
      return;
    }
    this.pointer.dirty = true;
  };

  private onPointerDown = (e: PointerEvent) => {
    this.setPointer(e);
    this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    this.dragging = false;
    if (this.mode === 'seat') {
      this.renderer.domElement.setPointerCapture(e.pointerId);
      this.renderer.domElement.style.cursor = 'grabbing';
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const down = this.down;
    this.down = null;
    if (this.mode === 'seat') {
      this.renderer.domElement.style.cursor = 'grab';
      return;
    }
    if (!down || this.dragging || performance.now() - down.t > 600 || this.flight) return;
    this.setPointer(e);
    const seat = this.pick();
    if (seat) this.events.onSeatClick?.(seat);
  };

  private onPointerCancel = () => {
    this.down = null;
  };

  private onPointerLeave = () => {
    this.pointer.inside = false;
    this.pointer.dirty = false;
    if (this.mode === 'orbit') this.setHover(null);
  };

  private onDoubleClick = (e: MouseEvent) => {
    if (this.mode !== 'orbit' || this.flight) return;
    this.setPointer(e);
    const seat = this.pick();
    if (seat) this.events.onSeatDoubleClick?.(seat);
  };

  private onWheel = (e: WheelEvent) => {
    if (this.mode !== 'seat') return;
    e.preventDefault();
    this.seatFov = clamp(this.seatFov + e.deltaY * 0.03, 30, 84);
  };

  private resize() {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.pipBox = null;
    this.composer.render(0);
    this.renderPip();
  }

  /** t = 0 is house lights up, t = 1 is the film running */
  private applyLights(t: number, flicker = 1) {
    this.ambient.intensity = lerp(1.55, 0.3, t);
    this.hemi.intensity = lerp(1.25, 0.22, t);
    this.keyLight.intensity = lerp(1.7, 0.12, t);
    this.screenLight.intensity = lerp(5, 17, t) * flicker * (this.layout.config.screen.width / 14);
    this.screenMat.color.setScalar(lerp(0.88, 0.98, t) * (1 + (flicker - 1) * 0.5));
    this.beamMat.opacity = lerp(0.008, 0.014, t) * flicker;
    this.glowMats.forEach((m) => (m.opacity = lerp(0.9, 0.16, t)));
    this.lampMats[0].color.setRGB(1, 0.86, 0.66).multiplyScalar(lerp(1.7, 0.1, t));
    this.lampMats[1].color.setRGB(1.9, 1.15, 0.55).multiplyScalar(lerp(1, 0.3, t));
    this.bloom.strength = lerp(0.3, 0.2, t);
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;
    this.time += dt;
    const time = this.time;

    // camera
    if (this.flight) {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / f.dur);
      const k = ease(f.t);
      this.camera.position.lerpVectors(f.p0, f.p1, k);
      this.camera.position.y += Math.sin(k * Math.PI) * f.lift;
      this.camera.quaternion.slerpQuaternions(f.q0, f.q1, k);
      this.camera.fov = lerp(f.f0, f.f1, k);
      this.camera.updateProjectionMatrix();
      if (f.t >= 1) {
        this.flight = null;
        f.done?.();
      }
    } else if (this.mode === 'seat') {
      this.camera.rotation.set(this.basePitch + this.pitchOff, this.baseYaw + this.yawOff, 0, 'YXZ');
      if (Math.abs(this.camera.fov - this.seatFov) > 0.01) {
        this.camera.fov = lerp(this.camera.fov, this.seatFov, 0.2);
        this.camera.updateProjectionMatrix();
      }
    } else {
      this.controls.update();
    }

    // hover picking (only when the pointer actually moved, and not mid-drag)
    if (this.pointer.dirty && this.mode === 'orbit' && !this.flight) {
      this.pointer.dirty = false;
      if (!this.down) this.setHover(this.pick());
    }

    // lights ease between "house lights up" and "movie playing"
    const goal = this.lightMode === 'movie' ? 1 : 0;
    this.lightT += (goal - this.lightT) * Math.min(1, dt * 3.2);
    const flicker = this.reducedMotion ? 1 : 1 + Math.sin(time * 2.3) * 0.035 + Math.sin(time * 5.1) * 0.02;
    this.applyLights(this.lightT, flicker);

    // slow drift across the key art so the screen feels alive
    if (this.reducedMotion) this.screenTex.offset.set(0.03, 0.03);
    else this.screenTex.offset.set(0.03 + Math.sin(time * 0.11) * 0.028, 0.03 + Math.cos(time * 0.083) * 0.028);

    if (this.marker.visible && this.marker.userData.base) {
      const b = this.marker.userData.base as THREE.Vector3;
      this.marker.position.set(b.x, b.y + Math.sin(time * 3) * 0.07, b.z);
      this.marker.rotation.y = time * 1.6;
    }

    this.composer.render(dt);
    this.renderPip();
  };

  /** picture-in-picture: the view from the focused seat, drawn into a corner of the same canvas */
  private renderPip() {
    const el = this.pipEl;
    const seat = this.state.focusId ? this.layout.byId.get(this.state.focusId) : null;
    if (!el || !seat || this.mode !== 'orbit') return;
    // measure the frame once and reuse it; it only moves when the stage is resized
    if (!this.pipBox) {
      const canvasRect = this.renderer.domElement.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      this.pipBox = {
        x: box.left - canvasRect.left,
        y: canvasRect.bottom - box.bottom,
        width: box.width,
        height: box.height,
        canvasW: canvasRect.width,
        canvasH: canvasRect.height,
      };
    }
    const r = this.pipBox;
    if (r.width < 8 || r.height < 8) return;
    const x = r.x;
    const yBottom = r.y;
    this.placePipCamera(seat, r.width / r.height);
    const markerWas = this.marker.visible;
    this.marker.visible = false;
    this.renderer.setRenderTarget(null);
    this.renderer.setViewport(x, yBottom, r.width, r.height);
    this.renderer.setScissor(x, yBottom, r.width, r.height);
    this.renderer.setScissorTest(true);
    const auto = this.renderer.autoClear;
    this.renderer.autoClear = false;
    this.renderer.clear();
    this.renderer.render(this.scene, this.pipCamera);
    this.renderer.autoClear = auto;
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, r.canvasW, r.canvasH);
    this.marker.visible = markerWas;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerCancel);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    el.removeEventListener('dblclick', this.onDoubleClick);
    el.removeEventListener('wheel', this.onWheel);
    this.controls.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      mats.forEach((m) => {
        const map = (m as THREE.MeshBasicMaterial).map;
        if (map) map.dispose();
        m.dispose();
      });
    });
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    el.remove();
  }
}
