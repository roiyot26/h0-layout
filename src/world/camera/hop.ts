// Hop paths between same-straight neighbours (M2 spec §2). Pure geometry in table mm
// datum; the timing, the arc-length table and the un-orbit land with the camera rig.
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

/** The back pair (Campus → City) as a quadratic Bézier at curve parameter u. */
export function backPath(tier: Tier, from: TablePoint = STATION_POSES[tier].campus.position): (u: number) => TablePoint {
  const p3 = STATION_POSES[tier].city.position;
  const q = backControl(from, p3);
  return (u) => {
    const a = (1 - u) ** 2;
    const b = 2 * u * (1 - u);
    const c = u * u;
    return { x: a * from.x + b * q.x + c * p3.x, y: a * from.y + b * q.y + c * p3.y, h: a * from.h + b * q.h + c * p3.h };
  };
}

/** The front pair (Workshop → Bootcamp): a straight lerp plus 30 mm · sin(π·e). */
export function frontPath(tier: Tier, from: TablePoint = STATION_POSES[tier].workshop.position): (e: number) => TablePoint {
  const to = STATION_POSES[tier].bootcamp.position;
  return (e) => {
    const p = add(from, add(to, from, -1), e);
    return { ...p, h: p.h + FRONT_LIFT * Math.sin(Math.PI * e) };
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
