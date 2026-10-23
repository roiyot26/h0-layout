// The lazy 3D entry, built as the "world" chunk and loaded only when a preview build
// (ENABLE_3D on) is opened with ?3d=1. It puts the layout region after the top bar and
// draws the grey-box in it from the overview pose for the viewport's tier.
import { createRegion } from './layout';
import { type World, createWorld } from './renderer';
import { createTrace, traceOn } from './trace';

declare global {
  interface Window {
    __h0World?: World;
  }
}

export function boot(parent: HTMLElement = document.body): World {
  const region = createRegion(parent);
  const world = createWorld(region.canvasHost);
  const draw = () => {
    world.renderer.info.reset();
    world.draw();
  };
  window.addEventListener('resize', () => {
    region.fit();
    world.resize();
    world.camera.aspect = world.width / world.height;
    world.camera.updateProjectionMatrix();
    draw();
  });
  if (traceOn(location.search)) {
    window.__h0World = world;
    const trace = createTrace(world.renderer);
    const c = world.camera;
    const loop = (now: number) => {
      if (trace.stopped) return;
      draw();
      const p = c.position;
      trace.record(now, {
        dest: 'overview',
        mode: 'idle',
        u: 1,
        e: 1,
        pos: { x: p.x * 1000 + 1200, y: 600 - p.z * 1000, h: p.y * 1000 },
        yaw: 0,
        pitch: 0,
        roll: 0,
        fov: c.fov,
        dof: 0,
        opacityA: 0,
        opacityB: 1,
        label: 1,
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } else draw();
  return world;
}
