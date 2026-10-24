// The railbus (M2 spec §4.2): two 153 × 33 cars parked at City on the front straight,
// enamel lower body 8–27 mm above rail, cream upper body 27–46 mm above rail.
import { FRONT_Y } from '../track/path';
import { RAIL_TOP } from '../units';
import { PieceBuilder, type SetPiece } from './kit';

export const CAR = { length: 153, width: 33, gap: 3 } as const;
/** West end of the leading car on the front straight (the Bootcamp platform starts at 1150). */
export const RAILBUS_X = 1155;

/** The same at both tiers: nothing here has curved segments to thin. */
export function build(): SetPiece {
  const b = new PieceBuilder();
  for (let i = 0; i < 2; i++) {
    const x0 = RAILBUS_X + i * (CAR.length + CAR.gap);
    const x1 = x0 + CAR.length;
    const y0 = FRONT_Y - CAR.width / 2;
    const y1 = FRONT_Y + CAR.width / 2;
    b.box(`railbus car ${i + 1} lower`, x0, x1, y0, y1, RAIL_TOP + 8, RAIL_TOP + 27, 'enamel');
    b.box(`railbus car ${i + 1} upper`, x0, x1, y0, y1, RAIL_TOP + 27, RAIL_TOP + 46, 'cream');
  }
  return b.build('railbus');
}
