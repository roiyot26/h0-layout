// The City (M2 spec §4.2): the train shed over both platforms, the Kage box, four
// stepped blocks and the tram stub to its depot on the front-right straight (x 1150–1470).
import { LEVEL } from '../units';
import { PieceBuilder, type SetPiece } from './kit';
import { PLATFORMS, addPlatforms } from './platforms';

/** City blocks [x0, x1, y0, y1, height], stepped down toward the station. */
export const BLOCKS: readonly (readonly [number, number, number, number, number])[] = [
  [1600, 1720, 320, 440, 200],
  [1360, 1480, 330, 440, 170],
  [1180, 1280, 270, 370, 130],
  [1250, 1350, 210, 300, 110],
];

/** The same at both tiers: nothing here has curved segments to thin. */
export function build(): SetPiece {
  const b = new PieceBuilder();
  addPlatforms(b, PLATFORMS.city);
  // Train shed x 1150–1470, y 34.5–174.5: back wall along the inside platform, west shelter wall
  // on the outside platform (leaving the front sightline at x = 1310 open), and a pitched roof.
  b.box('city shed wall inside', 1150, 1435, 174.5, 182.5, 0, LEVEL.shedEaves, 'brick');
  b.box('city shed wall outside', 1150, 1240, 26.5, 34.5, 0, LEVEL.shedEaves, 'brick');
  b.prism(null, 1310, 104.5, 320, 140, LEVEL.shedEaves, LEVEL.shedRidge, 0, 'steelBlue');
  // Pitched roof clearance AABBs: eaves (81.8 mm) over the platforms, rising to 103.2..111.8 mm over the track.
  b.solid('city shed roof outside', 1150, 1470, 34.5, 84.5, LEVEL.shedEaves, 103.2);
  b.solid('city shed roof', 1150, 1470, 84.5, 124.5, 103.2, LEVEL.shedRidge);
  b.solid('city shed roof inside', 1150, 1470, 124.5, 174.5, LEVEL.shedEaves, 103.2);
  // The Kage box at the east end behind the inside platform, its sheet on the face to the camera.
  b.box('city kage box', 1445, 1475, 175, 205, 0, 80, 'enamel');
  b.box(null, 1456.6, 1463.4, 174.4, 175, 30, 34.8, 'cream');
  BLOCKS.forEach(([x0, x1, y0, y1, h], i) => b.box(`city block ${i + 1}`, x0, x1, y0, y1, 0, h, 'concrete'));
  // Tram stub from (1380, 240) to the depot in the loop interior.
  const [ax, ay, bx, by] = [1380, 240, 1520, 260];
  b.orientedBox('city tram stub', (ax + bx) / 2, (ay + by) / 2, Math.hypot(ax - bx, ay - by), 20, 0, 1.5, Math.atan2(by - ay, bx - ax), 'ballast');
  b.box('city tram depot', 1520, 1620, 215, 305, 0, 50, 'brick');
  return b.build('station_city');
}
