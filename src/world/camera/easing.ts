// Motion constants (M2 spec §1.4 and §6 F17; STYLE §5, CHECKLIST B3). One table holds
// every curve and duration the rig uses, so a unit test can hold it to the spec and the
// trace fits can read the same numbers. Later milestones' curves are listed so they
// inherit the same table; only the fly, crossfades, labels and DOF are used in M2.

export type Bezier = readonly [number, number, number, number];

export const CURVES = {
  /** Same-straight fly, translation (arc-length progress on the back pair). */
  fly: [0.65, 0, 0.35, 1],
  /** CSS ease-out, the label fade-in. */
  label: [0, 0, 0.58, 1],
  /** M3: the board slide. */
  boardSlide: [0.22, 1, 0.36, 1],
  /** M5: the phone sheet and its view offset. */
  sheet: [0.2, 0, 0, 1],
  /** M6: evening and sky. */
  sky: [0.37, 0, 0.63, 1],
} as const satisfies Record<string, Bezier>;

/** Durations in ms. Crossfades are linear in opacity. */
export const DURATION = {
  fly: 1000,
  crossfade: 300,
  crossfadeReduced: 200,
  tierSwap: 300,
  tierSwapReduced: 200,
  label: 150,
  dof: 250,
  sheet: 280,
  /** Un-orbit ramps (§2.4): 0.2 s up and 0.2 s down inside the 1.0 s fly. */
  unorbitRamp: 200,
  /** Orbit damping settles inside this (CHECKLIST M2-12). */
  orbitSettle: 400,
} as const;

/** Settle budget after an ease hop (STYLE §5, CHECKLIST M2-05). */
export const SETTLE_MAX = 1300;

/** A CSS cubic-bezier as a function of time fraction t in [0, 1], solved by bisection on x. */
export function cubicBezier([x1, y1, x2, y2]: Bezier): (t: number) => number {
  const bez = (a: number, b: number, s: number) => 3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s * s * b + s ** 3;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (bez(x1, x2, mid) < t) lo = mid;
      else hi = mid;
    }
    return bez(y1, y2, (lo + hi) / 2);
  };
}

export const easeFly = cubicBezier(CURVES.fly);

/** Linear opacity of the outgoing frame over a crossfade of `ms`. */
export const fadeOut = (elapsed: number, ms: number): number => Math.min(Math.max(1 - elapsed / ms, 0), 1);

/**
 * Trapezoidal progress (§2.4): constant acceleration for `ramp`, cruise, constant
 * deceleration for `ramp`, over `total`. Returns 0 → 1; the peak rate is 1 / (total − ramp).
 */
export function trapezoid(t: number, total: number, ramp: number): number {
  if (t <= 0) return 0;
  if (t >= total) return 1;
  const v = 1 / (total - ramp);
  if (t < ramp) return (v * t * t) / (2 * ramp);
  if (t <= total - ramp) return v * (t - ramp / 2);
  const r = total - t;
  return 1 - (v * r * r) / (2 * ramp);
}
