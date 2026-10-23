// Orbit state and clamps (M2 spec §1.2, §1.3, §3.4; STYLE §5 and §11). The state is
// held relative to the authored pose: azimuth is an offset in degrees around the vertical
// through the target, polar is absolute from vertical, distance is mm to the target, and
// the target may move inside a box around the authored target. Pure maths; input.ts and
// rig.ts feed it.
import type { TablePoint, Tier } from '../units';
import { type Aabb, MIN_CLEARANCE, clearance } from '../terrain/clearance';
import type { Pose } from './poses';
import type { Dest } from './views';

export interface OrbitState {
  azimuth: number;
  polar: number;
  distance: number;
  target: TablePoint;
}

export interface OrbitLimits {
  /** ± degrees around the authored azimuth. */
  azimuth: number;
  /** [min, max] degrees from vertical, or null to hold the authored polar. */
  polar: readonly [number, number] | null;
  /** [min, max] mm, or null to hold the authored distance. */
  distance: readonly [number, number] | null;
  /** Half-size of the target box in mm (0 holds the authored target). */
  targetBox: number;
}

const DEG = Math.PI / 180;

/**
 * Per tier and destination. Desktop overview: azimuth ±20°, distance 2.0–2.6 m. Desktop
 * stations: azimuth ±30°, polar 50–78°, distance 0.30–0.80 m, target in a 0.25 m box.
 * Phone (STYLE §11): azimuth ±20°, pinch distance 0.3–0.7 m at stations; the phone
 * overview keeps azimuth only, since STYLE §11 gives it no distance range.
 */
export function limitsFor(tier: Tier, dest: Dest): OrbitLimits {
  if (dest === 'overview') {
    return tier === 'desktop'
      ? { azimuth: 20, polar: null, distance: [2000, 2600], targetBox: 0 }
      : { azimuth: 20, polar: null, distance: null, targetBox: 0 };
  }
  return tier === 'desktop'
    ? { azimuth: 30, polar: [50, 78], distance: [300, 800], targetBox: 125 }
    : { azimuth: 20, polar: [50, 78], distance: [300, 700], targetBox: 125 };
}

/** The authored pose as an orbit state (azimuth 0). */
export function authoredOrbit(pose: Pose): OrbitState {
  const dx = pose.position.x - pose.target.x;
  const dy = pose.position.y - pose.target.y;
  const dh = pose.position.h - pose.target.h;
  const distance = Math.hypot(dx, dy, dh);
  return { azimuth: 0, polar: Math.acos(dh / distance) / DEG, distance, target: { ...pose.target } };
}

/**
 * Camera position for an orbit state around the authored pose. Azimuth follows three's
 * OrbitControls (atan2(X, Z) in three axes, Z = −y): negative azimuth moves the camera
 * towards −x from a pose looking along +y, as in the spec's City (−30°, 78°) case.
 */
export function orbitPosition(pose: Pose, s: OrbitState): TablePoint {
  const phi0 = Math.atan2(pose.position.x - pose.target.x, -(pose.position.y - pose.target.y));
  const phi = phi0 + s.azimuth * DEG;
  const th = s.polar * DEG;
  return {
    x: s.target.x + s.distance * Math.sin(th) * Math.sin(phi),
    y: s.target.y - s.distance * Math.sin(th) * Math.cos(phi),
    h: s.target.h + s.distance * Math.cos(th),
  };
}

/**
 * Extra clearance the clamp keeps beyond 12 mm, so a fly leaving a pose clamped exactly to
 * the boundary does not graze 12 mm in its first frames (the start moves along the path
 * before the orientation turns, by up to 0.02 mm here).
 */
export const ORBIT_MARGIN = 1;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Range clamps only: azimuth, polar, distance and the target box. */
export function clampRanges(pose: Pose, limits: OrbitLimits, s: OrbitState): OrbitState {
  const a = authoredOrbit(pose);
  const b = limits.targetBox;
  return {
    azimuth: clamp(s.azimuth, -limits.azimuth, limits.azimuth),
    polar: limits.polar ? clamp(s.polar, limits.polar[0], limits.polar[1]) : a.polar,
    distance: limits.distance ? clamp(s.distance, limits.distance[0], limits.distance[1]) : a.distance,
    target: {
      x: clamp(s.target.x, a.target.x - b, a.target.x + b),
      y: clamp(s.target.y, a.target.y - b, a.target.y + b),
      h: clamp(s.target.h, a.target.h - b, a.target.h + b),
    },
  };
}

/**
 * The full clamp: ranges, then the clearance field (§3.4). A dolly-in is shortened along
 * the view ray (the distance grows back in 1 mm steps) until clearance ≥ 12 mm. `accept`
 * may veto the result (the rig vetoes a station pose whose fly to its same-straight
 * neighbour would pass within 12 mm of a mesh, §2.4). If nothing in range clears, or the
 * veto holds, the move is refused and `fallback` (the last good state, by default the
 * authored one) is returned.
 */
export function clampOrbit(
  pose: Pose,
  limits: OrbitLimits,
  s: OrbitState,
  boxes: readonly Aabb[],
  fallback?: OrbitState,
  accept?: (position: TablePoint) => boolean,
): OrbitState {
  const r = clampRanges(pose, limits, s);
  const max = limits.distance ? limits.distance[1] : r.distance;
  for (let d = r.distance; d <= max + 1e-9; d += 1) {
    const next = { ...r, distance: d };
    const p = orbitPosition(pose, next);
    if (clearance(p, boxes) >= MIN_CLEARANCE + ORBIT_MARGIN) return !accept || accept(p) ? next : (fallback ?? authoredOrbit(pose));
  }
  return fallback ?? authoredOrbit(pose);
}

/**
 * Drag from `from` towards `to` in `steps` equal increments, clamping each step against
 * the last good state, as pointer input does. Returns where the drag ends up.
 */
export function dragOrbit(
  pose: Pose,
  limits: OrbitLimits,
  from: OrbitState,
  to: OrbitState,
  boxes: readonly Aabb[],
  accept?: (position: TablePoint) => boolean,
  steps = 60,
): OrbitState {
  let s = from;
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const lerp = (a: number, b: number) => a + (b - a) * k;
    const want: OrbitState = {
      azimuth: lerp(from.azimuth, to.azimuth),
      polar: lerp(from.polar, to.polar),
      distance: lerp(from.distance, to.distance),
      target: { x: lerp(from.target.x, to.target.x), y: lerp(from.target.y, to.target.y), h: lerp(from.target.h, to.target.h) },
    };
    s = clampOrbit(pose, limits, want, boxes, s, accept);
  }
  return s;
}

/** Exponential approach of `current` to `goal`, with the rate set so it is within 0.5 % after `settleMs`. */
export function damp(current: number, goal: number, dtMs: number, settleMs: number): number {
  const k = Math.log(200) / settleMs;
  return goal + (current - goal) * Math.exp(-k * dtMs);
}
