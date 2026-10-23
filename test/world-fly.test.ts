import { describe, expect, it } from 'vitest';
import { makeFly } from '../src/world/camera/fly';
import { arcLengthInverse, quadraticThrough } from '../src/world/camera/hop';
import { angleBetween, lookAt } from '../src/world/camera/orientation';
import { STATION_POSES, type StationId } from '../src/world/camera/poses';
import type { Tier } from '../src/world/units';

const OTHER: Record<StationId, StationId> = { campus: 'city', city: 'campus', workshop: 'bootcamp', bootcamp: 'workshop' };
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
});
