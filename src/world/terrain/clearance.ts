// Clearance field (M2 spec §3.4): the height above the terrain, or the distance to the
// nearest blockout box, whichever is smaller. Boxes are axis-aligned in table mm and come
// from the blockout modules (each SetPiece's aabbs).
import type { TablePoint } from '../units';
import { heightAt } from './heightmap';

export interface Aabb {
  /** What the box is, for test messages (for example "city block 3"). */
  name: string;
  min: TablePoint;
  max: TablePoint;
}

export const aabb = (name: string, x0: number, x1: number, y0: number, y1: number, h0: number, h1: number): Aabb => ({
  name,
  min: { x: Math.min(x0, x1), y: Math.min(y0, y1), h: Math.min(h0, h1) },
  max: { x: Math.max(x0, x1), y: Math.max(y0, y1), h: Math.max(h0, h1) },
});

/** Euclidean distance from p to the box in mm (0 inside). */
export function distanceToAabb(p: TablePoint, b: Aabb): number {
  const dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x);
  const dy = Math.max(b.min.y - p.y, 0, p.y - b.max.y);
  const dh = Math.max(b.min.h - p.h, 0, p.h - b.max.h);
  return Math.hypot(dx, dy, dh);
}

/** Nearest box and its distance; Infinity for an empty list. */
export function nearestAabb(p: TablePoint, boxes: readonly Aabb[]): { box: Aabb | null; distance: number } {
  let box: Aabb | null = null;
  let distance = Infinity;
  for (const b of boxes) {
    const d = distanceToAabb(p, b);
    if (d < distance) [box, distance] = [b, d];
  }
  return { box, distance };
}

/** clearance(p) in mm: min(height above the terrain, distance to every box). */
export const clearance = (p: TablePoint, boxes: readonly Aabb[]): number =>
  Math.min(p.h - heightAt(p.x, p.y), nearestAabb(p, boxes).distance);

/** The minimum clearance required of every camera and hop path (STYLE §5). */
export const MIN_CLEARANCE = 12;
