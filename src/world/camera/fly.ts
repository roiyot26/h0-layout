// The 1.0 s fly between same-straight neighbours (M2 spec §2.2–§2.4). Translation runs
// on cubic-bezier(0.65,0,0.35,1): the front pair on the eased progress, the back pair on
// eased arc length through a 256-entry table. Orientation un-orbits on a trapezoidal
// angular-velocity profile (0.2 s ramps), slerping the view direction with roll 0.
import { type Aabb, MIN_CLEARANCE, clearance } from '../terrain/clearance';
import type { TablePoint } from '../units';
import { DURATION, easeFly, trapezoid } from './easing';
import { arcLengthInverse, liftedLine, quadraticThrough } from './hop';
import { type Look, forward, lookAt } from './orientation';
import type { Pose, StationId } from './poses';

export interface FlyFrame {
  /** Curve parameter. */
  u: number;
  /** Eased progress (arc-length fraction on the back pair). */
  e: number;
  position: TablePoint;
  look: Look;
  roll: 0;
  vFov: number;
}

export interface Fly {
  duration: number;
  at(ms: number): FlyFrame;
}

const BACK: readonly StationId[] = ['campus', 'city'];

/** Spherical interpolation of two unit vectors. */
function slerp(a: TablePoint, b: TablePoint, f: number): TablePoint {
  const dot = Math.min(Math.max(a.x * b.x + a.y * b.y + a.h * b.h, -1), 1);
  const th = Math.acos(dot);
  if (th < 1e-9) return { ...b };
  const s = Math.sin(th);
  const wa = Math.sin((1 - f) * th) / s;
  const wb = Math.sin(f * th) / s;
  return { x: wa * a.x + wb * b.x, y: wa * a.y + wb * b.y, h: wa * a.h + wb * b.h };
}

const toLook = (v: TablePoint): Look => lookAt({ x: 0, y: 0, h: 0 }, v);

/** The translation curve for a fly to `to`: the over-hill quadratic for the back pair, the lifted line for the front pair. */
export const flyCurve = (p0: TablePoint, to: StationId, end: Pose): ((u: number) => TablePoint) =>
  BACK.includes(to) ? quadraticThrough(p0, end.position) : liftedLine(p0, end.position);

/**
 * Whether the whole fly from `p0` to `to` keeps ≥ 12 mm clearance (§2.4 grid rule). The
 * curve is sampled at `n` + 1 parameters; clearance is 1-Lipschitz, so each sample must
 * clear 12 mm plus half the largest gap between samples.
 */
export function flyClear(p0: TablePoint, to: StationId, end: Pose, boxes: readonly Aabb[], n = 400): boolean {
  const curve = flyCurve(p0, to, end);
  const pts = Array.from({ length: n + 1 }, (_, i) => curve(i / n));
  let gap = 0;
  for (let i = 1; i <= n; i++) gap = Math.max(gap, Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y, pts[i]!.h - pts[i - 1]!.h));
  const need = MIN_CLEARANCE + gap / 2;
  // Only boxes near the curve's bounds can come within `need`.
  const lo = { x: Infinity, y: Infinity, h: Infinity };
  const hi = { x: -Infinity, y: -Infinity, h: -Infinity };
  for (const p of pts) {
    lo.x = Math.min(lo.x, p.x - need);
    lo.y = Math.min(lo.y, p.y - need);
    lo.h = Math.min(lo.h, p.h - need);
    hi.x = Math.max(hi.x, p.x + need);
    hi.y = Math.max(hi.y, p.y + need);
    hi.h = Math.max(hi.h, p.h + need);
  }
  const near = boxes.filter((b) => b.max.x >= lo.x && b.min.x <= hi.x && b.max.y >= lo.y && b.min.y <= hi.y && b.max.h >= lo.h && b.min.h <= hi.h);
  return pts.every((p) => clearance(p, near) >= need);
}

/**
 * A fly from `start` (the authored pose, or an orbited one) to the authored pose of `to`.
 * `to` decides the pair: Campus and City use the over-hill quadratic, the front pair the
 * lifted line.
 */
export function makeFly(start: { position: TablePoint; look: Look; vFov: number }, to: StationId, end: Pose): Fly {
  const duration = DURATION.fly;
  const p0 = start.position;
  const p3 = end.position;
  const endLook = lookAt(end.position, end.target);
  const f0 = forward(start.look);
  const f1 = forward(endLook);
  const curve = flyCurve(p0, to, end);
  const arc = BACK.includes(to) ? arcLengthInverse(curve) : null;
  return {
    duration,
    at(ms) {
      const t = Math.min(Math.max(ms / duration, 0), 1);
      const e = easeFly(t);
      const u = arc ? arc.u(e) : e;
      const turn = trapezoid(ms, duration, DURATION.unorbitRamp);
      const position = t >= 1 ? { ...p3 } : curve(u);
      const look = turn >= 1 ? endLook : toLook(slerp(f0, f1, turn));
      return { u, e, position, look, roll: 0, vFov: start.vFov + (end.vFov - start.vFov) * e };
    },
  };
}
