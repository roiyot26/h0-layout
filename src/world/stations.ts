// The four stations as the 3D layer names them (M2 spec §1, CONTENT §3). The world chunk
// keeps its own copy of the few strings it shows, so it never imports the site content
// (which carries employer names that a names-off build must not ship); a unit test holds
// this table to src/site/content.ts.
import type { StationId } from './camera/poses';

export interface StationInfo {
  /** The M1 page this station deep-links to, relative to the site base. */
  path: string;
  name: string;
  switcher: string;
}

export const STATION_INFO: Record<StationId, StationInfo> = {
  bootcamp: { path: '/bootcamp', name: 'Bootcamp Town', switcher: '2021 Bootcamp' },
  campus: { path: '/teaching', name: 'Teaching Campus', switcher: '2022–26 Campus' },
  city: { path: '/now', name: 'The City', switcher: 'Now · City' },
  workshop: { path: '/workshop', name: 'The Workshop', switcher: 'Workshop' },
};

/** The site's station id for each 3D station. */
export const SITE_ID: Record<StationId, string> = { bootcamp: 'bootcamp', campus: 'teaching', city: 'now', workshop: 'workshop' };
