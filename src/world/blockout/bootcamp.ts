// Bootcamp Town (M2 spec §4.2): five brick houses with terracotta prism roofs inside
// x 1330–1780, y 190–420 (92 tall), the lean-to, and the platform clock and suitcase.
import { LEVEL, type Tier } from '../units';
import { PieceBuilder, type SetPiece } from './kit';
import { PLATFORMS, addPlatforms } from './platforms';

const WALL = 65;
const RIDGE = 92;

/** [centre x, centre y, length along the ridge, width, ridge angle in degrees]. */
export const HOUSES: readonly (readonly [number, number, number, number, number])[] = [
  [1380, 250, 80, 56, 0],
  [1485, 235, 70, 52, 0],
  [1570, 335, 70, 50, 90],
  [1730, 245, 80, 56, 0],
  [1500, 365, 76, 54, 0],
];

export function build(tier: Tier): SetPiece {
  const b = new PieceBuilder();
  addPlatforms(b, PLATFORMS.bootcamp);
  HOUSES.forEach(([cx, cy, len, wid, deg], i) => {
    const a = (deg * Math.PI) / 180;
    b.orientedBox(`bootcamp house ${i + 1}`, cx, cy, len, wid, 0, WALL, a, 'brick');
    b.prism(`bootcamp roof ${i + 1}`, cx, cy, len + 6, wid + 6, WALL, RIDGE, a, 'terracotta');
  });
  b.box('bootcamp lean-to', 1250, 1300, 370, 410, 0, 30, 'timber');
  // The platform clock: a 37 mm post and a 6.9 mm dial, at the station centre.
  const top = LEVEL.platformTop;
  const seg = tier === 'desktop' ? 8 : 6;
  b.cylinder('bootcamp clock post', 1310, 160, 0.8, top, top + 37, seg, 'enamel');
  b.cylinder(null, 1310, 160, 3.45, top + 37, top + 39, seg * 2, 'cream');
  b.box('bootcamp suitcase', 1270, 1276.9, 150, 152.3, top, top + 4.6, 'suitcase');
  return b.build('station_bootcamp');
}
