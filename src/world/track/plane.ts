// The paper plane's flight path (STYLE §8.3), kept here so the hop and pose tests can
// check their distance to it before the plane itself lands (M5). It follows the oval
// centre line with no lateral offset, raised by a height profile above rail top.
import { RAIL_TOP, type TablePoint } from '../units';
import { LAP, LEFT_CX, R3, RIGHT_CX, STRAIGHT, pointAt } from './path';

const HALF = Math.PI * R3;
const onFront = (x: number): number => x - LEFT_CX;
const onBack = (x: number): number => STRAIGHT + HALF + (RIGHT_CX - x);

/** Height keys [s, mm above rail] in the train's direction (STYLE §8.3 table). */
export const PLANE_KEYS: readonly (readonly [number, number])[] = [
  [onFront(1150) - 190, 95],
  [onFront(1150), 140],
  [onFront(1470), 140],
  [onFront(1470) + 190, 95],
  [onBack(1380), 95],
  [onBack(1200), 150],
  [onBack(1020), 150],
  [onBack(1020) + 190, 95],
];

/** The flutter heave (±2 mm, STYLE §8.3), used as a margin in distance checks. */
export const PLANE_HEAVE = 2;

/**
 * Height above rail at arc length s. The keys are joined linearly here; STYLE eases them
 * with a Catmull-Rom curve, which the M5 plane will use. Peak 150 either way.
 */
export function planeHeight(sIn: number): number {
  const s = ((sIn % LAP) + LAP) % LAP;
  const keys = PLANE_KEYS;
  for (let i = 0; i < keys.length - 1; i++) {
    const [s0, h0] = keys[i]!;
    const [s1, h1] = keys[i + 1]!;
    if (s >= s0 && s <= s1) return h0 + ((h1 - h0) * (s - s0)) / (s1 - s0);
  }
  return 95; // the cruise stretch from the left curve round to the turnout
}

/** A point on the plane path at arc length s, in table mm datum. */
export function planeAt(s: number): TablePoint {
  const p = pointAt(s);
  return { x: p.x, y: p.y, h: RAIL_TOP + planeHeight(s) };
}
