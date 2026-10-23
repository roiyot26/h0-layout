import { describe, expect, it } from 'vitest';
import { buildPieces } from '../src/world/blockout';
import { flyClear, makeFly } from '../src/world/camera/fly';
import { arcLengthInverse, quadraticThrough } from '../src/world/camera/hop';
import { authoredOrbit, dragOrbit, limitsFor, orbitPosition } from '../src/world/camera/orbit';
import { angleBetween, lookAt } from '../src/world/camera/orientation';
import { STATION_POSES, type StationId } from '../src/world/camera/poses';
import { MIN_CLEARANCE, clearance, nearestAabb } from '../src/world/terrain/clearance';
import type { Tier } from '../src/world/units';

const OTHER: Record<StationId, StationId> = { campus: 'city', city: 'campus', workshop: 'bootcamp', bootcamp: 'workshop' };
const HILL = { x0: 990, x1: 1235, y0: 1020, y1: 1200 };
const STEP = 1; // ms

const BOXES = { desktop: buildPieces('desktop').flatMap((p) => p.aabbs), phone: buildPieces('phone').flatMap((p) => p.aabbs) };

/** A clamped grid start: drag from the authored pose towards the raw grid point, as the rig clamps input. */
function startFor(tier: Tier, from: StationId, azimuth: number, polar: number, distance: number) {
  const pose = STATION_POSES[tier][from];
  const boxes = BOXES[tier];
  const end = STATION_POSES[tier][OTHER[from]];
  const a = authoredOrbit(pose);
  const s = dragOrbit(pose, limitsFor(tier, from), a, { ...a, azimuth, polar, distance }, boxes, (p) => flyClear(p, OTHER[from], end, boxes));
  const position = orbitPosition(pose, s);
  return { boxes, s, start: { position, look: lookAt(position, s.target), vFov: pose.vFov } };
}

describe('fly (M2 spec §2, §6 F20b)', () => {
  it('inverts arc length with a 256-entry table', () => {
    const p = STATION_POSES.desktop;
    const curve = quadraticThrough(p.campus.position, p.city.position);
    const arc = arcLengthInverse(curve);
    // Equal steps in s cover equal lengths.
    const pts = Array.from({ length: 201 }, (_, i) => curve(arc.u(i / 200)));
    const seg = pts.slice(1).map((q, i) => Math.hypot(q.x - pts[i]!.x, q.y - pts[i]!.y, q.h - pts[i]!.h));
    for (const d of seg) expect(Math.abs(d / (arc.length / 200) - 1)).toBeLessThan(0.005);
    expect(arc.u(0)).toBe(0);
    expect(arc.u(1)).toBe(1);
  });

  it('holds orientation on authored hops (0°/s) and lands exactly', () => {
    for (const tier of ['desktop', 'phone'] as Tier[]) {
      for (const from of Object.keys(OTHER) as StationId[]) {
        const a = STATION_POSES[tier][from];
        const b = STATION_POSES[tier][OTHER[from]];
        const fly = makeFly({ position: a.position, look: lookAt(a.position, a.target), vFov: a.vFov }, OTHER[from], b);
        expect(fly.duration).toBe(1000);
        for (let t = 0; t <= 1000; t += 50) expect(angleBetween(fly.at(t).look, lookAt(b.position, b.target))).toBeLessThan(1e-6);
        expect(fly.at(1000).position).toEqual(b.position);
      }
    }
  });

  it('keeps the raw City start (−30°, 78°, 0.30 m) unreachable', () => {
    for (const tier of ['desktop', 'phone'] as Tier[]) {
      const { s, start, boxes } = startFor(tier, 'city', -30, 78, 300);
      const raw = orbitPosition(STATION_POSES[tier].city, { ...s, azimuth: -30, polar: 78, distance: 300 });
      expect(nearestAabb(raw, boxes).box?.name).toBe('city block 3');
      expect(Math.hypot(start.position.x - raw.x, start.position.y - raw.y, start.position.h - raw.h)).toBeGreaterThan(10);
      expect(clearance(start.position, boxes)).toBeGreaterThanOrEqual(MIN_CLEARANCE);
    }
  });

  const grid: [number, number, number][] = [];
  for (const az of [-30, -10, 10, 30]) for (const polar of [50, 78]) for (const d of [300, 800]) grid.push([az, polar, d]);

  for (const tier of ['desktop', 'phone'] as Tier[]) {
    for (const from of ['campus', 'city', 'workshop', 'bootcamp'] as StationId[]) {
      it(`${tier} ${from} → ${OTHER[from]} from every clamped grid start`, () => {
        const to = OTHER[from];
        const end = STATION_POSES[tier][to];
        const endLook = lookAt(end.position, end.target);
        let worstRate = 0;
        const fails: string[] = [];
        let worstHill = Infinity;
        for (const [az, polar, d] of grid) {
          const { boxes, start } = startFor(tier, from, az, polar, d);
          const fly = makeFly(start, to, end);
          expect(fly.duration / 1000).toBeGreaterThanOrEqual(0.95);
          expect(fly.duration / 1000).toBeLessThanOrEqual(1.05);
          let prev = fly.at(0);
          expect(clearance(prev.position, boxes)).toBeGreaterThanOrEqual(MIN_CLEARANCE);
          for (let t = STEP; t <= fly.duration; t += STEP) {
            const f = fly.at(t);
            expect(f.roll).toBe(0);
            worstRate = Math.max(worstRate, angleBetween(prev.look, f.look) / (STEP / 1000));
            const c = clearance(f.position, boxes);
            if (c < MIN_CLEARANCE) fails.push(`${az}/${polar}/${d} clearance ${c.toFixed(3)} at ${t} ms near ${nearestAabb(f.position, boxes).box?.name} ${JSON.stringify(f.position)} start ${JSON.stringify(start.position)}`);
            const p = f.position;
            if (p.x >= HILL.x0 && p.x <= HILL.x1 && p.y >= HILL.y0 && p.y <= HILL.y1) worstHill = Math.min(worstHill, p.h);
            prev = f;
          }
          const last = fly.at(fly.duration);
          expect(Math.hypot(last.position.x - end.position.x, last.position.y - end.position.y, last.position.h - end.position.h)).toBeLessThanOrEqual(1);
          expect(angleBetween(last.look, endLook)).toBeLessThanOrEqual(0.5);
        }
        expect(fails.slice(0, 3)).toEqual([]);
        expect(worstRate).toBeLessThanOrEqual(45);
        // Ruling 1: ≥ 190 mm above rail (196.8 datum) over the hill footprint.
        if (worstHill < Infinity) expect(worstHill).toBeGreaterThanOrEqual(196.8);
      }, 30_000);
    }
  }
});
