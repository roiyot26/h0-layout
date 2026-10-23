// STYLE §2 colour tokens used by the grey-box (M2 spec §4.2), and the one material they
// share. Every set piece carries its tokens as vertex colours on merged geometry, so a
// piece is one draw however many tokens it uses (see the PR notes on the §4.1 drift).
import { Color, DoubleSide, FrontSide, MeshLambertMaterial } from 'three';

export const TOKEN = {
  flock: 0x8e8a62,
  hills: 0x8c8f78,
  hillsLight: 0xa7a68e,
  plaster: 0xb9a98a,
  cutEdge: 0x4a3b2e,
  fascia: 0x3b3a36,
  backdropLow: 0xd9c9a6,
  backdropHigh: 0x8fa9b8,
  sandstone: 0xc8b08a,
  ballast: 0x6e6a64,
  sleeper: 0x4e4239,
  rail: 0x6b4a35,
  signal: 0xe3b341,
  concrete: 0x9a9890,
  brick: 0x7a4a3a,
  terracotta: 0xa4553a,
  timber: 0x6b5034,
  enamel: 0x1f3a5f,
  cream: 0xf2eee4,
  suitcase: 0x8a6a48,
  ochre: 0xc9a86a,
  copperGreen: 0x5e8c7a,
  steelBlue: 0x3e5a73,
  rust: 0x8a4b2a,
  water: 0x5c7a86,
  asphalt: 0x4a4844,
} as const;

export type Token = keyof typeof TOKEN;

/** Linear-space colour for a token or a raw sRGB hex. */
export const linear = (c: Token | number): Color => new Color().setHex(typeof c === 'number' ? c : TOKEN[c]);

let shared: MeshLambertMaterial | null = null;

/** The grey-box material: Lambert, vertex colours, both sides, fogged. */
export function blockoutMaterial(): MeshLambertMaterial {
  return (shared ??= new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }));
}

let front: MeshLambertMaterial | null = null;

/**
 * The backdrop's material: front faces only, so it reads from the board side and is
 * see-through from outside the table (the phone overview stands beyond the left end).
 */
export function backdropMaterial(): MeshLambertMaterial {
  return (front ??= new MeshLambertMaterial({ vertexColors: true, side: FrontSide }));
}
