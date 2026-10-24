// The ride (M2 spec §1.2, STYLE §5, CHECKLIST M2-10/M2-13): one lap of the railbus from
// Bootcamp in story order, Bootcamp → Campus → City → Workshop → Bootcamp, and the two
// ride cameras. Pure functions of time and arc length, so the timetable, the chase lag,
// the tunnel ease and the clearances are unit-tested without a renderer.
//
// The timetable: each leg is a trapezoid, 0.054 m/s² up to 0.128 m/s, cruise, and the
// same braking into the next platform. A stop costs exactly 6 s: the time lost to the
// two ramps (v/a ≈ 2.37 s) plus a 3.63 s standstill. So the running time is the lap at
// full speed (≈ 41.65 s) and the whole ride is that plus 4 × 6 s (≈ 65.65 s).
import { PLATFORMS } from '../blockout/platforms';
import { CAR, RAILBUS_X } from '../blockout/railbus';
import { BORE } from '../terrain/heightmap';
import { LAP, LEFT_CX, R3, RIGHT_CX, STRAIGHT, pointAt } from '../track/path';
import { LEVEL, RAIL_TOP, type TablePoint, type Tier } from '../units';
import type { Look } from './orientation';
import { lookAt } from './orientation';
import { LENS, type StationId } from './poses';

export const RIDE = {
  /** Cruise, mm/s (0.128 m/s). */
  speed: 128,
  /** Acceleration and braking, mm/s² (0.054 m/s²). */
  accel: 54,
  /** What each stop costs, ms: the ramps plus the standstill. */
  dwell: 6000,
  /** Chase spring lag, ms (first order along the track). */
  lag: 350,
} as const;

/** The ride's station order around the oval from the parked train on the front straight. */
export const RIDE_ORDER: readonly StationId[] = ['city', 'campus', 'bootcamp', 'workshop'];

/** The railbus, front of the leading car to the back of the trailing one. */
export const TRAIN_LENGTH = 2 * CAR.length + CAR.gap; // 309

const HALF = Math.PI * R3;
const onFront = (x: number): number => x - LEFT_CX;
const onBack = (x: number): number => STRAIGHT + HALF + (RIGHT_CX - x);
const mid = (r: { x0: number; x1: number }) => (r.x0 + r.x1) / 2;

/** Platform centres as arc length on the loop. */
export const STATION_S: Record<StationId, number> = {
  city: onFront(mid(PLATFORMS.city[0])),
  campus: onBack(mid(PLATFORMS.campus[0])),
  bootcamp: onBack(mid(PLATFORMS.bootcamp[0])),
  workshop: onFront(mid(PLATFORMS.workshop[0])),
};

/** The parked train's front sits this far past the City platform centre (1464 − 1310). */
const STOP_AHEAD = RAILBUS_X + TRAIN_LENGTH - mid(PLATFORMS.city[0]);

/** Where the train's front stops at each station: placed on the platform as it is parked at City. */
export const stopFront = (id: StationId): number => STATION_S[id] + STOP_AHEAD;

export interface Leg {
  from: StationId;
  to: StationId;
  /** Unwrapped front arc length at departure and arrival. */
  s0: number;
  s1: number;
  /** ms from the start of the ride. */
  depart: number;
  arrive: number;
  /** End of the standstill (the next departure). */
  leave: number;
}

const RAMP_MS = (RIDE.speed / RIDE.accel) * 1000;
const RAMP_MM = (RIDE.speed * RIDE.speed) / (2 * RIDE.accel);

/** The four legs of the lap, unwrapped from City's stop. */
export const LEGS: readonly Leg[] = (() => {
  const legs: Leg[] = [];
  let s = stopFront('city');
  let t = 0;
  RIDE_ORDER.forEach((from, i) => {
    const to = RIDE_ORDER[(i + 1) % RIDE_ORDER.length]!;
    let d = (stopFront(to) - stopFront(from)) % LAP;
    if (d <= 0) d += LAP;
    const run = (d / RIDE.speed) * 1000 + RAMP_MS;
    const arrive = t + run;
    const leave = arrive + RIDE.dwell - RAMP_MS;
    legs.push({ from, to, s0: s, s1: s + d, depart: t, arrive, leave });
    s += d;
    t = leave;
  });
  return legs;
})();

/** The whole ride, ms (≈ 65 650). */
export const RIDE_MS = LEGS[LEGS.length - 1]!.leave;

export interface TrainState {
  /** Unwrapped arc length of the leading car's front. */
  s: number;
  /** Speed, mm/s. */
  v: number;
  /** Index into LEGS. */
  leg: number;
  phase: 'accelerate' | 'cruise' | 'brake' | 'stopped' | 'done';
  /** The station the train stands at, when stopped. */
  at: StationId | null;
}

