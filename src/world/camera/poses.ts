// Camera pose tables (M2 spec §1) and the tier rule. Positions are table mm datum; the
// renderer maps them with units.toThree.
import type { TablePoint, Tier } from '../units';

export interface Pose {
  position: TablePoint;
  target: TablePoint;
  /** Vertical FOV in degrees at the reference aspect. */
  vFov: number;
  near: number;
  far: number;
}

export type StationId = 'bootcamp' | 'campus' | 'city' | 'workshop';
export const STATIONS: readonly StationId[] = ['bootcamp', 'campus', 'city', 'workshop'];

/** Lens → vFOV (§1.1). */
export const LENS = { mm35: 37.8, mm50: 27.0, mm28: 46.4, mm24: 53.1 } as const;

const p = (x: number, y: number, h: number): TablePoint => ({ x, y, h });
const station = (cam: TablePoint, target: TablePoint, vFov: number): Pose => ({
  position: cam,
  target,
  vFov,
  near: 0.005,
  far: 5,
});

const TARGETS: Record<StationId, TablePoint> = {
  bootcamp: p(1310, 150, 20),
  workshop: p(860, 150, 20),
  campus: p(1395, 960, 30),
  city: p(830, 1040, 20),
};

export const OVERVIEW: Record<Tier, Pose> = {
  desktop: { position: p(1200, -1307, 1250), target: p(1200, 478, 0), vFov: LENS.mm35, near: 0.05, far: 10 },
  phone: { position: p(-1000, 600, 900), target: p(440, 600, 0), vFov: LENS.mm28, near: 0.05, far: 10 },
};

export const STATION_POSES: Record<Tier, Record<StationId, Pose>> = {
  desktop: {
    bootcamp: station(p(1310, -360, 226), TARGETS.bootcamp, LENS.mm50),
    workshop: station(p(860, -360, 226), TARGETS.workshop, LENS.mm50),
    campus: station(p(1395, 506.8, 241.3), TARGETS.campus, LENS.mm50),
    city: station(p(830, 586.8, 231.3), TARGETS.city, LENS.mm50),
  },
  phone: {
    bootcamp: station(p(1310, -379.8, 301.7), TARGETS.bootcamp, LENS.mm24),
    workshop: station(p(860, -379.8, 301.7), TARGETS.workshop, LENS.mm24),
    campus: station(p(1395, 430.2, 311.7), TARGETS.campus, LENS.mm24),
    city: station(p(830, 510.2, 301.7), TARGETS.city, LENS.mm24),
  },
};

/** Tier rule (§1.1, CHECKLIST F25): phone poses below 883 px wide or 500 px tall. */
export { tierFor } from '../../tier';

/** Desktop horizontal-FOV floor (§1.1): hFOV at aspect 1.6 for the overview and stations. */
export const H_FOV_FLOOR = { overview: 57.5, station: 42.0 } as const;
const REFERENCE_ASPECT = 1.6;

/** vFOV in degrees after the desktop floor; phone vFOV is fixed. */
export function fovFor(pose: Pose, tier: Tier, aspect: number, kind: 'overview' | 'station'): number {
  if (tier === 'phone' || aspect >= REFERENCE_ASPECT) return pose.vFov;
  const h = (H_FOV_FLOOR[kind] * Math.PI) / 180;
  return (2 * Math.atan(Math.tan(h / 2) / aspect) * 180) / Math.PI;
}

/** Pixel ratio rule (§1.1): min(devicePixelRatio, 2) on both tiers. */
export const pixelRatioFor = (dpr: number): number => Math.min(dpr, 2);
