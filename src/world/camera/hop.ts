// Hop paths between same-straight neighbours (M2 spec §2). Pure geometry in table mm
// datum; fly.ts adds the timing and the un-orbit.
import type { TablePoint, Tier } from '../units';
import { easeFly } from './easing';
import { STATION_POSES } from './poses';

/** The apex the back pair passes through: over the tunnel centreline, 300 datum (§2.3). */
export const APEX: TablePoint = { x: 1112.5, y: 1095.5, h: 300 };
/** The front pair's vertical lift (§2.2). */
export const FRONT_LIFT = 30;

const add = (a: TablePoint, b: TablePoint, k = 1): TablePoint => ({ x: a.x + b.x * k, y: a.y + b.y * k, h: a.h + b.h * k });
const scale = (a: TablePoint, k: number): TablePoint => ({ x: a.x * k, y: a.y * k, h: a.h * k });

/** Quadratic control Q = 2·APEX − (P0 + P3)/2, so the curve passes through APEX at u = ½. */
export const backControl = (p0: TablePoint, p3: TablePoint, apex: TablePoint = APEX): TablePoint =>
  add(scale(apex, 2), scale(add(p0, p3), 0.5), -1);

/** A quadratic Bézier from p0 to p3 through `apex` at u = ½ (§2.3, §2.4). */
export function quadraticThrough(p0: TablePoint, p3: TablePoint, apex: TablePoint = APEX): (u: number) => TablePoint {
  const q = backControl(p0, p3, apex);
  return (u) => {
    const a = (1 - u) ** 2;
    const b = 2 * u * (1 - u);
    const c = u * u;
    return { x: a * p0.x + b * q.x + c * p3.x, y: a * p0.y + b * q.y + c * p3.y, h: a * p0.h + b * q.h + c * p3.h };
  };
}

/** A straight lerp from p0 to p3 plus the 30 mm · sin(π·e) lift (§2.2). */
export function liftedLine(p0: TablePoint, p3: TablePoint): (e: number) => TablePoint {
  return (e) => {
    const p = add(p0, add(p3, p0, -1), e);
    return { ...p, h: p.h + FRONT_LIFT * Math.sin(Math.PI * e) };
  };
}

/** The back pair (Campus → Bootcamp) as a quadratic Bézier at curve parameter u. */
export const backPath = (tier: Tier, from: TablePoint = STATION_POSES[tier].campus.position): ((u: number) => TablePoint) =>
  quadraticThrough(from, STATION_POSES[tier].bootcamp.position);

/** The front pair (Workshop → City): a straight lerp plus 30 mm · sin(π·e). */
export const frontPath = (tier: Tier, from: TablePoint = STATION_POSES[tier].workshop.position): ((e: number) => TablePoint) =>
  liftedLine(from, STATION_POSES[tier].city.position);

/**
 * Arc-length table (§2.3): cumulative length at n + 1 evenly spaced curve parameters
 * (n = 256), inverted by binary search and linear interpolation: u = U(s).
 */
export function arcLengthInverse(path: (u: number) => TablePoint, n = 256, sub = 16): { length: number; u: (s: number) => number } {
  const cum = new Float64Array(n + 1);
  let prev = path(0);
  for (let i = 1; i <= n; i++) {
    let len = 0;
    for (let k = 1; k <= sub; k++) {
      const p = path((i - 1 + k / sub) / n);
      len += Math.hypot(p.x - prev.x, p.y - prev.y, p.h - prev.h);
      prev = p;
    }
    cum[i] = cum[i - 1]! + len;
  }
  const length = cum[n]!;
  return {
    length,
    u(s) {
      if (s <= 0) return 0;
      if (s >= 1) return 1;
      const target = s * length;
      let lo = 0;
      let hi = n;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid]! < target) lo = mid;
        else hi = mid;
      }
      const span = cum[hi]! - cum[lo]!;
      return (lo + (span > 0 ? (target - cum[lo]!) / span : 0)) / n;
    },
  };
}

/** Sample a path at n + 1 evenly spaced parameters. */
export function samplePath(path: (u: number) => TablePoint, n = 4000): TablePoint[] {
  return Array.from({ length: n + 1 }, (_, i) => path(i / n));
}

/** Both hop paths for a tier, sampled (the §2.6 corridor). */
export const hopCorridor = (tier: Tier, n = 400): TablePoint[] => [
  ...samplePath(backPath(tier), n),
  ...samplePath(frontPath(tier), n),
];

/** cubic-bezier(0.65, 0, 0.35, 1) easing (§2.2, §2.3). */
export const easeHop = easeFly;
