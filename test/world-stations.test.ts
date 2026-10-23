import { describe, expect, it } from 'vitest';
import { STATIONS } from '../src/world/camera/poses';
import { SITE_ID, STATION_INFO } from '../src/world/stations';
import { stations } from '../src/site/content';

describe('3D station strings', () => {
  it('match the site content', () => {
    for (const id of STATIONS) {
      const s = stations.find((x) => x.id === SITE_ID[id]);
      expect(s, id).toBeDefined();
      expect(STATION_INFO[id]).toEqual({ path: s!.path, name: s!.name, switcher: s!.switcher });
    }
  });
});
