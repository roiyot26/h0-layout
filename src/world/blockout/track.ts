// Track set piece (M2 spec §4.2): ballast and rail ribbons along the oval and the siding,
// instanced sleepers and the buffer stop. Rail top is the constant 6.8 datum (§3.3).
import { BoxGeometry, BufferAttribute, BufferGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import {
  BUFFER,
  LAP,
  LOOP,
  type PathPoint,
  SIDING_ARC,
  SIDING_LENGTH,
  pointAt,
  sidingAt,
} from '../track/path';
import { LEVEL, type Tier, toX, toZ } from '../units';
import { PieceBuilder, type SetPiece } from './kit';
import { blockoutMaterial, linear } from './palette';

const BALLAST: readonly (readonly [number, number])[] = [
  [-22.5, 0],
  [-19.5, LEVEL.ballastTop],
  [19.5, LEVEL.ballastTop],
  [22.5, 0],
];
const GAUGE = 16.5;
const RAIL_W = 1.0;
const RAIL_H = 2.1;
const railProfile = (centre: number): (readonly [number, number])[] => [
  [centre - RAIL_W / 2, LEVEL.railTop - RAIL_H],
  [centre - RAIL_W / 2, LEVEL.railTop],
  [centre + RAIL_W / 2, LEVEL.railTop],
  [centre + RAIL_W / 2, LEVEL.railTop - RAIL_H],
];
const RAILS = [railProfile(-(GAUGE + RAIL_W) / 2), railProfile((GAUGE + RAIL_W) / 2)];
const SLEEPER = { across: 29.9, along: 2.9, depth: 1.7, pitch: 6.9 } as const;
/** The bridge span on the back straight, where the deck carries the sleepers (§4.2). */
export const BRIDGE_X = { x0: 1580, x1: 1752 } as const;
const HALF_WIDTH = 22.5;

const curveSegments = (tier: Tier) => (tier === 'desktop' ? 64 : 32);

/** Sample a stretch of arc length [s0, s1] with n segments. */
function run(at: (s: number) => PathPoint, s0: number, s1: number, n: number): PathPoint[] {
  return Array.from({ length: n + 1 }, (_, i) => at(s0 + ((s1 - s0) * i) / n));
}

/** The oval as runs; with `skipBridge` the back straight is broken over the bridge span. */
export function loopRuns(tier: Tier, skipBridge: boolean): PathPoint[][] {
  const [front, right, back, left] = LOOP as [(typeof LOOP)[0], (typeof LOOP)[0], (typeof LOOP)[0], (typeof LOOP)[0]];
  const n = curveSegments(tier);
  const runs = [run(pointAt, front.s0, front.s0 + front.length, 1), run(pointAt, right.s0, right.s0 + right.length, n)];
  const backStart = back.s0;
  const sAtX = (x: number) => backStart + (pointAt(backStart).x - x);
  if (skipBridge) {
    runs.push(run(pointAt, backStart, sAtX(BRIDGE_X.x1), 1), run(pointAt, sAtX(BRIDGE_X.x0), back.s0 + back.length, 1));
  } else {
    runs.push(run(pointAt, backStart, back.s0 + back.length, 1));
  }
  runs.push(run(pointAt, left.s0, LAP, n));
  return runs;
}

export function sidingRuns(tier: Tier): PathPoint[][] {
  const n = tier === 'desktop' ? 12 : 8;
  return [run(sidingAt, 0, SIDING_ARC, n), run(sidingAt, SIDING_ARC, SIDING_LENGTH, 1)];
}

/** Sleeper geometry: a box with the faces that never show removed (fewer on phones). */
function sleeperGeometry(tier: Tier): BufferGeometry {
  const box = new BoxGeometry(SLEEPER.along / 1000, SLEEPER.depth / 1000, SLEEPER.across / 1000);
  // BoxGeometry groups: +x, −x, +y, −y, +z, −z. Desktop drops the underside; phone keeps
  // the top and the two long faces.
  const keep = tier === 'desktop' ? [0, 1, 2, 4, 5] : [0, 1, 2];
  const index = box.getIndex()!;
  const out: number[] = [];
  for (const k of keep) {
    const g = box.groups[k]!;
    for (let i = g.start; i < g.start + g.count; i++) out.push(index.getX(i));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', box.getAttribute('position'));
  g.setAttribute('normal', box.getAttribute('normal'));
  const c = linear('sleeper');
  const n = box.getAttribute('position').count;
  g.setAttribute('color', new BufferAttribute(new Float32Array(n * 3).map((_, i) => [c.r, c.g, c.b][i % 3]!), 3));
  g.setIndex(out);
  return g;
}

/** Sleeper positions along the oval and the siding at the 6.9 mm pitch. */
export function sleeperPoints(): PathPoint[] {
  const main = Math.round(LAP / SLEEPER.pitch);
  const siding = Math.floor(SIDING_LENGTH / SLEEPER.pitch);
  return [
    ...Array.from({ length: main }, (_, i) => pointAt((i * LAP) / main)),
    ...Array.from({ length: siding }, (_, i) => sidingAt((i + 0.5) * SLEEPER.pitch)),
  ];
}

function sleepers(tier: Tier): InstancedMesh {
  const points = sleeperPoints();
  const mesh = new InstancedMesh(sleeperGeometry(tier), blockoutMaterial(), points.length);
  mesh.name = 'track_sleepers';
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const one = new Vector3(1, 1, 1);
  const h = (LEVEL.ballastTop + SLEEPER.depth / 2) / 1000;
  points.forEach((p, i) => {
    q.setFromAxisAngle(up, Math.atan2(p.ty, p.tx));
    mesh.setMatrixAt(i, m.compose(new Vector3(toX(p.x), h, toZ(p.y)), q, one));
  });
  mesh.computeBoundingSphere();
  return mesh;
}

export function build(tier: Tier): SetPiece {
  const b = new PieceBuilder();
  for (const r of [...loopRuns(tier, true), ...sidingRuns(tier)]) b.ribbon(r, BALLAST, 'ballast');
  for (const r of [...loopRuns(tier, false), ...sidingRuns(tier)]) for (const rail of RAILS) b.ribbon(r, rail, 'rail');
  b.object(sleepers(tier));
  b.orientedBox('buffer stop', BUFFER.x, BUFFER.y, 10, 20, 0, 15, Math.atan2(BUFFER.ty, BUFFER.tx), 'signal');
  // Clearance boxes along the centre lines, one per ribbon segment.
  for (const r of [...loopRuns(tier, false), ...sidingRuns(tier)]) {
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i]!;
      const c = r[i + 1]!;
      const xs = [a.x - a.ty * HALF_WIDTH, a.x + a.ty * HALF_WIDTH, c.x - c.ty * HALF_WIDTH, c.x + c.ty * HALF_WIDTH];
      const ys = [a.y + a.tx * HALF_WIDTH, a.y - a.tx * HALF_WIDTH, c.y + c.tx * HALF_WIDTH, c.y - c.tx * HALF_WIDTH];
      b.solid('track', Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), 0, LEVEL.railTop);
    }
  }
  return b.build('track');
}
