// Water and bridge (M2 spec §4.2): the river strip and lake ellipse at −30, and the
// steel deck with its two abutments where the back straight crosses the river.
import { CircleGeometry, PlaneGeometry } from 'three';
import { LAKE, RIVER } from '../terrain/heightmap';
import { BACK_Y } from '../track/path';
import { LEVEL, TABLE_D, type Tier, toX, toZ } from '../units';
import { PieceBuilder, type SetPiece } from './kit';
import { BRIDGE_X } from './track';

/** The water planes reach a little past the full-depth edge, into the banks. */
const SPREAD = 10;
const DECK_HALF = 25;
const DECK_DEPTH = 12;
const ABUTMENT = 32;

export function build(tier: Tier): SetPiece {
  const b = new PieceBuilder();
  const w = RIVER.x1 - RIVER.x0 + 2 * SPREAD;
  const y0 = RIVER.y0 - SPREAD;
  const river = new PlaneGeometry(w / 1000, (TABLE_D - y0) / 1000);
  river.rotateX(-Math.PI / 2);
  river.translate(toX((RIVER.x0 + RIVER.x1) / 2), LEVEL.water / 1000, toZ((y0 + TABLE_D) / 2));
  b.add(river, 'water');
  const lake = new CircleGeometry(1, tier === 'desktop' ? 32 : 16);
  lake.rotateX(-Math.PI / 2);
  lake.scale((LAKE.rx * 1.1) / 1000, 1, (LAKE.ry * 1.1) / 1000);
  lake.translate(toX(LAKE.cx), LEVEL.water / 1000, toZ(LAKE.cy));
  b.add(lake, 'water');
  const d0 = BACK_Y - DECK_HALF;
  const d1 = BACK_Y + DECK_HALF;
  b.box('bridge deck', BRIDGE_X.x0, BRIDGE_X.x1, d0, d1, LEVEL.ballastTop - DECK_DEPTH, LEVEL.ballastTop, 'steelBlue');
  const under = LEVEL.ballastTop - DECK_DEPTH;
  b.box('bridge abutment west', BRIDGE_X.x0, BRIDGE_X.x0 + ABUTMENT, d0, d1, LEVEL.water, under, 'steelBlue');
  b.box('bridge abutment east', BRIDGE_X.x1 - ABUTMENT, BRIDGE_X.x1, d0, d1, LEVEL.water, under, 'steelBlue');
  return b.build('water_bridge');
}