/** The train at `t` ms into the ride. */
export function trainAt(t: number): TrainState {
  if (t >= RIDE_MS) return { s: LEGS[3]!.s1, v: 0, leg: 3, phase: 'done', at: 'city' };
  const tt = Math.max(t, 0);
  const leg = Math.max(
    0,
    LEGS.findIndex((l) => tt < l.leave),
  );
  const l = LEGS[leg]!;
  if (tt >= l.arrive) return { s: l.s1, v: 0, leg, phase: 'stopped', at: l.to };
  const tau = (tt - l.depart) / 1000;
  const run = (l.arrive - l.depart) / 1000;
  const a = RIDE.accel;
  const v = RIDE.speed;
  const ramp = RAMP_MS / 1000;
  if (tau < ramp) return { s: l.s0 + 0.5 * a * tau * tau, v: a * tau, leg, phase: 'accelerate', at: null };
  if (tau < run - ramp) return { s: l.s0 + RAMP_MM + v * (tau - ramp), v, leg, phase: 'cruise', at: null };
  const left = run - tau;
  return { s: l.s1 - 0.5 * a * left * left, v: a * left, leg, phase: 'brake', at: null };
}

/**
 * The chase camera per tier (STYLE §5 camera table). Distances in mm. The phone chase rides
 * at 71 mm, not the table's 80, so it passes ≥ 21 mm under the paper plane's lowest path
 * (TECH-PLAN; 22 mm with this height).
 */
export const CHASE = {
  desktop: { vFov: LENS.mm50, behind: 180, up: 70 },
  phone: { vFov: LENS.mm35, behind: 200, up: 71 },
} as const satisfies Record<Tier, { vFov: number; behind: number; up: number }>;
/**
 * The chase aims at the middle of the train, 25 mm above rail (mid-body). Aiming ahead of
 * the cab swings the train out of a portrait frame on the R3 curves (24° off axis against
 * a 9° half-width at 390); the middle keeps both ends within 9°.
 */
export const CHASE_AIM = { back: TRAIN_LENGTH / 2, up: 25 } as const;
/** The chase near and far planes, mm (0.003 / 5 m). */
export const RIDE_CLIP = { near: 3, far: 5000 } as const;

/**
 * The cab view: 28 mm lens, at the front-car cab end, 33 mm above rail, 3° down. The
 * grey-box car is a closed box drawn from both sides, so the eye sits 2 mm ahead of the
 * nose (behind the near plane's reach of the front face) rather than inside the shell.
 */
export const CAB = { vFov: LENS.mm28, up: 33, ahead: 2, pitch: -3, drag: 25 } as const;

/**
 * The low run (C12): through the tunnel and on through the City shed just west of it,
 * the chase holds 45 mm above rail on the centreline, easing down over the 0.20 m before
 * the low run and back up over the 0.20 m after it.
 */
export const LOW = {
  up: 45,
  ease: 200,
  /** Arc length range of the low run on the back straight (east portal → west end of the shed). */
  s0: onBack(BORE.x1),
  s1: onBack(PLATFORMS.bootcamp[0].x0),
} as const;

const smooth = (k: number) => {
  const c = Math.min(Math.max(k, 0), 1);
  return c * c * (3 - 2 * c);
};
const wrap = (s: number) => ((s % LAP) + LAP) % LAP;

/** Height above rail of the chase camera at arc length s. */
export function chaseUp(s: number, tier: Tier): number {
  const w = wrap(s);
  const outside = w < LOW.s0 ? LOW.s0 - w : w > LOW.s1 ? w - LOW.s1 : 0;
  return LOW.up + (CHASE[tier].up - LOW.up) * smooth(outside / LOW.ease);
}

/** Where the chase spring pulls the camera: behind the back of the trailing car. */
export const chaseGoal = (front: number, tier: Tier): number => front - TRAIN_LENGTH - CHASE[tier].behind;

/** One step of the chase spring: first order with time constant RIDE.lag. */
export const follow = (s: number, goal: number, dt: number): number => goal + (s - goal) * Math.exp(-dt / RIDE.lag);

export interface RideView {
  position: TablePoint;
  look: Look;
  vFov: number;
}

/** The chase view with the camera at arc length `cam` and the train's front at `front`. */
export function chaseView(cam: number, front: number, tier: Tier): RideView {
  const p = pointAt(cam);
  const position = { x: p.x, y: p.y, h: RAIL_TOP + chaseUp(cam, tier) };
  const q = pointAt(front - CHASE_AIM.back);
  return { position, look: lookAt(position, { x: q.x, y: q.y, h: RAIL_TOP + CHASE_AIM.up }), vFov: CHASE[tier].vFov };
}

/** The cab view at the nose; `yaw` is the drag offset, clamped to ±25°. */
export function cabView(front: number, yaw = 0): RideView {
  const p = pointAt(front + CAB.ahead);
  const drag = Math.min(Math.max(yaw, -CAB.drag), CAB.drag);
  const heading = (Math.atan2(p.tx, p.ty) * 180) / Math.PI;
  return { position: { x: p.x, y: p.y, h: RAIL_TOP + CAB.up }, look: { yaw: heading + drag, pitch: CAB.pitch }, vFov: CAB.vFov };
}

/** The stretch inside the bore, where the clearance rule gives way to the C12 exemption. */
export function inBore(p: TablePoint): boolean {
  return p.x >= BORE.x0 && p.x <= BORE.x1 && p.y >= BORE.y0 && p.y <= BORE.y1 && p.h <= LEVEL.portalOpeningTop;
}
