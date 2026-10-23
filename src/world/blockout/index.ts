// The grey-box scene (M2 spec §4): every set piece for a tier, added to the scene, with
// the AABB registry the clearance field and the keep-out tests read.
import type { Scene } from 'three';
import type { Tier } from '../units';
import * as board from './board';
import * as bootcamp from './bootcamp';
import * as campus from './campus';
import * as city from './city';
import * as crossing from './crossing';
import * as hill from './hill';
import type { SetPiece } from './kit';
import * as railbus from './railbus';
import * as track from './track';
import * as trees from './trees';
import * as water from './water';
import * as workshop from './workshop';

export type { SetPiece, SetPieceId, Budget } from './kit';

/** Build every set piece for the tier (trees last, placed around the rest). */
export function buildPieces(tier: Tier): SetPiece[] {
  const modules: { build: (tier: Tier) => SetPiece }[] = [board, hill, track, bootcamp, campus, city, workshop, water, crossing, railbus];
  const pieces = modules.map((m) => m.build(tier));
  pieces.push(trees.build(tier, pieces.flatMap((p) => p.aabbs)));
  return pieces;
}

export function buildBlockout(scene: Scene, tier: Tier): SetPiece[] {
  const pieces = buildPieces(tier);
  for (const p of pieces) scene.add(p.group);
  return pieces;
}
