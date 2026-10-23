// Level crossing (M2 spec §4.2): the road across the front straight at x 1605–1675, the
// panel between the rails, and the two barriers (post and raised arm) with their lamps.
import { FRONT_Y } from '../track/path';
import { LEVEL } from '../units';
import { PieceBuilder, type SetPiece } from './kit';

const ROAD = { x0: 1605, x1: 1675, y0: 0, y1: 190 } as const;

/** The same at both tiers: nothing here has curved segments to thin. */
export function build(): SetPiece {
  const b = new PieceBuilder();
  b.box('crossing road south', ROAD.x0, ROAD.x1, ROAD.y0, FRONT_Y - 22.5, 0, 1.5, 'asphalt');
  b.box('crossing road north', ROAD.x0, ROAD.x1, FRONT_Y + 22.5, ROAD.y1, 0, 1.5, 'asphalt');
  b.box('crossing panel', ROAD.x0, ROAD.x1, FRONT_Y - 22.5, FRONT_Y + 22.5, LEVEL.ballastTop, LEVEL.railTop - 0.2, 'asphalt');
  // Barriers stand at opposite corners, arms raised (vertical) for the overview.
  for (const [name, x, y] of [
    ['crossing barrier west', ROAD.x0 - 8, FRONT_Y - 40],
    ['crossing barrier east', ROAD.x1 + 8, FRONT_Y + 40],
  ] as const) {
    b.box(`${name} post`, x - 2, x + 2, y - 2, y + 2, 0, 14, 'fascia');
    b.box(`${name} arm`, x - 0.8, x + 0.8, y - 0.8, y + 0.8, 14, 90, 'signal');
    b.box(`${name} lamp`, x + 2, x + 5, y - 1.5, y + 1.5, 10, 14, 'signal');
  }
  return b.build('crossing');
}
