import { describe, expect, it } from 'vitest';
import { buildPieces } from '../src/world/blockout';
import { RAILBUS_X } from '../src/world/blockout/railbus';
import { angleBetween } from '../src/world/camera/orientation';
import {
  CAB,
  CHASE,
  LEGS,
  LOW,
  RIDE,
  RIDE_MS,
  RIDE_ORDER,
  type RideView,
  TRAIN_LENGTH,
  cabView,
  chaseGoal,
  chaseUp,
  chaseView,
  follow,
  inBore,
  stopFront,
  trainAt,
} from '../src/world/camera/ride';
import { clearance, MIN_CLEARANCE } from '../src/world/terrain/clearance';
import { BORE } from '../src/world/terrain/heightmap';
import { LAP, LEFT_CX, BACK_Y, pointAt } from '../src/world/track/path';
import { PLANE_HEAVE, planeHeight } from '../src/world/track/plane';
import { RAIL_TOP, type Tier } from '../src/world/units';

const DT = 1000 / 60;

/** The whole ride at 60 Hz: train, chase spring and both views. */
function simulate(tier: Tier) {
  const out: { t: number; front: number; v: number; cam: number; chase: RideView; cab: RideView }[] = [];
  let cam = chaseGoal(trainAt(0).s, tier);
  for (let t = 0; t <= RIDE_MS + 500; t += DT) {
    const tr = trainAt(t);
    cam = follow(cam, chaseGoal(tr.s, tier), DT);
    out.push({ t, front: tr.s, v: tr.v, cam, chase: chaseView(cam, tr.s, tier), cab: cabView(tr.s) });
  }
  return out;
}

describe('ride timetable (M2-10)', () => {
  it('starts from the parked train and runs one lap in story order', () => {
    expect(RIDE_ORDER).toEqual(['bootcamp', 'campus', 'city', 'workshop']);
    expect(trainAt(0).s).toBeCloseTo(RAILBUS_X + TRAIN_LENGTH - LEFT_CX, 6);
    expect(LEGS.map((l) => Math.round((l.s1 - l.s0) * 10) / 10)).toEqual([2365.7, 560, 1955.7, 450]);
    expect(LEGS[3]!.s1 - LEGS[0]!.s0).toBeCloseTo(LAP, 6);
    expect(trainAt(RIDE_MS).phase).toBe('done');
    for (const l of LEGS) expect(trainAt(l.arrive + 1).s % LAP).toBeCloseTo(stopFront(l.to) % LAP, 6);
  });

  it('cruises at 0.128 m/s and brakes at 0.054 m/s²', () => {
    let maxA = 0;
    let prev = trainAt(0);
    for (let t = DT; t < RIDE_MS; t += DT) {
      const tr = trainAt(t);
      if (tr.phase === 'cruise') expect(Math.abs((tr.s - prev.s) / (DT / 1000) - 128)).toBeLessThanOrEqual(0.5);
      maxA = Math.max(maxA, Math.abs(tr.v - prev.v) / (DT / 1000));
      expect(tr.s).toBeGreaterThanOrEqual(prev.s);
      prev = tr;
    }
    expect(maxA).toBeLessThanOrEqual(RIDE.accel + 0.01);
    expect(Math.abs(RIDE.speed - 128)).toBeLessThanOrEqual(5);
  });

  it('runs the lap in 41.7 ± 1.5 s plus 4 × 6 s of stops', () => {
    const running = RIDE_MS - 4 * RIDE.dwell;
    expect(Math.abs(running / 1000 - 41.7)).toBeLessThanOrEqual(1.5);
    for (const [i, l] of LEGS.entries()) {
      const next = LEGS[i + 1]?.depart ?? RIDE_MS;
      // Each stop costs 6 s against running through at full speed.
      const atSpeed = ((l.s1 - l.s0) / RIDE.speed) * 1000;
      expect(next - l.depart - atSpeed).toBeCloseTo(RIDE.dwell, 6);
      expect(trainAt((l.arrive + l.leave) / 2)).toMatchObject({ v: 0, phase: 'stopped', at: l.to });
    }
    expect(RIDE_MS / 1000).toBeCloseTo(LAP / 128 + 24, 6);
  });
});

