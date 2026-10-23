// Table frame and levels (M2 spec §0). Table coordinates are mm: x 0 → 2400 left to
// right, y 0 (front fascia) → 1200 (backdrop), h above the datum (the table top).
// three.js uses metres with the board centre at the origin and the front facing +Z.

export const TABLE_W = 2400;
export const TABLE_D = 1200;

/** Rendering tier. Phone poses and lighter meshes apply on the phone tier (§1.1). */
export type Tier = 'desktop' | 'phone';

/** Datum heights in mm (§0 levels table). */
export const LEVEL = {
  water: -30,
  table: 0,
  ballastTop: 3.0,
  railTop: 6.8,
  platformTop: 15.5,
  portalOpeningTop: 69.8,
  hillCrest: 116.8,
  shedEaves: 81.8,
  shedRidge: 111.8,
  hopFloor: 196.8,
  fasciaBottom: -120,
} as const;

export const RAIL_TOP = LEVEL.railTop;

/** A point in table space: x, y and h in mm. */
export interface TablePoint {
  x: number;
  y: number;
  h: number;
}

export const toX = (x: number): number => (x - TABLE_W / 2) / 1000;
export const toY = (h: number): number => h / 1000;
export const toZ = (y: number): number => (TABLE_D / 2 - y) / 1000;
export const fromX = (X: number): number => X * 1000 + TABLE_W / 2;
export const fromZ = (Z: number): number => TABLE_D / 2 - Z * 1000;

/** Table mm → three metres, as an [X, Y, Z] tuple. */
export function toThree(p: TablePoint): [number, number, number] {
  return [toX(p.x), toY(p.h), toZ(p.y)];
}

/** three metres → table mm. */
export function fromThree(X: number, Y: number, Z: number): TablePoint {
  return { x: fromX(X), y: fromZ(Z), h: Y * 1000 };
}

/** Height above rail top → datum height (§0: add 6.8 mm). */
export const aboveRail = (mm: number): number => mm + RAIL_TOP;
