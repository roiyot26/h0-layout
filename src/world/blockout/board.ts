// Terrain set piece (M2 spec §4.2): the board top displaced by the height map, the cut
// edge, the fascia and the painted backdrop with its two coves.
import { BufferAttribute, BufferGeometry, Color, CylinderGeometry, PlaneGeometry } from 'three';
import { HILL, analyticHeight } from '../terrain/heightmap';
import { LEVEL, TABLE_D, TABLE_W, type Tier, toX, toZ } from '../units';
import { PieceBuilder, type SetPiece } from './kit';
import { linear } from './palette';

/** The water area gets a finer grid so the river banks and lake shore read. */
const WATER_AREA = { x0: 1540, x1: 1760, y0: 620, y1: 1200 } as const;
const BACKDROP_H = 300;
const COVE_R = 150;
const FASCIA_T = 9;
const CUT_T = 3;

function lines(from: number, to: number, coarse: number, dense: { a: number; b: number; step: number }, extra: number[]): number[] {
  const out = new Set<number>();
  for (let v = from; v <= to; v += coarse) out.add(v);
  for (let v = dense.a; v <= dense.b; v += dense.step) out.add(v);
  for (const v of extra) out.add(v);
  return [...out].sort((a, b) => a - b);
}

/** Board-top surface: a tensor grid over the table, skipping the hill footprint. */
function boardTop(tier: Tier): BufferGeometry {
  const step = tier === 'desktop' ? 10 : 20;
  const xs = lines(0, TABLE_W, 100, { a: WATER_AREA.x0, b: WATER_AREA.x1, step }, [HILL.x0, HILL.x1, TABLE_W]);
  const ys = lines(0, TABLE_D, 100, { a: WATER_AREA.y0, b: WATER_AREA.y1, step }, [HILL.y0, TABLE_D]);
  const flock = linear('flock');
  const plaster = linear('plaster');
  const pos: number[] = [];
  const col: number[] = [];
  // Below the water line the bed sits a little deeper, so the water planes at −30 never
  // z-fight it; on dry ground the vertex is exactly the map height.
  const h = (x: number, y: number) => {
    const v = analyticHeight(x, y);
    return v < 0 ? v * 1.2 : v;
  };
  const vert = (x: number, y: number) => {
    const v = h(x, y);
    pos.push(toX(x), v / 1000, toZ(y));
    const c = v < -1 ? plaster : flock;
    col.push(c.r, c.g, c.b);
  };
  for (let j = 0; j < ys.length - 1; j++) {
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i]!;
      const x1 = xs[i + 1]!;
      const y0 = ys[j]!;
      const y1 = ys[j + 1]!;
      if (x0 >= HILL.x0 && x1 <= HILL.x1 && y0 >= HILL.y0 && y1 <= HILL.y1) continue;
      vert(x0, y0);
      vert(x1, y0);
      vert(x1, y1);
      vert(x0, y0);
      vert(x1, y1);
      vert(x0, y1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.computeVertexNormals();
  return g;
}

const mix = (a: Color, b: Color, t: number) => a.clone().lerp(b, t);

/** Backdrop colour at table x and height h: sky gradient with a painted hill band. */
function backdropColour(x: number, h: number, low: Color, high: Color, band: Color, bandLight: Color): Color {
  const sky = mix(low, high, Math.min(Math.max(h / BACKDROP_H, 0), 1));
  // A low ridge of painted hills on the right half, peaking behind the river.
  const ridge = 40 + 50 * Math.max(0, Math.sin(((x - 1250) / 1150) * Math.PI));
  if (x > 1250 && h <= ridge) return mix(band, bandLight, h / ridge);
  return sky;
}

function backdrop(tier: Tier): BufferGeometry[] {
  const low = linear('backdropLow');
  const high = linear('backdropHigh');
  const band = linear('hills');
  const bandLight = linear('hillsLight');
  const cols = tier === 'desktop' ? 48 : 24;
  const rows = 6;
  const out: BufferGeometry[] = [];
  const colour = (g: BufferGeometry, xOf: (i: number) => number) => {
    const p = g.getAttribute('position');
    const data = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const c = backdropColour(xOf(i), p.getY(i) * 1000, low, high, band, bandLight);
      data.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new BufferAttribute(data, 3));
    g.deleteAttribute('uv');
    return g;
  };
  // Back plane, between the coves, facing the front.
  const backW = TABLE_W - 2 * COVE_R;
  const back = new PlaneGeometry(backW / 1000, BACKDROP_H / 1000, cols, rows).toNonIndexed();
  back.translate(0, BACKDROP_H / 2000, toZ(TABLE_D));
  out.push(colour(back, (i) => back.getAttribute('position').getX(i) * 1000 + TABLE_W / 2));
  // End planes, facing in.
  for (const side of [-1, 1]) {
    const len = TABLE_D - COVE_R;
    const end = new PlaneGeometry(len / 1000, BACKDROP_H / 1000, 8, rows).toNonIndexed();
    end.rotateY((side * -Math.PI) / 2);
    end.translate((side * TABLE_W) / 2000, BACKDROP_H / 2000, toZ(len / 2));
    out.push(colour(end, () => (side < 0 ? 0 : TABLE_W)));
  }
  // Quarter-cylinder coves joining them.
  for (const side of [-1, 1]) {
    const segs = tier === 'desktop' ? 8 : 4;
    const start = side < 0 ? Math.PI : Math.PI / 2;
    const cove = new CylinderGeometry(COVE_R / 1000, COVE_R / 1000, BACKDROP_H / 1000, segs, rows, true, start, Math.PI / 2);
    const cx = side < 0 ? COVE_R : TABLE_W - COVE_R;
    cove.translate(toX(cx), BACKDROP_H / 2000, toZ(TABLE_D - COVE_R));
    const flat = cove.toNonIndexed();
    out.push(colour(flat, (i) => flat.getAttribute('position').getX(i) * 1000 + TABLE_W / 2));
  }
  return out;
}

export function build(tier: Tier): SetPiece {
  const b = new PieceBuilder();
  b.addColoured(boardTop(tier));
  for (const g of backdrop(tier)) b.addColoured(g);
  b.solid('backdrop back', 0, TABLE_W, TABLE_D, TABLE_D, 0, BACKDROP_H);
  b.solid('backdrop left', 0, 0, 0, TABLE_D, 0, BACKDROP_H);
  b.solid('backdrop right', TABLE_W, TABLE_W, 0, TABLE_D, 0, BACKDROP_H);
  // Cut edge: 3 mm crust and 25 mm foam showing at the front and both sides.
  b.box('cut edge front', 0, TABLE_W, -CUT_T, 0, -28, 0, 'cutEdge');
  b.box('cut edge left', -CUT_T, 0, -CUT_T, TABLE_D, -28, 0, 'cutEdge');
  b.box('cut edge right', TABLE_W, TABLE_W + CUT_T, -CUT_T, TABLE_D, -28, 0, 'cutEdge');
  // Fascia: 9 mm boards, 120 deep, below the cut edge.
  const f = -CUT_T - FASCIA_T;
  b.box('fascia front', f, TABLE_W - f, f, -CUT_T, LEVEL.fasciaBottom, -28, 'fascia');
  b.box('fascia left', f, -CUT_T, -CUT_T, TABLE_D, LEVEL.fasciaBottom, -28, 'fascia');
  b.box('fascia right', TABLE_W + CUT_T, TABLE_W - f, -CUT_T, TABLE_D, LEVEL.fasciaBottom, -28, 'fascia');
  return b.build('terrain');
}
