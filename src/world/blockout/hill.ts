// Hill set piece (M2 spec §4.2): the tunnel hill as a plane displaced by the analytic
// height (with the track cutting), and the two portals, each a bore-shaped hole made of
// two jambs and a lintel.
import { BufferAttribute, PlaneGeometry } from 'three';
import { BACK_TRACK_Y, HILL, PORTAL_EAST, PORTAL_WEST, hillHeight } from '../terrain/heightmap';
import { LEVEL, type Tier, fromX, fromZ, toX, toZ } from '../units';
import { PieceBuilder, type SetPiece } from './kit';

const PORTAL = { width: 70, height: 90, thick: 8, opening: 50 } as const;

export function build(tier: Tier): SetPiece {
  const b = new PieceBuilder();
  const [sx, sy] = tier === 'desktop' ? [50, 37] : [30, 22];
  const w = HILL.x1 - HILL.x0;
  const d = HILL.y1 - HILL.y0;
  const g = new PlaneGeometry(w / 1000, d / 1000, sx, sy);
  g.rotateX(-Math.PI / 2);
  g.translate(toX((HILL.x0 + HILL.x1) / 2), 0, toZ((HILL.y0 + HILL.y1) / 2));
  const p = g.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, hillHeight(fromX(p.getX(i)), fromZ(p.getZ(i))) / 1000);
  g.computeVertexNormals();
  b.add(g, 'plaster');

  const y0 = BACK_TRACK_Y - PORTAL.width / 2;
  const y1 = BACK_TRACK_Y + PORTAL.width / 2;
  const o0 = BACK_TRACK_Y - PORTAL.opening / 2;
  const o1 = BACK_TRACK_Y + PORTAL.opening / 2;
  const top = LEVEL.portalOpeningTop;
  for (const [name, x0, x1] of [
    ['west portal', PORTAL_WEST - PORTAL.thick, PORTAL_WEST],
    ['east portal', PORTAL_EAST, PORTAL_EAST + PORTAL.thick],
  ] as const) {
    b.box(`${name} jamb front`, x0, x1, y0, o0, 0, PORTAL.height, 'sandstone');
    b.box(`${name} jamb back`, x0, x1, o1, y1, 0, PORTAL.height, 'sandstone');
    b.box(`${name} lintel`, x0, x1, o0, o1, top, PORTAL.height, 'sandstone');
  }
  return b.build('hill');
}
