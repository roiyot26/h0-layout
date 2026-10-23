import { describe, expect, it } from 'vitest';
import { aabb, clearance, distanceToAabb, nearestAabb } from '../src/world/terrain/clearance';
import {
  BORE,
  GRID_COLS,
  GRID_ROWS,
  analyticHeight,
  groundHeight,
  heightAt,
  heightGrid,
  inCutting,
} from '../src/world/terrain/heightmap';
import { LAP, SIDING_LENGTH, pointAt, sidingAt } from '../src/world/track/path';

describe('ground-height map (M2 spec §3)', () => {
  it('is a 481 × 241 grid in mm datum', () => {
    expect(GRID_COLS).toBe(481);
    expect(GRID_ROWS).toBe(241);
    expect(heightGrid().length).toBe(115_921);
  });

  it('returns −120 off the board', () => {
    expect(heightAt(-1, 600)).toBe(-120);
    expect(heightAt(1200, 1200.1)).toBe(-120);
    expect(groundHeight(0, -3)).toBe(-0.12);
  });

  it('puts the crest at 116.8 on the track line and cuts the track level into the portals', () => {
    expect(analyticHeight(1112.5, 1095.5)).toBeCloseTo(116.8, 6);
    expect(analyticHeight(1010, 1095.5)).toBe(0);
    expect(analyticHeight(1220, 1110)).toBe(0);
    expect(analyticHeight(1010, 1130)).toBeGreaterThan(0);
  });

  it('keeps the hill at least 20 mm thick over the bore', () => {
    let min = Infinity;
    for (let x = BORE.x0 + 0.5; x < BORE.x1; x += 1) {
      for (let y = BORE.y0; y <= BORE.y1; y += 1) min = Math.min(min, analyticHeight(x, y));
    }
    expect(min - BORE.h1).toBeGreaterThanOrEqual(20);
  });

  it('sets the lake and the river at −30', () => {
    expect(analyticHeight(1650, 700)).toBe(-30);
    expect(analyticHeight(1666, 1000)).toBe(-30);
    expect(analyticHeight(1666, 1199)).toBe(-30);
    expect(analyticHeight(1600, 1000)).toBe(0);
    expect(analyticHeight(1615, 1000)).toBeLessThan(0);
  });

  it('samples within 2 mm of the analytic surface away from the cutting walls', () => {
    // The cutting walls are vertical steps, so a 5 mm cell that straddles one blends both
    // sides; the clearance tests use the sampler, which is the conservative side there.
    const nearWall = (x: number, y: number) =>
      [-5, 0, 5].some((dx) => [-5, 0, 5].some((dy) => inCutting(x + dx, y + dy) !== inCutting(x, y)));
    let worst = 0;
    for (let x = 985; x <= 1240; x += 1.7) {
      for (let y = 1015; y <= 1200; y += 2.3) {
        if (!nearWall(x, y)) worst = Math.max(worst, Math.abs(heightAt(x, y) - analyticHeight(x, y)));
      }
    }
    expect(worst).toBeLessThan(2);
  });

  it('is level (|h| ≤ 0.5 mm) under the track corridor, except the tunnel and bridge', () => {
    const check = (x: number, y: number, tx: number, ty: number) => {
      if (Math.abs(y - 1095.5) < 40 && ((x >= 1020 && x <= 1200) || (x >= 1580 && x <= 1752))) return;
      for (const off of [-22.5, -11, 0, 11, 22.5]) {
        const h = heightAt(x - ty * off, y + tx * off);
        if (Math.abs(h) > 0.5) throw new Error(`ground ${h.toFixed(2)} mm under the track at (${x.toFixed(1)}, ${y.toFixed(1)})`);
      }
    };
    for (let s = 0; s < LAP; s += 2) {
      const p = pointAt(s);
      check(p.x, p.y, p.tx, p.ty);
    }
    for (let s = 0; s <= SIDING_LENGTH; s += 2) {
      const p = sidingAt(s);
      check(p.x, p.y, p.tx, p.ty);
    }
  });
});

describe('clearance field (M2 spec §3.4)', () => {
  const box = aabb('box', 0, 100, 0, 100, 0, 50);

  it('measures the distance to a box', () => {
    expect(distanceToAabb({ x: 50, y: 50, h: 25 }, box)).toBe(0);
    expect(distanceToAabb({ x: 50, y: 50, h: 62 }, box)).toBe(12);
    expect(distanceToAabb({ x: 103, y: 104, h: 25 }, box)).toBe(5);
    expect(nearestAabb({ x: 0, y: 0, h: 0 }, []).distance).toBe(Infinity);
  });

  it('takes the smaller of height above the terrain and box distance', () => {
    expect(clearance({ x: 300, y: 300, h: 40 }, [box])).toBe(40);
    expect(clearance({ x: 50, y: 50, h: 70 }, [box])).toBe(20);
    expect(clearance({ x: 1112.5, y: 1095.5, h: 128.8 }, [])).toBeCloseTo(12, 0);
  });
});
