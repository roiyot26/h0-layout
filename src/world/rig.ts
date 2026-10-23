// The camera rig (M2 spec §1.2–§1.4, §2, §5.4; STYLE §5 and §11). One loop owns the
// camera: idle orbit with damping, the 1.0 s fly between same-straight neighbours, the
// 300 ms crossfade for every other hop (200 ms and no translation under reduced motion),
// the tier-swap crossfade, the phone view offset, station labels, the logged DOF, history
// and the per-frame trace. The crossfade draws the last frame of the outgoing view from a
// render target on a full-screen quad over the live, already cut-to frame, so the frame
// never passes through black (§1.4).
import {
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import { CURVES, DURATION, cubicBezier, fadeOut } from './camera/easing';
import { type Fly, flyClear, makeFly } from './camera/fly';
import { type OrbitState, authoredOrbit, clampOrbit, damp, limitsFor, orbitPosition } from './camera/orbit';
import { type Look, along, lookAt } from './camera/orientation';
import { type StationId, STATIONS, STATION_POSES, fovFor, tierFor } from './camera/poses';
import { type Dest, FLY_PAIRS, hopType, poseFor } from './camera/views';
import type { Region } from './layout';
import { FREE_AREA } from './layout';
import type { World } from './renderer';
import { STATION_INFO } from './stations';
import type { RigSample, Trace } from './trace';
import { type TablePoint, toThree } from './units';

export type Mode = 'idle' | 'fly' | 'fade';

export interface View {
  position: TablePoint;
  look: Look;
  vFov: number;
  kind: 'overview' | 'station';
}

export interface Rig {
  readonly dest: Dest;
  /** Where the current hop is heading (equals dest when idle). */
  readonly to: Dest;
  readonly mode: Mode;
  readonly orbit: OrbitState;
  readonly goal: OrbitState;
  readonly label: number;
  readonly opacityA: number;
  /** Starts a hop; while one runs, the last request wins and runs on arrival. */
  go(to: Dest, opts?: { push?: boolean }): void;
  /** Moves the orbit goal (idle only), clamped. `scale` multiplies the distance. */
  orbitBy(d: { azimuth?: number; polar?: number; scale?: number }): void;
  /** Re-fits the canvas; crossfades to the other tier's poses when the tier changes. */
  resize(): void;
  /** Runs one frame at `now` (the loop calls this; tests may too). */
  frame(now: number): void;
  /** Renders a frame and returns the mean relative luminance of the drawing buffer. */
  luminance(): number;
  dispose(): void;
}

export interface RigOptions {
  world: World;
  region: Region;
  /** The site base, e.g. '/' or '/h0-layout/'. */
  base: string;
  start: Dest;
  trace?: Trace;
  reducedMotion?: () => boolean;
}

const easeLabel = cubicBezier(CURVES.label);

/** The same-straight neighbour a station flies to (§2.4 veto). */
export const NEIGHBOUR: Record<StationId, StationId> = Object.fromEntries(
  FLY_PAIRS.flatMap(([a, b]) => [
    [a, b],
    [b, a],
  ]),
) as Record<StationId, StationId>;

/** Phone station view offset in px (§1.3): centres the target in the free area. */
export const phoneOffset = (height: number): number => height / 2 - (FREE_AREA.top + (height - FREE_AREA.bottom)) / 2;

/** The page path for a destination, relative to the base ('' for the overview). */
export const pathFor = (dest: Dest): string => (dest === 'overview' ? '' : `${STATION_INFO[dest].path.replace(/^\//, '')}/`);

/** The destination a location pathname names, if any. */
export function destForPath(pathname: string, base: string): Dest | null {
  if (!pathname.startsWith(base)) return null;
  const rest = pathname.slice(base.length).replace(/index\.html$/, '').replace(/\/+$/, '');
  if (rest === '') return 'overview';
  return STATIONS.find((s) => STATION_INFO[s].path === `/${rest}`) ?? null;
}

const lerpPoint = (a: TablePoint, b: TablePoint, k: number): TablePoint => ({
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
  h: a.h + (b.h - a.h) * k,
});
const dist = (a: TablePoint, b: TablePoint) => Math.hypot(a.x - b.x, a.y - b.y, a.h - b.h);

export function createRig(opts: RigOptions): Rig {
  const { world, region, base, trace } = opts;
  const reduced = opts.reducedMotion ?? (() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const { renderer, camera } = world;

  // Crossfade overlay: the outgoing frame on a full-screen quad.
  const fadeScene = new Scene();
  const fadeCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fadeMaterial = new MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false });
  const quad = new Mesh(new PlaneGeometry(2, 2), fadeMaterial);
  quad.frustumCulled = false;
  fadeScene.add(quad);
  let target: WebGLRenderTarget | null = null;
  const buffer = new Vector2();

  let dest: Dest = opts.start;
  let to: Dest = dest;
  let mode: Mode = 'idle';
  let orbit = authoredOrbit(poseFor(world.tier, dest));
  let goal = { ...orbit, target: { ...orbit.target } };
  let fly: Fly | null = null;
  let fadeMs = 0;
  let t0: number | null = null;
  let u = 1;
  let e = 1;
  let opacityA = 0;
  let queued: { to: Dest; push: boolean } | null = null;
  let push = true;
  let arrivedAt: number | null = Number.NEGATIVE_INFINITY;
  let label = 1;
  let dofFrom = dist(poseFor(world.tier, dest).position, poseFor(world.tier, dest).target);
  let dofTo = dofFrom;
  let dof = dofFrom;
  let view: View = viewFor(dest, orbit);
  let last: number | null = null;
  let raf = 0;
  let disposed = false;

  function viewFor(d: Dest, s: OrbitState): View {
    const pose = poseFor(world.tier, d);
    const position = orbitPosition(pose, s);
    return { position, look: lookAt(position, s.target), vFov: pose.vFov, kind: d === 'overview' ? 'overview' : 'station' };
  }

  function apply(v: View) {
    const pose = poseFor(world.tier, mode === 'idle' ? dest : to);
    camera.position.set(...toThree(v.position));
    camera.up.set(0, 1, 0);
    camera.lookAt(...toThree(along(v.position, v.look, 1000)));
    camera.aspect = world.width / world.height;
    camera.fov = fovFor({ ...pose, vFov: v.vFov }, world.tier, camera.aspect, v.kind);
    camera.near = v.kind === 'station' ? STATION_POSES[world.tier].bootcamp.near : pose.near;
    camera.far = v.kind === 'station' ? STATION_POSES[world.tier].bootcamp.far : pose.far;
    if (world.tier === 'phone' && v.kind === 'station') {
      camera.setViewOffset(world.width, world.height, 0, phoneOffset(world.height), world.width, world.height);
    } else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  function render() {
    renderer.info.reset();
    renderer.autoClear = true;
    world.draw();
    if (opacityA > 0 && target) {
      fadeMaterial.opacity = opacityA;
      renderer.autoClear = false;
      renderer.render(fadeScene, fadeCamera);
      renderer.autoClear = true;
    }
  }

  /** Copies the frame now on screen into the render target. */
  function snapshot() {
    renderer.getDrawingBufferSize(buffer);
    if (!target) {
      target = new WebGLRenderTarget(buffer.x, buffer.y);
      fadeMaterial.map = target.texture;
      fadeMaterial.needsUpdate = true;
    } else if (target.width !== buffer.x || target.height !== buffer.y) target.setSize(buffer.x, buffer.y);
    apply(view);
    renderer.setRenderTarget(target);
    // (A fade in progress is snapshotted without its overlay: the target cannot sample itself.)
    renderer.render(world.scene, camera);
    renderer.setRenderTarget(null);
  }

  const labels = [...region.labels.entries()];
  const v3 = new Vector3();
  function placeLabels() {
    for (const [id, el] of labels) {
      const t = STATION_POSES[world.tier][id].target;
      v3.set(...toThree({ ...t, h: t.h + 40 }));
      v3.project(camera);
      const visible = v3.z < 1 && Math.abs(v3.x) <= 1 && Math.abs(v3.y) <= 1;
      const o = visible ? label : 0;
      el.style.opacity = String(o);
      el.style.pointerEvents = o > 0 ? 'auto' : 'none';
      el.tabIndex = -1;
      if (!visible) continue;
      // Keep the whole label on screen: clamp its centre by half its width plus 8 px.
      const half = el.offsetWidth / 2 + 8;
      const x = Math.min(Math.max(((v3.x + 1) / 2) * world.width, half), Math.max(half, world.width - half));
      el.style.transform = `translate(${x}px, ${((1 - v3.y) / 2) * world.height}px) translate(-50%, -100%)`;
    }
  }

  function hideLabels() {
    label = 0;
    arrivedAt = null;
    for (const [, el] of labels) {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    }
  }

  function markCurrent() {
    for (const [d, b] of region.switcher) {
      const on = d === dest;
      b.setAttribute('aria-current', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    }
  }

  function arrive(now: number) {
    mode = 'idle';
    const changed = to !== dest;
    dest = to;
    fly = null;
    t0 = null;
    u = 1;
    e = 1;
    opacityA = 0;
    orbit = authoredOrbit(poseFor(world.tier, dest));
    goal = { ...orbit, target: { ...orbit.target } };
    view = viewFor(dest, orbit);
    arrivedAt = now;
    dofFrom = dof;
    dofTo = dist(view.position, orbit.target);
    markCurrent();
    if (changed) {
      // Station hops get a history entry; the overview, the tier swap and orbiting do not.
      if (push && dest !== 'overview' && history.state?.h0 !== dest) history.pushState({ h0: dest }, '', `${base}${pathFor(dest)}${location.search}${location.hash}`);
      region.live.textContent = dest === 'overview' ? 'The layout' : STATION_INFO[dest].name;
    }
    if (queued) {
      const q = queued;
      queued = null;
      if (q.to !== dest) go(q.to, { push: q.push });
    }
  }

  function begin(next: Dest, pushIt: boolean, fadeOnly: number | null, snapped = false) {
    hideLabels();
    to = next;
    push = pushIt;
    t0 = null;
    if (fadeOnly === null && !reduced() && hopType(dest, next) === 'fly' && next !== 'overview') {
      mode = 'fly';
      fly = makeFly({ position: view.position, look: view.look, vFov: view.vFov }, next, poseFor(world.tier, next));
    } else {
      if (!snapped) snapshot();
      mode = 'fade';
      fadeMs = fadeOnly ?? (reduced() ? DURATION.crossfadeReduced : DURATION.crossfade);
      opacityA = 1;
      // Cut to the destination under the overlay.
      orbit = authoredOrbit(poseFor(world.tier, next));
      goal = { ...orbit, target: { ...orbit.target } };
      view = viewFor(next, orbit);
    }
    wake();
  }

  function go(next: Dest, o: { push?: boolean } = {}) {
    const pushIt = o.push ?? true;
    if (mode !== 'idle') {
      queued = { to: next, push: pushIt };
      return;
    }
    if (next === dest) {
      // Same destination: recentre the orbit.
      goal = authoredOrbit(poseFor(world.tier, dest));
      wake();
      return;
    }
    begin(next, pushIt, null);
  }

  function orbitBy(d: { azimuth?: number; polar?: number; scale?: number }) {
    if (mode !== 'idle') return;
    const pose = poseFor(world.tier, dest);
    const want: OrbitState = {
      azimuth: goal.azimuth + (d.azimuth ?? 0),
      polar: goal.polar + (d.polar ?? 0),
      distance: goal.distance * (d.scale ?? 1),
      target: { ...goal.target },
    };
    const accept =
      dest === 'overview'
        ? undefined
        : (p: TablePoint) => flyClear(p, NEIGHBOUR[dest as StationId], poseFor(world.tier, NEIGHBOUR[dest as StationId]), world.boxes);
    goal = clampOrbit(pose, limitsFor(world.tier, dest), want, world.boxes, goal, accept);
    if (reduced()) orbit = { ...goal, target: { ...goal.target } };
    wake();
  }

  const settled = () =>
    Math.abs(orbit.azimuth - goal.azimuth) < 1e-3 && Math.abs(orbit.polar - goal.polar) < 1e-3 && Math.abs(orbit.distance - goal.distance) < 1e-2;

  function frame(now: number) {
    const dt = last === null ? 16.67 : Math.min(Math.max(now - last, 0), 100);
    last = now;
    if (mode === 'fly' && fly) {
      if (t0 === null) t0 = now;
      const el = now - t0;
      const f = fly.at(el);
      u = f.u;
      e = f.e;
      view = { position: f.position, look: f.look, vFov: f.vFov, kind: 'station' };
      if (el >= fly.duration) arrive(now);
    } else if (mode === 'fade') {
      if (t0 === null) t0 = now;
      const el = now - t0;
      opacityA = fadeOut(el, fadeMs);
      u = Math.min(el / fadeMs, 1);
      e = u;
      if (el >= fadeMs) arrive(now);
    } else {
      const k = DURATION.orbitSettle;
      orbit = {
        azimuth: damp(orbit.azimuth, goal.azimuth, dt, k),
        polar: damp(orbit.polar, goal.polar, dt, k),
        distance: damp(orbit.distance, goal.distance, dt, k),
        target: lerpPoint(goal.target, orbit.target, Math.exp((-Math.log(200) / k) * dt)),
      };
      if (settled()) orbit = { ...goal, target: { ...goal.target } };
      view = viewFor(dest, orbit);
    }
    if (arrivedAt !== null && mode === 'idle') {
      const since = now - arrivedAt;
      label = easeLabel(Math.min(since / DURATION.label, 1));
      dof = dofFrom + (dofTo - dofFrom) * Math.min(Math.max(since / DURATION.dof, 0), 1);
    }
    apply(view);
    render();
    placeLabels();
    if (trace) {
      const sample: RigSample = {
        dest: mode === 'idle' ? dest : to,
        mode,
        u,
        e,
        pos: view.position,
        yaw: view.look.yaw,
        pitch: view.look.pitch,
        roll: 0,
        fov: camera.fov,
        dof,
        opacityA,
        opacityB: 1 - opacityA,
        label,
      };
      trace.record(now, sample);
    }
  }

  const busy = () => mode !== 'idle' || label < 1 || dof !== dofTo || !settled();

  function loop(now: number) {
    raf = 0;
    if (disposed) return;
    frame(now);
    if (trace || busy()) raf = requestAnimationFrame(loop);
    else last = null;
  }

  function wake() {
    if (!raf && !disposed) raf = requestAnimationFrame(loop);
  }

  function resize() {
    region.fit();
    const before = world.tier;
    const old = world.width;
    const oldH = world.height;
    if (tierFor(window.innerWidth, window.innerHeight) !== before) {
      // The tier swap (§1.1): a crossfade to the same destination on the other tier's
      // poses. A hop in progress lands where it was heading; nothing touches history.
      snapshot();
      const keepPush = mode !== 'idle' && to !== dest && push;
      const heading = to;
      fly = null;
      queued = null;
      world.resize();
      mode = 'idle';
      begin(heading, keepPush, reduced() ? DURATION.tierSwapReduced : DURATION.tierSwap, true);
      return;
    }
    world.resize();
    if (world.width !== old || world.height !== oldH) wake();
  }

  function luminance(): number {
    apply(view);
    render();
    const gl = renderer.getContext();
    renderer.getDrawingBufferSize(buffer);
    const px = new Uint8Array(buffer.x * buffer.y * 4);
    gl.readPixels(0, 0, buffer.x, buffer.y, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const lin = (c: number) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += 0.2126 * lin(px[i]!) + 0.7152 * lin(px[i + 1]!) + 0.0722 * lin(px[i + 2]!);
    return sum / (px.length / 4);
  }

  markCurrent();
  apply(view);
  wake();

  return {
    get dest() {
      return dest;
    },
    get to() {
      return to;
    },
    get mode() {
      return mode;
    },
    get orbit() {
      return orbit;
    },
    get goal() {
      return goal;
    },
    get label() {
      return label;
    },
    get opacityA() {
      return opacityA;
    },
    go,
    orbitBy,
    resize,
    frame,
    luminance,
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      target?.dispose();
      quad.geometry.dispose();
      fadeMaterial.dispose();
    },
  };
}
