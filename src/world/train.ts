// Moves the railbus along the loop (M2 spec §1.2, the ride). The set piece stays one
// merged mesh (one draw): each frame its vertices are placed from the parked copy, each
// car rigid, its front on the track at its arc length and its back on the chord to the
// track 153 mm behind.
import { type BufferAttribute, DynamicDrawUsage, type Group, Mesh } from 'three';
import { CAR, RAILBUS_X } from './blockout/railbus';
import { TRAIN_LENGTH } from './camera/ride';
import { FRONT_Y, LEFT_CX, pointAt } from './track/path';
import { fromX, fromZ, toX, toZ } from './units';

/** Front arc length of the parked train (Bootcamp). */
export const PARKED_FRONT = RAILBUS_X + TRAIN_LENGTH - LEFT_CX;

interface Rest {
  position: Float32Array;
  normal: Float32Array;
  /** Per vertex: 0 for the leading car, 1 for the trailing one. */
  car: Uint8Array;
}

const rests = new WeakMap<Mesh, Rest>();

function meshOf(group: Group): Mesh | null {
  const m = group.children.find((o) => o instanceof Mesh);
  return m instanceof Mesh ? m : null;
}

function rest(mesh: Mesh): Rest {
  let r = rests.get(mesh);
  if (r) return r;
  const pos = mesh.geometry.getAttribute('position') as BufferAttribute;
  const nor = mesh.geometry.getAttribute('normal') as BufferAttribute;
  const car = new Uint8Array(pos.count);
  // The trailing car ends at RAILBUS_X + 153; the leading one starts 3 mm after it.
  const split = RAILBUS_X + CAR.length + CAR.gap / 2;
  for (let i = 0; i < pos.count; i++) car[i] = fromX(pos.getX(i)) > split ? 0 : 1;
  r = { position: Float32Array.from(pos.array as Float32Array), normal: Float32Array.from(nor.array as Float32Array), car };
  rests.set(mesh, r);
  pos.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  return r;
}

/** Places the railbus with its leading front at arc length `front` (PARKED_FRONT parks it). */
export function placeTrain(group: Group, front: number): void {
  const mesh = meshOf(group);
  if (!mesh) return;
  const r = rest(mesh);
  const pos = mesh.geometry.getAttribute('position') as BufferAttribute;
  const nor = mesh.geometry.getAttribute('normal') as BufferAttribute;
  const cars = [0, 1].map((k) => {
    const s = front - k * (CAR.length + CAR.gap);
    const p = pointAt(s);
    const q = pointAt(s - CAR.length);
    const len = Math.hypot(p.x - q.x, p.y - q.y) || 1;
    const dx = (p.x - q.x) / len;
    const dy = (p.y - q.y) / len;
    // Parked, this car's front is at x = restFront, heading +x.
    const restFront = RAILBUS_X + TRAIN_LENGTH - k * (CAR.length + CAR.gap);
    return { px: p.x, py: p.y, dx, dy, restFront };
  });
  const P = pos.array as Float32Array;
  const N = nor.array as Float32Array;
  for (let i = 0; i < pos.count; i++) {
    const c = cars[r.car[i]!]!;
    const j = i * 3;
    const u = fromX(r.position[j]!) - c.restFront;
    const w = fromZ(r.position[j + 2]!) - FRONT_Y;
    // Along the car (d) and across it (n = d turned +90° in plan).
    P[j] = toX(c.px + c.dx * u - c.dy * w);
    P[j + 1] = r.position[j + 1]!;
    P[j + 2] = toZ(c.py + c.dy * u + c.dx * w);
    const nx = r.normal[j]!;
    const ny = -r.normal[j + 2]!; // table y is −three z
    N[j] = c.dx * nx - c.dy * ny;
    N[j + 1] = r.normal[j + 1]!;
    N[j + 2] = -(c.dy * nx + c.dx * ny);
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
}
