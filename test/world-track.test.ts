import { describe, expect, it } from 'vitest';
import {
  BUFFER,
  CURVE_CY,
  LAP,
  LEFT_CX,
  LOOP,
  R2,
  R3,
  RIGHT_CX,
  SIDING_ARC,
  SIDING_LENGTH,
  TURNOUT_X,
  distanceToLoop,
  distanceToSiding,
  pointAt,
  sidingAt,
} from '../src/world/track/path';
import { fromThree, toThree, toX, toZ } from '../src/world/units';

const sOnFront = (x: number) => x - LEFT_CX;
const sOnBack = (x: number) => LOOP[2]!.s0 + (RIGHT_CX - x);

describe('units', () => {
  it('maps the table frame onto three metres (M2 spec §0)', () => {
    expect(toThree({ x: 1200, y: 600, h: 0 })).toEqual([0, 0, 0]);
    expect(toThree({ x: 1200, y: -1307, h: 1250 }).map((v) => +v.toFixed(3))).toEqual([0, 1.25, 1.907]);
    expect(toX(0)).toBe(-1.2);
    expect(toZ(1200)).toBe(-0.6);
    const back = fromThree(0.195, 0.2413, 0.0932);
    expect(back.x).toBeCloseTo(1395, 6);
    expect(back.y).toBeCloseTo(506.8, 6);
    expect(back.h).toBeCloseTo(241.3, 6);
  });
});

describe('track centre line (STYLE §1)', () => {
  it('has a lap of 5331.4 mm within 1% (TECH-PLAN M2 exit)', () => {
    expect(Math.abs(LAP - 5331.4) / 5331.4).toBeLessThan(0.01);
    expect(LAP).toBeCloseTo(5331.3, 0);
  });

  it('holds R3 on both curves within ±0.5 mm', () => {
    for (let i = 0; i <= 200; i++) {
      for (const seg of [LOOP[1]!, LOOP[3]!]) {
        const p = pointAt(seg.s0 + (seg.length * i) / 200);
        const cx = seg === LOOP[1] ? RIGHT_CX : LEFT_CX;
        expect(Math.abs(Math.hypot(p.x - cx, p.y - CURVE_CY) - R3)).toBeLessThan(0.5);
      }
    }
  });

  it('holds R2 on the turnout within ±0.5 mm', () => {
    for (let i = 0; i <= 100; i++) {
      const p = sidingAt((SIDING_ARC * i) / 100);
      expect(Math.abs(Math.hypot(p.x - TURNOUT_X, p.y - 542) - R2)).toBeLessThan(0.5);
    }
  });

  it('is continuous with unit tangents', () => {
    let prev = pointAt(0);
    for (let i = 1; i <= 20000; i++) {
      const p = pointAt((LAP * i) / 20000);
      expect(Math.hypot(p.x - prev.x, p.y - prev.y)).toBeLessThan((LAP / 20000) * 1.0001);
      expect(Math.hypot(p.tx, p.ty)).toBeCloseTo(1, 9);
      prev = p;
    }
    const end = pointAt(LAP);
    expect(end.x).toBeCloseTo(LEFT_CX, 6);
  });

  it('sums the STYLE §1 legs to the lap', () => {
    const stations = [sOnFront(1310), sOnBack(1390), sOnBack(830), sOnFront(860)];
    const legs = stations.map((s, i) => {
      const next = stations[(i + 1) % stations.length]!;
      return (next - s + LAP) % LAP;
    });
    expect(legs[0]).toBeCloseTo(2365.7, 0); // City → Campus
    expect(legs[1]).toBeCloseTo(560, 0); // Campus → Bootcamp
    expect(legs.reduce((a, b) => a + b, 0)).toBeCloseTo(LAP, 6);
  });

  it('ends the siding at the buffer stop (STYLE §1)', () => {
    const arcEnd = sidingAt(SIDING_ARC);
    expect(arcEnd.x).toBeCloseTo(778.8, 0);
    expect(arcEnd.y).toBeCloseTo(206.9, 0);
    expect(BUFFER.x).toBeCloseTo(663.9, 0);
    expect(BUFFER.y).toBeCloseTo(303.3, 0);
    expect(SIDING_LENGTH).toBeCloseTo(455.4, 0);
  });

  it('measures plan distance to the centre lines', () => {
    expect(distanceToLoop(1000, 104.5)).toBe(0);
    expect(distanceToLoop(1000, 120)).toBeCloseTo(15.5, 9);
    expect(distanceToLoop(LEFT_CX - R3, CURVE_CY)).toBeCloseTo(0, 9);
    expect(distanceToLoop(1200, 600)).toBeCloseTo(495.5, 6);
    expect(distanceToSiding(sidingAt(200).x, sidingAt(200).y)).toBeCloseTo(0, 6);
    expect(distanceToSiding(BUFFER.x, BUFFER.y)).toBeCloseTo(0, 6);
  });
});
