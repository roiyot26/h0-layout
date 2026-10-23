// Track centrelines from STYLE §1 (M2 spec §4.1): the main oval and the goods-shed siding.
// Everything is in table mm on the level rail plane; the track never samples the height
// map (§3.3). s is arc length in mm.

/** Curve radius of the oval (R3) and the siding turnout (R2). */
export const R3 = 495.5;
export const R2 = 437.5;
export const FRONT_Y = 104.5;
export const BACK_Y = 1095.5;
export const LEFT_CX = 645.5;
export const RIGHT_CX = 1754.5;
export const CURVE_CY = 600;
export const STRAIGHT = RIGHT_CX - LEFT_CX; // 1109
const HALF_LOOP = Math.PI * R3;

/** Centre-line lap: 2 straights + 2 half circles (≈ 5331.3 mm). */
export const LAP = 2 * STRAIGHT + 2 * HALF_LOOP;

export interface PathPoint {
  x: number;
  y: number;
  /** Unit tangent in plan, in the direction of travel. */
  tx: number;
  ty: number;
}

export type SegmentKind = 'straight' | 'curve';
export interface Segment {
  kind: SegmentKind;
  s0: number;
  length: number;
}

/**
 * The oval in the train's direction (STYLE §1): s = 0 at the left end of the front
 * straight, then left → right along the front, the right curve, right → left along the
 * back and the left curve.
 */
export const LOOP: readonly Segment[] = [
  { kind: 'straight', s0: 0, length: STRAIGHT },
  { kind: 'curve', s0: STRAIGHT, length: HALF_LOOP },
  { kind: 'straight', s0: STRAIGHT + HALF_LOOP, length: STRAIGHT },
  { kind: 'curve', s0: 2 * STRAIGHT + HALF_LOOP, length: HALF_LOOP },
];

const wrap = (s: number): number => ((s % LAP) + LAP) % LAP;

/** A point on the main oval at arc length s (wraps around the lap). */
export function pointAt(sIn: number): PathPoint {
  const s = wrap(sIn);
  if (s < STRAIGHT) return { x: LEFT_CX + s, y: FRONT_Y, tx: 1, ty: 0 };
  if (s < STRAIGHT + HALF_LOOP) {
    const a = -Math.PI / 2 + (s - STRAIGHT) / R3;
    return { x: RIGHT_CX + R3 * Math.cos(a), y: CURVE_CY + R3 * Math.sin(a), tx: -Math.sin(a), ty: Math.cos(a) };
  }
  if (s < 2 * STRAIGHT + HALF_LOOP) return { x: RIGHT_CX - (s - STRAIGHT - HALF_LOOP), y: BACK_Y, tx: -1, ty: 0 };
  const a = Math.PI / 2 + (s - 2 * STRAIGHT - HALF_LOOP) / R3;
  return { x: LEFT_CX + R3 * Math.cos(a), y: CURVE_CY + R3 * Math.sin(a), tx: -Math.sin(a), ty: Math.cos(a) };
}

/** Arc length at lap fraction u (0 → 1). */
export const arcLength = (u: number): number => u * LAP;

// Siding (STYLE §1): a trailing turnout at x 1060 on the front straight, diverging
// towards +y and pointing west, R2 for 40°, then a 150 mm straight to the buffer stop.
export const TURNOUT_X = 1060;
export const SIDING_ANGLE = (40 * Math.PI) / 180;
export const SIDING_ARC = R2 * SIDING_ANGLE; // ≈ 305.4
export const SIDING_STRAIGHT = 150;
export const SIDING_LENGTH = SIDING_ARC + SIDING_STRAIGHT; // ≈ 455.4
const SIDING_CY = FRONT_Y + R2; // 542

/** A point on the siding at arc length s from the turnout (0 → SIDING_LENGTH). */
export function sidingAt(sIn: number): PathPoint {
  const s = Math.min(Math.max(sIn, 0), SIDING_LENGTH);
  if (s <= SIDING_ARC) {
    const a = -Math.PI / 2 - s / R2;
    return { x: TURNOUT_X + R2 * Math.cos(a), y: SIDING_CY + R2 * Math.sin(a), tx: Math.sin(a), ty: -Math.cos(a) };
  }
  const end = sidingAt(SIDING_ARC);
  const d = s - SIDING_ARC;
  return { x: end.x + end.tx * d, y: end.y + end.ty * d, tx: end.tx, ty: end.ty };
}

/** The buffer stop at the end of the siding (STYLE §1: (663.9, 303.3)). */
export const BUFFER = sidingAt(SIDING_LENGTH);

/** Plan distance from (x, y) to the oval centre line. */
export function distanceToLoop(x: number, y: number): number {
  if (x >= LEFT_CX && x <= RIGHT_CX) return Math.min(Math.abs(y - FRONT_Y), Math.abs(y - BACK_Y), curveDist(x, y));
  return curveDist(x, y);
}
function curveDist(x: number, y: number): number {
  const cx = x < (LEFT_CX + RIGHT_CX) / 2 ? LEFT_CX : RIGHT_CX;
  const onSide = cx === LEFT_CX ? x <= LEFT_CX : x >= RIGHT_CX;
  const r = Math.hypot(x - cx, y - CURVE_CY);
  const curve = onSide ? Math.abs(r - R3) : Infinity;
  const ends = Math.min(Math.hypot(x - cx, y - FRONT_Y), Math.hypot(x - cx, y - BACK_Y));
  return Math.min(curve, ends);
}

/** Plan distance from (x, y) to the siding centre line. */
export function distanceToSiding(x: number, y: number): number {
  const r = Math.hypot(x - TURNOUT_X, y - SIDING_CY);
  const a = Math.atan2(y - SIDING_CY, x - TURNOUT_X); // the arc spans −90° → −130°
  let d = Infinity;
  if (a <= -Math.PI / 2 && a >= -Math.PI / 2 - SIDING_ANGLE) d = Math.abs(r - R2);
  const p = sidingAt(SIDING_ARC);
  const t = Math.min(Math.max((x - p.x) * p.tx + (y - p.y) * p.ty, 0), SIDING_STRAIGHT);
  d = Math.min(d, Math.hypot(x - (p.x + p.tx * t), y - (p.y + p.ty * t)));
  return Math.min(d, Math.hypot(x - TURNOUT_X, y - FRONT_Y));
}

/** Plan distance to the nearest track centre line (oval or siding). */
export const distanceToTrack = (x: number, y: number): number => Math.min(distanceToLoop(x, y), distanceToSiding(x, y));
