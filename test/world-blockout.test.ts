import { Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { hopCorridor } from '../src/world/camera/hop';
import { buildBlockout, buildPieces, type SetPiece } from '../src/world/blockout';
import { placeTrees } from '../src/world/blockout/trees';
import { MIN_CLEARANCE, clearance, distanceToAabb } from '../src/world/terrain/clearance';
import type { Tier } from '../src/world/units';

// STYLE §10 per-piece budgets [desktop tris, draws, phone tris, draws], kept apart from
// the code on purpose. Terrain and hill share one row.
const ROWS: Record<string, readonly [number, number, number, number]> = {
  'terrain+hill': [30_000, 5, 10_000, 3],
  track: [16_000, 3, 8_000, 2],
  station_bootcamp: [22_000, 11, 9_000, 5],
  station_campus: [26_000, 12, 10_000, 6],
  station_city: [38_000, 17, 14_000, 8],
  station_workshop: [24_000, 13, 9_000, 6],
  water_bridge: [10_000, 4, 4_000, 2],
  crossing: [5_000, 4, 2_000, 2],
  trees: [25_000, 2, 9_000, 1],
  railbus: [18_000, 6, 6_000, 3],
};
const SCENE_CAP = { tris: 60_000, draws: 40 } as const; // §5.3, both tiers
const KEEP_OUT = 30; // §2.6

const TIERS: Tier[] = ['desktop', 'phone'];
const pieces = Object.fromEntries(TIERS.map((t) => [t, buildPieces(t)])) as Record<Tier, SetPiece[]>;
const rowOf = (id: string) => (id === 'terrain' || id === 'hill' ? 'terrain+hill' : id);

describe('blockout contract', () => {
  it('builds every planned set piece once, with its GLB node name', () => {
    for (const t of TIERS) {
      const ids = pieces[t].map((p) => p.id).sort();
      expect(ids).toEqual(
        ['crossing', 'hill', 'railbus', 'station_bootcamp', 'station_campus', 'station_city', 'station_workshop', 'terrain', 'track', 'trees', 'water_bridge'],
      );
      for (const p of pieces[t]) expect(p.group.name).toBe(p.id);
    }
  });

  it('adds the groups to the scene', () => {
    const scene = new Scene();
    const built = buildBlockout(scene, 'phone');
    expect(scene.children.length).toBe(built.length);
  });
});

describe('budgets', () => {
  for (const t of TIERS) {
    it(`keeps every ${t} piece inside its STYLE §10 row`, () => {
      const sums = new Map<string, { tris: number; draws: number }>();
      for (const p of pieces[t]) {
        const row = rowOf(p.id);
        const s = sums.get(row) ?? { tris: 0, draws: 0 };
        sums.set(row, { tris: s.tris + p.budget.tris, draws: s.draws + p.budget.draws });
      }
      expect([...sums.keys()].sort()).toEqual(Object.keys(ROWS).sort());
      for (const [row, s] of sums) {
        const [dt, dd, pt, pd] = ROWS[row]!;
        expect(s.tris, `${row} tris`).toBeLessThanOrEqual(t === 'desktop' ? dt : pt);
        expect(s.draws, `${row} draws`).toBeLessThanOrEqual(t === 'desktop' ? dd : pd);
      }
    });

    it(`keeps the ${t} scene under the §5.3 caps`, () => {
      const tris = pieces[t].reduce((a, p) => a + p.budget.tris, 0);
      const draws = pieces[t].reduce((a, p) => a + p.budget.draws, 0);
      expect(tris).toBeLessThanOrEqual(SCENE_CAP.tris);
      expect(draws).toBeLessThanOrEqual(SCENE_CAP.draws);
    });
  }
});

describe('§2.6 corridor keep-out', () => {
  const corridor = [...hopCorridor('desktop', 1500), ...hopCorridor('phone', 1500)];
  for (const t of TIERS) {
    it(`keeps every ${t} solid at least 30 mm from both tiers' hop paths`, () => {
      for (const b of pieces[t].flatMap((p) => p.aabbs)) {
        let min = Infinity;
        for (const q of corridor) min = Math.min(min, distanceToAabb(q, b));
        expect(min, b.name).toBeGreaterThanOrEqual(KEEP_OUT);
      }
    });

    it(`keeps tree trunks and canopies ±60 mm in plan from the ${t} corridor`, () => {
      const trees = pieces[t].find((p) => p.id === 'trees')!;
      // A canopy is a cone: test its plan circle (centre and radius from the box).
      for (const b of trees.aabbs) {
        const cx = (b.min.x + b.max.x) / 2;
        const cy = (b.min.y + b.max.y) / 2;
        const r = (b.max.x - b.min.x) / 2;
        let min = Infinity;
        for (const q of corridor) min = Math.min(min, Math.hypot(q.x - cx, q.y - cy) - r);
        expect(min, b.name).toBeGreaterThanOrEqual(60);
      }
    });

    it(`keeps the ${t} hop paths at the §3.4 clearance`, () => {
      const boxes = pieces[t].flatMap((p) => p.aabbs);
      for (const q of hopCorridor(t, 400)) expect(clearance(q, boxes)).toBeGreaterThanOrEqual(MIN_CLEARANCE);
    });
  }
});

describe('trees', () => {
  it('places the full STYLE §10 count, the same way every time', () => {
    const avoid = pieces.desktop.filter((p) => p.id !== 'trees').flatMap((p) => p.aabbs);
    const a = placeTrees('desktop', avoid);
    const b = placeTrees('desktop', avoid);
    expect(a).toEqual(b);
    expect(a.length).toBe(250);
    expect(pieces.phone.find((p) => p.id === 'trees')!.aabbs.length).toBe(150);
  });
});
