// Camera orientation as yaw and pitch with roll 0 (M2 spec §1.1). Yaw 0 looks along +y
// in table space; positive yaw turns towards +x. Pitch is negative looking down.
import type { TablePoint } from '../units';

export interface Look {
  yaw: number;
  pitch: number;
}

const DEG = 180 / Math.PI;

/** Yaw and pitch in degrees of the ray from `from` to `to`. */
export function lookAt(from: TablePoint, to: TablePoint): Look {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dh = to.h - from.h;
  return { yaw: Math.atan2(dx, dy) * DEG, pitch: Math.atan2(dh, Math.hypot(dx, dy)) * DEG };
}

/** Unit forward vector in table axes. */
export function forward({ yaw, pitch }: Look): TablePoint {
  const y = yaw / DEG;
  const p = pitch / DEG;
  return { x: Math.cos(p) * Math.sin(y), y: Math.cos(p) * Math.cos(y), h: Math.sin(p) };
}

/** Angle in degrees between two looks. */
export function angleBetween(a: Look, b: Look): number {
  const u = forward(a);
  const v = forward(b);
  const dot = Math.min(Math.max(u.x * v.x + u.y * v.y + u.h * v.h, -1), 1);
  return Math.acos(dot) * DEG;
}

/** Shortest signed yaw difference b − a in (−180, 180]. */
export function yawDelta(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d <= -180) d += 360;
  if (d > 180) d -= 360;
  return d;
}

/** A point `distance` mm along the look from `from`. */
export function along(from: TablePoint, look: Look, distance: number): TablePoint {
  const f = forward(look);
  return { x: from.x + f.x * distance, y: from.y + f.y * distance, h: from.h + f.h * distance };
}
