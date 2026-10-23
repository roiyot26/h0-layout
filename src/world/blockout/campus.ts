// Teaching Campus (M2 spec §4.2): the 115 mm hall, the 80 mm office and the footbridge
// between them, behind the inside platform of the back straight.
import { PieceBuilder, type SetPiece } from './kit';
import { PLATFORMS, addPlatforms } from './platforms';

/** The same at both tiers: nothing here has curved segments to thin. */
export function build(): SetPiece {
  const b = new PieceBuilder();
  addPlatforms(b, PLATFORMS.campus);
  b.box('campus hall', 1240, 1400, 840, 990, 0, 95, 'ochre');
  b.prism('campus hall roof', 1320, 915, 164, 154, 95, 115, 0, 'copperGreen');
  b.box('campus office', 1430, 1560, 860, 980, 0, 80, 'sandstone');
  // Footbridge: a deck at 60 datum between the two, with a stair block down each side.
  b.box('campus footbridge', 1395, 1435, 905, 925, 55, 60, 'steelBlue');
  b.box('campus stair west', 1402, 1412, 925, 965, 0, 55, 'steelBlue');
  b.box('campus stair east', 1418, 1428, 865, 905, 0, 55, 'steelBlue');
  return b.build('station_campus');
}
