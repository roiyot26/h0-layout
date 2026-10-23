// The City (M2 spec §4.2): the train shed over both platforms, the Kage box, four
// stepped blocks and the tram stub to its depot.
import { LEVEL } from '../units';
import { PieceBuilder, type SetPiece } from './kit';
import { PLATFORMS, addPlatforms } from './platforms';

/** City blocks [x0, x1, y0, y1, height], stepped down toward the station. */
export const BLOCKS: readonly (readonly [number, number, number, number, number])[] = [
  [340, 460, 680, 820, 200],
  [480, 600, 700, 830, 170],
  [680, 780, 730, 830, 130],
  [860, 960, 860, 960, 110],
];

/** The same at both tiers: nothing here has curved segments to thin. */
export function build(): SetPiece {
  const b = new PieceBuilder();
  addPlatforms(b, PLATFORMS.city);
  // Train shed x 670–990, y 1015–1175: two side walls to the eaves, a prism roof to the ridge.
  b.box('city shed wall inside', 670, 990, 1015, 1023, 0, LEVEL.shedEaves, 'brick');
  b.box('city shed wall outside', 670, 990, 1167, 1175, 0, LEVEL.shedEaves, 'brick');
  b.prism('city shed roof', 830, 1095, 320, 160, LEVEL.shedEaves, LEVEL.shedRidge, 0, 'steelBlue');
  // The Kage box in front of the shed's inside wall, its sheet on the face to the camera.
  b.box('city kage box', 905, 935, 980, 1010, 0, 80, 'enamel');
  b.box(null, 916.6, 923.4, 979.4, 980, 30, 34.8, 'cream');
  BLOCKS.forEach(([x0, x1, y0, y1, h], i) => b.box(`city block ${i + 1}`, x0, x1, y0, y1, 0, h, 'concrete'));
  // Tram stub from (840, 930) to the depot.
  const [ax, ay, bx, by] = [840, 930, 570, 905];
  b.orientedBox('city tram stub', (ax + bx) / 2, (ay + by) / 2, Math.hypot(ax - bx, ay - by), 20, 0, 1.5, Math.atan2(by - ay, bx - ax), 'ballast');
  b.box('city tram depot', 470, 570, 860, 950, 0, 50, 'brick');
  return b.build('station_city');
}
