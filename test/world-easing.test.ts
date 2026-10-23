import { describe, expect, it } from 'vitest';
import { CURVES, DURATION, SETTLE_MAX, cubicBezier, easeFly, fadeOut, trapezoid } from '../src/world/camera/easing';

describe('easing constants (M2 spec §6 F17)', () => {
  it('matches the F17 curve table', () => {
    expect(CURVES).toEqual({
      fly: [0.65, 0, 0.35, 1],
      label: [0, 0, 0.58, 1],
      boardSlide: [0.22, 1, 0.36, 1],
      sheet: [0.2, 0, 0, 1],
      sky: [0.37, 0, 0.63, 1],
    });
  });

  it('matches the F17 durations', () => {
    expect(DURATION.fly).toBe(1000);
    expect([DURATION.crossfade, DURATION.crossfadeReduced]).toEqual([300, 200]);
    expect([DURATION.tierSwap, DURATION.tierSwapReduced]).toEqual([300, 200]);
    expect([DURATION.label, DURATION.dof, DURATION.sheet]).toEqual([150, 250, 280]);
    expect(DURATION.unorbitRamp).toBe(200);
    expect(DURATION.orbitSettle).toBe(400);
    expect(SETTLE_MAX).toBe(1300);
  });

  it('solves cubic-bezier like CSS does', () => {
    expect(easeFly(0)).toBe(0);
    expect(easeFly(1)).toBe(1);
    expect(easeFly(0.5)).toBeCloseTo(0.5, 6);
    // Symmetric curve: e(t) + e(1 − t) = 1.
    for (const t of [0.1, 0.25, 0.4]) expect(easeFly(t) + easeFly(1 - t)).toBeCloseTo(1, 6);
    // CSS ease-out at t = 0.5 is about 0.685 (solved independently).
    expect(cubicBezier(CURVES.label)(0.5)).toBeCloseTo(0.6846, 3);
    const linear = cubicBezier([0, 0, 1, 1]);
    for (const t of [0.2, 0.7]) expect(linear(t)).toBeCloseTo(t, 6);
  });

  it('fades linearly and clamps', () => {
    expect([fadeOut(0, 300), fadeOut(150, 300), fadeOut(300, 300), fadeOut(400, 300)]).toEqual([1, 0.5, 0, 0]);
  });

  it('runs the un-orbit trapezoid with a 1 / 0.8 s peak rate', () => {
    expect(trapezoid(0, 1000, 200)).toBe(0);
    expect(trapezoid(1000, 1000, 200)).toBe(1);
    expect(trapezoid(500, 1000, 200)).toBeCloseTo(0.5, 9);
    expect(trapezoid(200, 1000, 200)).toBeCloseTo(0.125, 9);
    const dt = 0.01;
    let peak = 0;
    for (let t = 0; t < 1000; t += dt * 100) peak = Math.max(peak, (trapezoid(t + 1, 1000, 200) - trapezoid(t, 1000, 200)) * 1000);
    expect(peak).toBeCloseTo(1.25, 2);
  });
});
