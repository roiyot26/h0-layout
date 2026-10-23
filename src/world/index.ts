// The lazy 3D entry, built as the "world" chunk and loaded only when a preview build
// (ENABLE_3D on) is opened with ?3d=1. It puts the layout region after the top bar,
// draws the grey-box in it and hands the camera to the rig. A cold deep link (a
// station page) starts parked at that station; Back and Forward hop.
import { createRegion } from './layout';
import { type World, createWorld } from './renderer';
import { type Rig, createRig, destForPath } from './rig';
import { createTrace, traceOn } from './trace';

declare global {
  interface Window {
    __h0World?: World & { rig: Rig };
  }
}

export function boot(parent: HTMLElement = document.body): Rig {
  const base = document.documentElement.dataset.base ?? '/';
  const region = createRegion(parent);
  const world = createWorld(region.canvasHost);
  const tracing = traceOn(location.search);
  const trace = tracing ? createTrace(world.renderer) : undefined;
  const start = destForPath(location.pathname, base) ?? 'overview';
  history.replaceState({ ...(history.state ?? {}), h0: start }, '');
  const rig = createRig({ world, region, base, start, trace });
  window.addEventListener('resize', () => rig.resize());
  window.addEventListener('popstate', (e) => {
    const d = (e.state as { h0?: string } | null)?.h0 ?? destForPath(location.pathname, base) ?? 'overview';
    rig.go(d as Parameters<Rig['go']>[0], { push: false });
  });
  if (tracing) window.__h0World = Object.assign(world, { rig });
  return rig;
}
