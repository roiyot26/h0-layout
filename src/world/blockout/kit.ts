// Builders shared by the blockout modules: table-mm boxes, prisms, cylinders and swept
// ribbons, merged per set piece into one vertex-coloured mesh, plus the AABB registry
// entries (M2 spec §3.4) for each solid part.
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { type Aabb, aabb } from '../terrain/clearance';
import type { PathPoint } from '../track/path';
import { toX, toZ } from '../units';
import { type Token, blockoutMaterial, linear } from './palette';

export type SetPieceId =
  | 'terrain'
  | 'hill'
  | 'track'
  | 'station_bootcamp'
  | 'station_campus'
  | 'station_city'
  | 'station_workshop'
  | 'water_bridge'
  | 'crossing'
  | 'trees'
  | 'railbus';

export interface Budget {
  tris: number;
  draws: number;
}

/** The blockout contract (M2 spec §4.3). */
export interface SetPiece {
  id: SetPieceId;
  group: Group;
  aabbs: Aabb[];
  budget: Budget;
}

type Colour = Token | number;

/** Paint every vertex one colour, drop uvs and return a non-indexed copy. */
function paint(geom: BufferGeometry, colour: Colour): BufferGeometry {
  const g = geom.index ? geom.toNonIndexed() : geom;
  g.deleteAttribute('uv');
  const c = linear(colour);
  const n = g.getAttribute('position').count;
  const data = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) data.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new BufferAttribute(data, 3));
  return g;
}

export class PieceBuilder {
  private parts: BufferGeometry[] = [];
  readonly aabbs: Aabb[] = [];
  private extra: Object3D[] = [];

  /** Add a three-space geometry in one colour. */
  add(geom: BufferGeometry, colour: Colour): this {
    this.parts.push(paint(geom, colour));
    return this;
  }

  /** Add a geometry that already has per-vertex colours (non-indexed, no uv). */
  addColoured(geom: BufferGeometry): this {
    this.parts.push(geom);
    return this;
  }

  /** Register a solid for the clearance field. */
  solid(name: string, x0: number, x1: number, y0: number, y1: number, h0: number, h1: number): this {
    this.aabbs.push(aabb(name, x0, x1, y0, y1, h0, h1));
    return this;
  }

  /** An axis-aligned box in table mm. name: null skips the AABB registry. */
  box(name: string | null, x0: number, x1: number, y0: number, y1: number, h0: number, h1: number, colour: Colour): this {
    const g = new BoxGeometry((x1 - x0) / 1000, (h1 - h0) / 1000, (y1 - y0) / 1000);
    g.translate(toX((x0 + x1) / 2), (h0 + h1) / 2000, toZ((y0 + y1) / 2));
    if (name) this.solid(name, x0, x1, y0, y1, h0, h1);
    return this.add(g, colour);
  }

  /** A box centred on (cx, cy), `length` along plan angle `angle` (rad), `width` across it. */
  orientedBox(
    name: string | null,
    cx: number,
    cy: number,
    length: number,
    width: number,
    h0: number,
    h1: number,
    angle: number,
    colour: Colour,
  ): this {
    const g = new BoxGeometry(length / 1000, (h1 - h0) / 1000, width / 1000);
    g.rotateY(angle);
    g.translate(toX(cx), (h0 + h1) / 2000, toZ(cy));
    if (name) this.solidOriented(name, cx, cy, length, width, h0, h1, angle);
    return this.add(g, colour);
  }

  /** A triangular prism roof (3-segment cylinder), ridge along plan angle `angle`. */
  prism(
    name: string | null,
    cx: number,
    cy: number,
    length: number,
    width: number,
    h0: number,
    h1: number,
    angle: number,
    colour: Colour,
  ): this {
    const height = h1 - h0;
    const g = new CylinderGeometry(1, 1, 1, 3);
    g.rotateX(-Math.PI / 2); // apex up, axis along Z, base at −0.5
    g.scale(width / 1000 / Math.sqrt(3), height / 1000 / 1.5, length / 1000);
    g.rotateY(Math.PI / 2 + angle);
    g.translate(toX(cx), (h0 + height / 3) / 1000, toZ(cy));
    const flat = g.toNonIndexed();
    flat.computeVertexNormals();
    if (name) this.solidOriented(name, cx, cy, length, width, h0, h1, angle);
    return this.add(flat, colour);
  }

  /** A vertical cylinder at (cx, cy). */
  cylinder(name: string | null, cx: number, cy: number, r: number, h0: number, h1: number, segments: number, colour: Colour): this {
    const g = new CylinderGeometry(r / 1000, r / 1000, (h1 - h0) / 1000, segments);
    g.translate(toX(cx), (h0 + h1) / 2000, toZ(cy));
    if (name) this.solid(name, cx - r, cx + r, cy - r, cy + r, h0, h1);
    return this.add(g, colour);
  }

  /** Sweep an open cross-section [across mm (left +), h mm] along a run of path points. */
  ribbon(run: readonly PathPoint[], profile: readonly (readonly [number, number])[], colour: Colour): this {
    const pos: number[] = [];
    const at = (p: PathPoint, [a, h]: readonly [number, number]) => [toX(p.x - p.ty * a), h / 1000, toZ(p.y + p.tx * a)];
    for (let i = 0; i < run.length - 1; i++) {
      for (let j = 0; j < profile.length - 1; j++) {
        const a = at(run[i]!, profile[j]!);
        const b = at(run[i]!, profile[j + 1]!);
        const c = at(run[i + 1]!, profile[j + 1]!);
        const d = at(run[i + 1]!, profile[j]!);
        pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.computeVertexNormals();
    return this.add(g, colour);
  }

  /** Add an extra object (an InstancedMesh) to the piece's group. */
  object(o: Object3D): this {
    this.extra.push(o);
    return this;
  }

  private solidOriented(name: string, cx: number, cy: number, length: number, width: number, h0: number, h1: number, angle: number) {
    const ex = (Math.abs(Math.cos(angle)) * length + Math.abs(Math.sin(angle)) * width) / 2;
    const ey = (Math.abs(Math.sin(angle)) * length + Math.abs(Math.cos(angle)) * width) / 2;
    this.solid(name, cx - ex, cx + ex, cy - ey, cy + ey, h0, h1);
  }

  /** Merge the parts into one mesh and return the set piece. */
  build(id: SetPieceId): SetPiece {
    const group = new Group();
    group.name = id;
    if (this.parts.length) {
      const merged = mergeGeometries(this.parts);
      if (!merged) throw new Error(`${id}: could not merge geometry`);
      const mesh = new Mesh(merged, blockoutMaterial());
      mesh.name = `${id}_blockout`;
      group.add(mesh);
    }
    for (const o of this.extra) group.add(o);
    return { id, group, aabbs: this.aabbs, budget: measure(group) };
  }
}

/** Triangles and draw calls the group costs per frame (one draw per mesh). */
export function measure(root: Object3D): Budget {
  let tris = 0;
  let draws = 0;
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const g = o.geometry as BufferGeometry;
    const count = g.index ? g.index.count : g.getAttribute('position').count;
    tris += (count / 3) * (o instanceof InstancedMesh ? o.count : 1);
    draws += 1;
  });
  return { tris, draws };
}
