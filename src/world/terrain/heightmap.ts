// Ground-height map (M2 spec §3): the terrain surface (board top, hill and water
// surface), built at runtime from the analytic functions on a 5 mm grid and sampled
// bilinearly. Buildings, track and platforms are not in it; they are in the clearance
// field (clearance.ts).
import { LEVEL, TABLE_D, TABLE_W, fromX, fromZ } from '../units';

export const smoothstep = (a: number, b: number, v: number): number => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Hill footprint and tunnel (§3.2, STYLE §1.1). */
export const HILL = { x0: 990, x1: 1235, y0: 1020, y1: 1200, crest: LEVEL.hillCrest } as const;
export const PORTAL_WEST = 1020;
export const PORTAL_EAST = 1200;
export const CUTTING_HALF = 30;
export const BACK_TRACK_Y = 1095.5;
/** The bore, cut from the clearance field only: x 1020–1200, 50 wide, h 0–69.8. */
export const BORE = { x0: 1020, x1: 1200, y0: 1070.5, y1: 1120.5, h0: 0, h1: LEVEL.portalOpeningTop } as const;
export const LAKE = { cx: 1650, cy: 700, rx: 95, ry: 70 } as const;
export const RIVER = { x0: 1620, x1: 1712, y0: 770, y1: 1200, bank: 10 } as const;

/**
 * Hill height without the water: H = 116.8 · sx · sy, with the track cutting at both ends.
 * The cutting includes the portal lines themselves, so the bilinear sampler never smears
 * the hill onto the level track outside the tunnel.
 */
export function hillHeight(x: number, y: number): number {
  if (x <= HILL.x0 || x >= HILL.x1 || y <= HILL.y0) return 0;
  if (inCutting(x, y)) return 0;
  const sx = smoothstep(990, 1030, x) * (1 - smoothstep(1190, 1235, x));
  const sy = smoothstep(1020, 1080, y);
  return HILL.crest * sx * sy;
}

/** The track cutting: 0 where |y − 1095.5| ≤ 30 outside the portals (x ≤ 1020 or ≥ 1200). */
export const inCutting = (x: number, y: number): boolean =>
  Math.abs(y - BACK_TRACK_Y) <= CUTTING_HALF && (x <= PORTAL_WEST || x >= PORTAL_EAST);

/** Water depth term (≤ 0): the lake ellipse at −30 and the river strip with 10 mm banks. */
export function waterHeight(x: number, y: number): number {
  const e = ((x - LAKE.cx) / LAKE.rx) ** 2 + ((y - LAKE.cy) / LAKE.ry) ** 2;
  if (e <= 1) return LEVEL.water;
  const dx = Math.max(RIVER.x0 - x, 0, x - RIVER.x1);
  const dy = Math.max(RIVER.y0 - y, 0, y - RIVER.y1);
  const d = Math.hypot(dx, dy);
  if (d >= RIVER.bank) return 0;
  return LEVEL.water * (1 - smoothstep(0, RIVER.bank, d));
}

/** The analytic terrain height in mm datum at table (x, y). Off the board: −120. */
export function analyticHeight(x: number, y: number): number {
  if (x < 0 || x > TABLE_W || y < 0 || y > TABLE_D) return LEVEL.fasciaBottom;
  const h = hillHeight(x, y);
  return h > 0 ? h : waterHeight(x, y);
}

export const GRID_STEP = 5;
export const GRID_COLS = TABLE_W / GRID_STEP + 1; // 481
export const GRID_ROWS = TABLE_D / GRID_STEP + 1; // 241

let grid: Float32Array | null = null;

/** The 481 × 241 grid in mm datum, row-major by y, built once on first use. */
export function heightGrid(): Float32Array {
  if (grid) return grid;
  const g = new Float32Array(GRID_COLS * GRID_ROWS);
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) g[r * GRID_COLS + c] = analyticHeight(c * GRID_STEP, r * GRID_STEP);
  }
  return (grid = g);
}

/** Bilinear sample of the grid in table mm → mm datum (−120 off the board). */
export function heightAt(x: number, y: number): number {
  if (x < 0 || x > TABLE_W || y < 0 || y > TABLE_D) return LEVEL.fasciaBottom;
  const g = heightGrid();
  const fx = x / GRID_STEP;
  const fy = y / GRID_STEP;
  const c0 = Math.min(Math.floor(fx), GRID_COLS - 2);
  const r0 = Math.min(Math.floor(fy), GRID_ROWS - 2);
  const tx = fx - c0;
  const ty = fy - r0;
  const i = r0 * GRID_COLS + c0;
  const a = g[i]!;
  const b = g[i + 1]!;
  const c = g[i + GRID_COLS]!;
  const d = g[i + GRID_COLS + 1]!;
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/** groundHeight(X, Z) → Y in three metres (§3.1). */
export const groundHeight = (X: number, Z: number): number => heightAt(fromX(X), fromZ(Z)) / 1000;
