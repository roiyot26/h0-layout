// Workshop (M2 spec §4.2): the goods shed on the siding straight and the front platform.
import { SIDING_ARC, SIDING_STRAIGHT, sidingAt } from '../track/path';
import { PieceBuilder, type SetPiece } from './kit';
import { PLATFORMS, addPlatforms } from './platforms';

const SHED = { length: 120, width: 60, eaves: 42, ridge: 55 } as const;

/** The same at both tiers: nothing here has curved segments to thin. */
export function build(): SetPiece {
  const b = new PieceBuilder();
  addPlatforms(b, PLATFORMS.workshop);
  const mid = sidingAt(SIDING_ARC + SIDING_STRAIGHT / 2);
  const a = Math.atan2(mid.ty, mid.tx);
  b.orientedBox('workshop goods shed', mid.x, mid.y, SHED.length, SHED.width, 0, SHED.eaves, a, 'rust');
  b.prism('workshop shed roof', mid.x, mid.y, SHED.length + 6, SHED.width + 6, SHED.eaves, SHED.ridge, a, 'timber');
  return b.build('station_workshop');
}
