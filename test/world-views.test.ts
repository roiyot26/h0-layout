import { describe, expect, it } from 'vitest';
import { STATIONS } from '../src/world/camera/poses';
import { type Dest, STORY, hopType, step } from '../src/world/camera/views';

describe('hop-type table (M2 spec §6 F20a)', () => {
  const dests: Dest[] = ['overview', ...STATIONS];
  const fly = new Set(['workshop>bootcamp', 'bootcamp>workshop', 'campus>city', 'city>campus']);

  it('flies only between same-straight neighbours and crossfades everything else', () => {
    for (const a of dests) {
      for (const b of dests) {
        if (a === b) continue;
        expect(hopType(a, b), `${a} → ${b}`).toBe(fly.has(`${a}>${b}`) ? 'fly' : 'crossfade');
      }
    }
  });

  it('walks the story order as a loop', () => {
    expect(STORY).toEqual(['bootcamp', 'campus', 'city', 'workshop']);
    expect(step('overview', 1)).toBe('bootcamp');
    expect(step('overview', -1)).toBe('workshop');
    expect(step('workshop', 1)).toBe('bootcamp');
    expect(step('bootcamp', -1)).toBe('workshop');
    expect(step('campus', 1)).toBe('city');
  });
});
