import { describe, expect, it } from 'vitest';
import { build } from '../src/world/blockout/railbus';
import { measure } from '../src/world/blockout/kit';
import { PARKED_FRONT, placeTrain } from '../src/world/train';
import { BACK_Y, LEFT_CX, RIGHT_CX, CURVE_CY, R3, STRAIGHT, pointAt } from '../src/world/track/path';
import { fromX, fromZ } from '../src/world/units';
import type { BufferAttribute, Mesh } from 'three';

const verts = (m: Mesh) => {
  const p = m.geometry.getAttribute('position') as BufferAttribute;
  return Array.from({ length: p.count }, (_, i) => ({ x: fromX(p.getX(i)), y: fromZ(p.getZ(i)), h: p.getY(i) * 1000 }));
};

describe('the moving railbus', () => {
  it('parks where it was built and stays one draw', () => {
    const piece = build();
    const mesh = piece.group.children[0] as Mesh;
    const before = Float32Array.from(mesh.geometry.getAttribute('position').array as Float32Array);
    placeTrain(piece.group, PARKED_FRONT);
    const after = mesh.geometry.getAttribute('position').array as Float32Array;
    for (let i = 0; i < before.length; i++) expect(after[i]).toBeCloseTo(before[i]!, 6);
    expect(measure(piece.group).draws).toBe(1);
    expect(PARKED_FRONT).toBe(818.5);
  });

  it('runs along the back straight reversed, and round the curve within the gauge', () => {
    const piece = build();
    const mesh = piece.group.children[0] as Mesh;
    const back = STRAIGHT + Math.PI * R3 + 600;
    placeTrain(piece.group, back);
    const v = verts(mesh);
    const front = pointAt(back).x;
    expect(Math.min(...v.map((p) => p.x))).toBeCloseTo(front, 3);
    expect(Math.max(...v.map((p) => p.x))).toBeCloseTo(front + 309, 3);
    for (const p of v) expect(Math.abs(p.y - BACK_Y)).toBeLessThanOrEqual(16.5 + 1e-3);
    // Half way round the right curve: every corner within the car's chord offset of R3.
    placeTrain(piece.group, STRAIGHT + (Math.PI * R3) / 2 + 150);
    for (const p of verts(mesh)) {
      const r = Math.hypot(p.x - RIGHT_CX, p.y - CURVE_CY);
      expect(Math.abs(r - R3)).toBeLessThanOrEqual(16.5 + 7);
    }
    expect(LEFT_CX).toBeLessThan(RIGHT_CX);
  });
});
