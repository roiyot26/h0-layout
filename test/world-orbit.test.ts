import { describe, expect, it } from 'vitest';
import { buildPieces } from '../src/world/blockout';
import { authoredOrbit, clampOrbit, clampRanges, damp, limitsFor, orbitPosition } from '../src/world/camera/orbit';
import { OVERVIEW, STATION_POSES } from '../src/world/camera/poses';
import { MIN_CLEARANCE, clearance, nearestAabb } from '../src/world/terrain/clearance';

const boxes = buildPieces('desktop').flatMap((p) => p.aabbs);

describe('orbit clamps (M2 spec §1.2, §1.3, §3.4)', () => {
  it('uses the STYLE ranges per tier', () => {
    expect(limitsFor('desktop', 'overview')).toMatchObject({ azimuth: 20, distance: [2000, 2600] });
    expect(limitsFor('desktop', 'city')).toEqual({ azimuth: 30, polar: [50, 78], distance: [300, 800], targetBox: 125 });
    expect(limitsFor('phone', 'city')).toMatchObject({ azimuth: 20, distance: [300, 700] });
    expect(limitsFor('phone', 'overview')).toMatchObject({ azimuth: 20, distance: null });
  });

  it('round-trips the authored pose', () => {
    for (const pose of [OVERVIEW.desktop, STATION_POSES.desktop.campus, STATION_POSES.phone.workshop]) {
      const p = orbitPosition(pose, authoredOrbit(pose));
      expect(p.x).toBeCloseTo(pose.position.x, 6);
      expect(p.y).toBeCloseTo(pose.position.y, 6);
      expect(p.h).toBeCloseTo(pose.position.h, 6);
    }
    // Overview slant inside the 2.0–2.6 m range; station polar inside 50–78°.
    expect(authoredOrbit(OVERVIEW.desktop).distance).toBeCloseTo(2179.2, 0);
    expect(authoredOrbit(STATION_POSES.desktop.bootcamp).polar).toBeCloseTo(65, 0);
  });

  it('clamps azimuth, polar, distance and the target box', () => {
    const pose = STATION_POSES.desktop.campus;
    const a = authoredOrbit(pose);
    const r = clampRanges(pose, limitsFor('desktop', 'campus'), {
      azimuth: 75,
      polar: 10,
      distance: 50,
      target: { x: a.target.x + 400, y: a.target.y, h: a.target.h - 400 },
    });
    expect(r).toEqual({ azimuth: 30, polar: 50, distance: 300, target: { x: a.target.x + 125, y: a.target.y, h: a.target.h - 125 } });
  });

  it('moves the raw Bootcamp start (azimuth −30, polar 78, 0.30 m) out of the bootcamp house', () => {
    const pose = STATION_POSES.desktop.bootcamp;
    const raw = { ...authoredOrbit(pose), azimuth: -30, polar: 78, distance: 300 };
    const rawPos = orbitPosition(pose, raw);
    expect(nearestAabb(rawPos, boxes).distance).toBe(0);
    expect(nearestAabb(rawPos, boxes).box?.min).toMatchObject({ x: 662, y: 754 });
    const c = clampOrbit(pose, limitsFor('desktop', 'bootcamp'), raw, boxes);
    expect(c.distance).toBeGreaterThan(300);
    expect(c.distance).toBeLessThanOrEqual(800);
    expect(clearance(orbitPosition(pose, c), boxes)).toBeGreaterThanOrEqual(MIN_CLEARANCE);
  });

  it('damps to within 0.5 % in 400 ms', () => {
    expect(Math.abs(damp(1, 0, 400, 400))).toBeLessThanOrEqual(0.005 + 1e-12);
    expect(damp(1, 0, 0, 400)).toBe(1);
  });
});
