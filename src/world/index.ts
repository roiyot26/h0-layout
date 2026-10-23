// The lazy 3D entry, built as the "world" chunk and loaded only when a preview build
// (ENABLE_3D on) is opened with ?3d=1. It puts the layout region after the top bar,
// draws the grey-box in it and hands the camera to the rig. A cold deep link (a
// station page) starts parked at that station; Back and Forward hop. With ?trace=1
// the trace logger runs, and &card=1 adds the §5.4 script and its card.
import { showCard, showStatus } from './card';
import { wireInput } from './input';
import { createRegion } from './layout';
import { type World, createWorld } from './renderer';
import { type Rig, createRig, destForPath } from './rig';
import { type ScriptOptions, type ScriptResult, runScript } from './script';
import { createTrace, traceOn } from './trace';

declare global {
  interface Window {
    __h0World?: World & {
      rig: Rig;
      script(opts?: ScriptOptions): Promise<ScriptResult>;
      card(r: ScriptResult): HTMLElement;
      result?: ScriptResult;
    };
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
  wireInput(region, world.renderer.domElement, rig);
  window.addEventListener('resize', () => rig.resize());
  window.addEventListener('popstate', (e) => {
    const d = (e.state as { h0?: string } | null)?.h0 ?? destForPath(location.pathname, base) ?? 'overview';
    rig.go(d as Parameters<Rig['go']>[0], { push: false });
  });
  if (trace) {
    const script = (opts?: ScriptOptions) => runScript(rig, trace, world.renderer, () => world.tier, opts);
    const handle: NonNullable<Window['__h0World']> = Object.assign(world, { rig, script, card: (r: ScriptResult) => showCard(r) });
    window.__h0World = handle;
    // &card=1: run the §5.4 script, then show the card.
    if (new URLSearchParams(location.search).has('card')) {
      const status = showStatus();
      void script({ onProgress: (left) => status.set(left) }).then((r) => {
        status.remove();
        trace.stop();
        handle.result = r;
        showCard(r);
      });
    }
  }
  return rig;
}
