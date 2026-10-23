import { describe, expect, it } from 'vitest';
import { APEX, backControl, backPath, easeHop, frontPath, samplePath } from '../src/world/camera/hop';
import { OVERVIEW, STATIONS, STATION_POSES, fovFor, pixelRatioFor, tierFor } from '../src/world/camera/poses';
import { HILL } from '../src/world/terrain/heightmap';
import { LAP } from '../src/world/track/path';
import { PLANE_HEAVE, planeAt, planeHeight } from '../src/world/track/plane';
import { type TablePoint, type Tier, toThree } from '../src/world/units';

const TIERS: Tier[] = ['desktop', 'phone'];
const dist = (a: TablePoint, b: TablePoint) => Math.hypot(a.x - b.x, a.y - b.y, a.h - b.h);
const r = (v: number, d = 1) => +v.toFixed(d);

/** Distance from p to the segment a–b. */
function segDist(p: TablePoint, a: TablePoint, b: TablePoint): number {
  const d = { x: b.x - a.x, y: b.y - a.y, h: b.h - a.h };
  const len2 = d.x ** 2 + d.y ** 2 + d.h ** 2;
  const t = Math.min(Math.max(((p.x - a.x) * d.x + (p.y - a.y) * d.y + (p.h - a.h) * d.h) / len2, 0), 1);
  return dist(p, { x: a.x + d.x * t, y: a.y + d.y * t, h: a.h + d.h * t });
}

// The plane path as a fine polyline over the lap, lowered by its heave.
const PLANE = Array.from({ length: 5332 }, (_, i) => planeAt((LAP * i) / 5331));
function planeDistance(p: TablePoint): number {
  let min = Infinity;
  for (let i = 0; i < PLANE.length - 1; i++) min = Math.min(min, segDist(p, PLANE[i]!, PLANE[i + 1]!));
  return min - PLANE_HEAVE;
}

describe('pose tables (M2 spec §1)', () => {
  it('places the overviews where §1.2 and §1.3 put them', () => {
    expect(toThree(OVERVIEW.desktop.position).map((v) => r(v, 3))).toEqual([0, 1.25, 1.907]);
    expect(toThree(OVERVIEW.desktop.target).map((v) => r(v, 3))).toEqual([0, 0, 0.122]);
    expect(toThree(OVERVIEW.phone.position).map((v) => r(v, 3))).toEqual([-2.2, 0.9, 0]);
    expect(toThree(OVERVIEW.phone.target).map((v) => r(v, 3))).toEqual([-0.76, 0, 0]);
    expect([OVERVIEW.desktop.vFov, OVERVIEW.phone.vFov]).toEqual([37.8, 46.4]);
    expect([OVERVIEW.desktop.near, OVERVIEW.desktop.far]).toEqual([0.05, 10]);
  });

  it('pitches the desktop overview −35° and puts the aim point 2.18 m away', () => {
    const { position: c, target: t } = OVERVIEW.desktop;
    const pitch = (Math.atan2(t.h - c.h, Math.hypot(t.x - c.x, t.y - c.y)) * 180) / Math.PI;
    expect(pitch).toBeCloseTo(-35, 0);
    expect(dist(c, t) / 1000).toBeCloseTo(2.18, 2);
  });

  it('picks the phone tier below 883 px wide or 500 px tall', () => {
    expect(tierFor(1440, 900)).toBe('desktop');
    expect(tierFor(883, 500)).toBe('desktop');
    expect(tierFor(882, 900)).toBe('phone');
    expect(tierFor(1440, 499)).toBe('phone');
    expect(tierFor(390, 844)).toBe('phone');
  });

  it('holds the desktop horizontal-FOV floor below aspect 1.6', () => {
    expect(fovFor(OVERVIEW.desktop, 'desktop', 1.6, 'overview')).toBe(37.8);
    expect(fovFor(OVERVIEW.desktop, 'desktop', 1.0, 'overview')).toBeCloseTo(57.5, 6);
    const at16 = fovFor(OVERVIEW.desktop, 'desktop', 1.6 - 1e-9, 'overview');
    expect(at16).toBeCloseTo(37.8, 0);
    expect(fovFor(OVERVIEW.phone, 'phone', 0.46, 'overview')).toBe(46.4);
    expect(pixelRatioFor(3)).toBe(2);
    expect(pixelRatioFor(1)).toBe(1);
  });

  it('keeps every authored station pose at least 40 mm from the plane path (STYLE §8.3)', () => {
    for (const tier of TIERS) {
      for (const id of STATIONS) expect(planeDistance(STATION_POSES[tier][id].position)).toBeGreaterThanOrEqual(40);
    }
  });
});