describe('ride cameras', () => {
  for (const tier of ['desktop', 'phone'] as const) {
    const run = simulate(tier);

    it(`${tier}: the chase trails by v·τ (spring lag 0.35 s) at cruise`, () => {
      const c = run.filter((f) => trainAt(f.t).phase === 'cruise' && f.t - LEGS[trainAt(f.t).leg]!.depart > 5000);
      expect(c.length).toBeGreaterThan(100);
      // A 60 Hz step reads the lag just after the spring moves: v·τ less half a frame of travel.
      for (const f of c) expect(Math.abs(chaseGoal(f.front, tier) - f.cam - RIDE.speed * (RIDE.lag / 1000))).toBeLessThanOrEqual((RIDE.speed * DT) / 1000);
      expect(chaseGoal(run[0]!.front, tier)).toBeCloseTo(run[0]!.front - 309 - CHASE[tier].behind, 6);
    });

    it(`${tier}: neither view turns faster than 45°/s`, () => {
      for (const k of ['chase', 'cab'] as const) {
        let peak = 0;
        for (let i = 1; i < run.length; i++) peak = Math.max(peak, angleBetween(run[i - 1]![k].look, run[i]![k].look) / (DT / 1000));
        expect(peak, k).toBeLessThanOrEqual(45);
        if (k === 'cab') expect(peak).toBeCloseTo(((RIDE.speed / 495.5) * 180) / Math.PI, 0); // ≈ 15°/s on R3
      }
    });

    it(`${tier}: the chase eases to 45 mm above rail through the tunnel and shed (C12)`, () => {
      for (let x = BORE.x0; x <= BORE.x1; x += 5) {
        const s = LOW.s0 + (BORE.x1 - x);
        expect(chaseUp(s, tier)).toBeCloseTo(45, 6);
      }
      expect(chaseUp(LOW.s0 - 200, tier)).toBeCloseTo(CHASE[tier].up, 6);
      expect(chaseUp(LOW.s1 + 200, tier)).toBeCloseTo(CHASE[tier].up, 6);
      expect(chaseUp(100, tier)).toBe(CHASE[tier].up);
    });

    it(`${tier}: the whole train stays inside a 390-portrait frame, ≤ 9° off the chase axis`, () => {
      // 390×844 at 37.8° vFOV is 9.0° each side of the axis; the 1440 frame is 21°.
      let worst = 0;
      for (const f of run) {
        const v = f.chase;
        for (const off of [0, TRAIN_LENGTH / 2, TRAIN_LENGTH]) {
          const p = pointAt(f.front - off);
          const a = (Math.atan2(p.x - v.position.x, p.y - v.position.y) * 180) / Math.PI - v.look.yaw;
          worst = Math.max(worst, Math.abs(((a + 540) % 360) - 180));
        }
      }
      expect(worst).toBeLessThanOrEqual(9);
    });

    it(`${tier}: the chase clears every box by ≥ 12 mm, and keeps the bore exemption inside`, () => {
      const boxes = buildPieces(tier)
        .filter((p) => p.id !== 'railbus')
        .flatMap((p) => p.aabbs);
      let worst = Infinity;
      for (const f of run.filter((_, i) => i % 3 === 0)) {
        const p = f.chase.position;
        if (inBore(p)) {
          expect(Math.abs(p.y - BACK_Y)).toBeLessThanOrEqual(13);
          expect(p.h - RAIL_TOP).toBeGreaterThanOrEqual(12);
          expect(p.h - RAIL_TOP).toBeLessThanOrEqual(51);
          continue;
        }
        const c = clearance(p, boxes);
        worst = Math.min(worst, c);
        expect(c, `at ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.h.toFixed(1)}`).toBeGreaterThanOrEqual(MIN_CLEARANCE);
      }
      expect(worst).toBeLessThan(Infinity);
    });

    it(`${tier}: the cab clears every box but the railbus by ≥ 12 mm, and the bore exemption inside`, () => {
      const boxes = buildPieces(tier)
        .filter((p) => p.id !== 'railbus')
        .flatMap((p) => p.aabbs);
      for (const f of run.filter((_, i) => i % 3 === 0)) {
        const p = f.cab.position;
        if (inBore(p)) {
          expect(Math.abs(p.y - BACK_Y)).toBeLessThanOrEqual(13);
          continue;
        }
        expect(clearance(p, boxes), `at ${p.x.toFixed(0)}, ${p.y.toFixed(0)}`).toBeGreaterThanOrEqual(MIN_CLEARANCE);
      }
    });

    it(`${tier}: the cab sits just ahead of the nose, 33 mm above rail, 3° down`, () => {
      const v = cabView(1000);
      const p = pointAt(1000 + CAB.ahead);
      expect(v.position).toEqual({ x: p.x, y: p.y, h: RAIL_TOP + 33 });
      expect(v.look.pitch).toBe(-3);
      expect(v.vFov).toBe(46.4);
      expect(cabView(1000, 90).look.yaw - cabView(1000).look.yaw).toBe(25);
    });
  }

  it('desktop: the chase passes under the paper plane path with ≥ 21 mm', () => {
    let gap = Infinity;
    for (let s = 0; s < LAP; s += 2) gap = Math.min(gap, planeHeight(s) - PLANE_HEAVE - chaseUp(s, 'desktop'));
    console.log(`[ride] desktop: chase to paper plane gap ${gap.toFixed(1)} mm (min 21)`);
    expect(gap).toBeGreaterThanOrEqual(21);
  });

  it('phone: the chase passes under the paper plane path with ≥ 21 mm', () => {
    let gap = Infinity;
    for (let s = 0; s < LAP; s += 2) gap = Math.min(gap, planeHeight(s) - PLANE_HEAVE - chaseUp(s, 'phone'));
    console.log(`[ride] phone: chase to paper plane gap ${gap.toFixed(1)} mm (min 21)`);
    expect(gap).toBeGreaterThanOrEqual(21);
  });
});
