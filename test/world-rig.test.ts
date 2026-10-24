import { describe, expect, it } from 'vitest';
import { FREE_AREA } from '../src/world/layout';
import { NEIGHBOUR, destForPath, pathFor, phoneOffset } from '../src/world/rig';
import { STATION_INFO } from '../src/world/stations';
import { DRAG_GAIN, DRAG_THRESHOLD } from '../src/world/input';

describe('camera rig helpers', () => {
  it('flies only between same-straight neighbours', () => {
    expect(NEIGHBOUR).toEqual({ workshop: 'city', city: 'workshop', campus: 'bootcamp', bootcamp: 'campus' });
  });

  it('centres phone stations in the free area (64 px top, 88 + 44 + 8 px bottom)', () => {
    expect(FREE_AREA).toEqual({ top: 64, bottom: 140 });
    // At 844 px the free area is 64–704 px, centre 384, so the view shifts by 38 px.
    expect(phoneOffset(844)).toBe(38);
    expect(844 / 2 - phoneOffset(844)).toBe(384);
  });

  it('maps destinations to page paths and back, under any base', () => {
    expect(pathFor('overview')).toBe('');
    for (const base of ['/', '/h0-layout/']) {
      expect(destForPath(base, base)).toBe('overview');
      expect(destForPath(`${base}index.html`, base)).toBe('overview');
      for (const [id, info] of Object.entries(STATION_INFO)) {
        expect(pathFor(id as keyof typeof STATION_INFO)).toBe(`${info.path.slice(1)}/`);
        expect(destForPath(`${base}${info.path.slice(1)}/`, base)).toBe(id);
        expect(destForPath(`${base}${info.path.slice(1)}`, base)).toBe(id);
        expect(destForPath(`${base}${info.path.slice(1)}/index.html`, base)).toBe(id);
      }
      expect(destForPath(`${base}cv/`, base)).toBeNull();
    }
    expect(destForPath('/elsewhere/bootcamp/', '/h0-layout/')).toBeNull();
  });

  it('uses an 8 px drag threshold', () => {
    expect(DRAG_THRESHOLD).toBe(8);
    expect(DRAG_GAIN).toBeGreaterThan(0);
  });
});
