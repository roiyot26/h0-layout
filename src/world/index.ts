// The lazy 3D entry, built as the "world" chunk and loaded only when a preview build
// (ENABLE_3D on) is opened with ?3d=1. It draws the grey-box from the overview pose
// for the viewport's tier; the station poses and hops join in the next pull request.
import { type World, createWorld } from './renderer';
import { startTrace, traceOn } from './trace';

declare global {
  interface Window {
    __h0World?: World;
  }
}

export function boot(container: HTMLElement = document.body): World {
  const world = createWorld(container);
  if (traceOn(location.search)) {
    window.__h0World = world;
    startTrace(world.renderer, world.draw);
  }
  return world;
}