describe('hop paths (M2 spec §2)', () => {
  it('builds the §2.3 controls', () => {
    const q = backControl(STATION_POSES.desktop.campus.position, STATION_POSES.desktop.city.position);
    expect([r(q.x), r(q.y), r(q.h)]).toEqual([1112.5, 1644.2, 363.7]);
    const qp = backControl(STATION_POSES.phone.campus.position, STATION_POSES.phone.city.position);
    expect([r(qp.x), r(qp.y), r(qp.h)]).toEqual([1112.5, 1720.8, 293.3]);
  });

  it('passes through the apex and ends on the station poses', () => {
    for (const tier of TIERS) {
      const path = backPath(tier);
      expect(dist(path(0.5), APEX)).toBeLessThan(1e-9);
      expect(dist(path(0), STATION_POSES[tier].campus.position)).toBe(0);
      expect(dist(path(1), STATION_POSES[tier].city.position)).toBeLessThan(1e-9);
    }
  });

  it('stays at or above the 196.8 floor over the hill footprint (ruling 1)', () => {
    const mins: number[] = [];
    for (const tier of TIERS) {
      const over = samplePath(backPath(tier)).filter(
        (p) => p.x >= HILL.x0 && p.x <= HILL.x1 && p.y >= HILL.y0 && p.y <= HILL.y1,
      );
      expect(over.length).toBeGreaterThan(1000);
      const min = Math.min(...over.map((p) => p.h));
      expect(min).toBeGreaterThanOrEqual(196.8);
      mins.push(r(min));
    }
    expect(mins).toEqual([287.3, 299.1]);
  });

  it("keeps the hop arc at least 40 mm from the paper plane's 150 mm peak over the hill", () => {
    // The plane flies 150 above rail (156.8 datum) along y 1095.5 from x 1200 to 1020.
    const a = { x: 1020, y: 1095.5, h: 156.8 };
    const b = { x: 1200, y: 1095.5, h: 156.8 };
    expect(planeHeight(3300) + 6.8).toBeCloseTo(156.8, 6);
    const seen: number[] = [];
    for (const tier of TIERS) {
      const min = Math.min(...samplePath(backPath(tier)).map((p) => segDist(p, a, b)));
      expect(min).toBeGreaterThanOrEqual(40);
      seen.push(r(min));
    }
    expect(seen).toEqual([140.1, 142.8]);
  });

  it('keeps both hop paths at least 40 mm from the whole plane path', () => {
    for (const tier of TIERS) {
      for (const path of [backPath(tier), frontPath(tier)]) {
        const min = Math.min(...samplePath(path, 400).map(planeDistance));
        expect(min).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it('lifts the front pair 30 mm at mid-hop', () => {
    expect(frontPath('desktop')(0.5).h).toBeCloseTo(256, 9);
    expect(frontPath('phone')(0.5).h).toBeCloseTo(331.7, 9);
    expect(frontPath('desktop')(1).x).toBe(1310);
  });

  it('eases with cubic-bezier(0.65, 0, 0.35, 1)', () => {
    expect(easeHop(0)).toBeCloseTo(0, 9);
    expect(easeHop(1)).toBeCloseTo(1, 9);
    expect(easeHop(0.5)).toBeCloseTo(0.5, 6);
    expect(easeHop(0.25)).toBeLessThan(0.25);
  });
});
