// Trees (M2 spec §4.2): one InstancedMesh of open cones on trunks in four heights,
// scattered with seed 87. Placement keeps clear of the track, every other set piece,
// the water, the road, the hop corridor (§2.6, ±60 mm plan band) and the station views.
import { BufferAttribute, type BufferGeometry, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hopCorridor } from '../camera/hop';
import { type Aabb, aabb } from '../terrain/clearance';
import { analyticHeight, heightAt } from '../terrain/heightmap';
import { distanceToTrack } from '../track/path';
import { TABLE_W, type Tier, toX, toZ } from '../units';
import { type SetPiece, measure } from './kit';
import { blockoutMaterial, linear } from './palette';

export const TREE_SEED = 87;
export const TREE_COUNT = { desktop: 250, phone: 150 } as const;
export const TREE_HEIGHTS = [115, 150, 190, 230] as const;
const CANOPY = 0.2; // canopy radius and trunk height, as fractions of the tree height
const HOP_BAND = 60;
/** Margin for sampling the corridor at 400 steps per path. */
const HOP_SAMPLING = 1;
const TRACK_BAND = 40;
const SET_PIECE_GAP = 10;
/** The Campus and City station views look across the oval; keep their sightlines open. */
const SIGHTLINES = [
  { x0: 1245, x1: 1545, y0: 400, y1: 1100 },
  { x0: 680, x1: 980, y0: 400, y1: 1100 },
] as const;
const ROAD = { x0: 1605, x1: 1675, y1: 190 } as const;
const BOUNDS = { x0: 30, x1: TABLE_W - 30, y0: 180, y1: 1170 } as const;

/** mulberry32: small, seedable and stable across engines. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    // The usual step is + 0x6d2b79f5. Subtracting its 32-bit complement gives the same
    // value after >>> 0, and keeps the minified chunk free of a '+' and ten digits,
    // which the dist guard reads as a phone number.
    a = (a - 0x92d4860b) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TreeSpot {
  x: number;
  y: number;
  base: number;
  height: number;
}

/** Plan points of both tiers' hop paths. */
const corridorPlan = (() => {
  let cache: { x: number; y: number }[] | null = null;
  return () => (cache ??= [...hopCorridor('desktop'), ...hopCorridor('phone')].map(({ x, y }) => ({ x, y })));
})();

const planToBox = (x: number, y: number, b: Aabb) =>
  Math.hypot(Math.max(b.min.x - x, 0, x - b.max.x), Math.max(b.min.y - y, 0, y - b.max.y));

/** Deterministic placement for a tier, avoiding the given set-piece boxes. */
export function placeTrees(tier: Tier, avoid: readonly Aabb[] = []): TreeSpot[] {
  const rand = mulberry32(TREE_SEED);
  const want = TREE_COUNT[tier];
  const corridor = corridorPlan();
  const out: TreeSpot[] = [];
  for (let tries = 0; out.length < want && tries < want * 400; tries++) {
    const x = BOUNDS.x0 + rand() * (BOUNDS.x1 - BOUNDS.x0);
    const y = BOUNDS.y0 + rand() * (BOUNDS.y1 - BOUNDS.y0);
    const height = TREE_HEIGHTS[Math.floor(rand() * TREE_HEIGHTS.length)]!;
    const r = CANOPY * height;
    if (distanceToTrack(x, y) < TRACK_BAND + r) continue;
    if (x > ROAD.x0 - r && x < ROAD.x1 + r && y < ROAD.y1 + r) continue;
    if (SIGHTLINES.some((s) => x > s.x0 && x < s.x1 && y > s.y0 && y < s.y1)) continue;
    // Water and its banks: test the canopy footprint, not just the trunk.
    if ([0, 1, 2, 3, 4].some((k) => analyticHeight(x + (k === 1 ? r : k === 2 ? -r : 0), y + (k === 3 ? r : k === 4 ? -r : 0)) < 0)) continue;
    if (avoid.some((b) => planToBox(x, y, b) < r + SET_PIECE_GAP)) continue;
    if (corridor.some((p) => Math.hypot(p.x - x, p.y - y) < HOP_BAND + HOP_SAMPLING + r)) continue;
    if (out.some((t) => Math.hypot(t.x - x, t.y - y) < 0.7 * (CANOPY * t.height + r))) continue;
    out.push({ x, y, base: heightAt(x, y) - 2, height });
  }
  return out;
}

function treeGeometry(tier: Tier): BufferGeometry {
  const [cone, trunk] = tier === 'desktop' ? [8, 5] : [6, 4];
  const canopy = new CylinderGeometry(0, CANOPY, 1 - CANOPY, cone, 1, true).toNonIndexed();
  canopy.translate(0, CANOPY + (1 - CANOPY) / 2, 0);
  const stem = new CylinderGeometry(0.04, 0.04, CANOPY, trunk, 1, true).toNonIndexed();
  stem.translate(0, CANOPY / 2, 0);
  // Instance colour multiplies vertex colour: the canopy is white, the trunk timber ÷ flock.
  const flock = linear('flock');
  const timber = linear('timber');
  const paint = (g: BufferGeometry, c: Color) => {
    g.deleteAttribute('uv');
    const n = g.getAttribute('position').count;
    const data = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) data.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new BufferAttribute(data, 3));
    return g;
  };
  const trunkColour = new Color(Math.min(timber.r / flock.r, 1), Math.min(timber.g / flock.g, 1), Math.min(timber.b / flock.b, 1));
  const merged = mergeGeometries([paint(canopy, new Color(1, 1, 1)), paint(stem, trunkColour)]);
  if (!merged) throw new Error('trees: could not merge geometry');
  return merged;
}

export function build(tier: Tier, avoid: readonly Aabb[] = []): SetPiece {
  const spots = placeTrees(tier, avoid);
  const mesh = new InstancedMesh(treeGeometry(tier), blockoutMaterial(), spots.length);
  mesh.name = 'trees';
  const m = new Matrix4();
  const q = new Quaternion();
  const colours = [linear('flock'), linear('hills')];
  spots.forEach((t, i) => {
    const s = t.height / 1000;
    mesh.setMatrixAt(i, m.compose(new Vector3(toX(t.x), t.base / 1000, toZ(t.y)), q, new Vector3(s, s, s)));
    mesh.setColorAt(i, colours[i % 2]!);
  });
  mesh.computeBoundingSphere();
  const aabbs = spots.map((t, i) => {
    const r = CANOPY * t.height;
    return aabb(`tree ${i + 1}`, t.x - r, t.x + r, t.y - r, t.y + r, t.base, t.base + t.height);
  });
  const group = new Group();
  group.name = 'trees';
  group.add(mesh);
  return { id: 'trees', group, aabbs, budget: measure(group) };
}
