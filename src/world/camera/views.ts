// Destinations and the hop-type table (M2 spec §1.4, §6 F20a). Same-straight neighbours
// fly; every other hop, the overview included, is a crossfade.
import type { Tier } from '../units';
import { OVERVIEW, type Pose, STATION_POSES, type StationId } from './poses';

export type Dest = 'overview' | StationId;

/** Story order (TECH-PLAN §2): Next / Previous and the arrow keys walk it as a loop. */
export const STORY: readonly StationId[] = ['bootcamp', 'campus', 'city', 'workshop'];

export type HopType = 'fly' | 'crossfade';

/** The same-straight neighbour pairs: Workshop ↔ City (front), Campus ↔ Bootcamp (back). */
export const FLY_PAIRS: readonly (readonly [StationId, StationId])[] = [
  ['workshop', 'city'],
  ['campus', 'bootcamp'],
];

export function hopType(from: Dest, to: Dest): HopType {
  const fly = FLY_PAIRS.some(([a, b]) => (from === a && to === b) || (from === b && to === a));
  return fly ? 'fly' : 'crossfade';
}

export const poseFor = (tier: Tier, dest: Dest): Pose => (dest === 'overview' ? OVERVIEW[tier] : STATION_POSES[tier][dest]);

/** The next or previous station in story order; from the overview, Next is Bootcamp. */
export function step(from: Dest, dir: 1 | -1): StationId {
  if (from === 'overview') return dir === 1 ? STORY[0]! : STORY[STORY.length - 1]!;
  const i = STORY.indexOf(from);
  return STORY[(i + dir + STORY.length) % STORY.length]!;
}
