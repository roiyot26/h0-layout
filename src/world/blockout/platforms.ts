// Station platforms (M2 spec §4.2): concrete slabs with a 15.5 datum top. Each station
// set piece merges its own platforms, so they cost no extra draw.
import { LEVEL } from '../units';
import type { PieceBuilder } from './kit';

export interface PlatformRect {
  name: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export const PLATFORMS = {
  bootcamp: [{ name: 'bootcamp platform', x0: 670, x1: 990, y0: 1025.5, y1: 1075.5 }],
  campus: [{ name: 'campus platform', x0: 1230, x1: 1550, y0: 1025.5, y1: 1075.5 }],
  city: [
    { name: 'city platform inside', x0: 1150, x1: 1470, y0: 124.5, y1: 174.5 },
    { name: 'city platform outside', x0: 1150, x1: 1470, y0: 34.5, y1: 84.5 },
  ],
  workshop: [{ name: 'workshop platform', x0: 700, x1: 1020, y0: 34.5, y1: 84.5 }],
} as const satisfies Record<string, readonly PlatformRect[]>;

export function addPlatforms(b: PieceBuilder, rects: readonly PlatformRect[]): void {
  for (const r of rects) b.box(r.name, r.x0, r.x1, r.y0, r.y1, 0, LEVEL.platformTop, 'concrete');
}
