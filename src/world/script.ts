// The §5.4 measurement script: a 5 s warm-up at the overview, then a 20 s run of hops
// and a ride, repeated 3 times, reporting the median. The same run makes the 20 s
// capture. Preview builds only: it is reached from the world chunk with ?trace=1.
import type { WebGLRenderer } from 'three';
import type { Rig } from './rig';
import type { Dest } from './camera/views';
import { type RunStats, medianStats, refreshMs, runStats } from './stats';
import type { Trace } from './trace';

/** One run: overview → Workshop → Bootcamp (fly) → City (crossfade) → Campus (fly) → overview, then 8 s of ride. */
export const RUN: readonly { at: number; go?: Dest; ride?: 'start' | 'end' }[] = [
  { at: 0, go: 'workshop' },
  { at: 2500, go: 'bootcamp' },
  { at: 5000, go: 'city' },
  { at: 7500, go: 'campus' },
  { at: 10_000, go: 'overview' },
  { at: 12_000, ride: 'start' },
  { at: 20_000, ride: 'end' },
];
export const RUN_MS = 20_000;
export const WARMUP_MS = 5000;
/** Time for the ride's crossfade home before the next run. */
const SETTLE_MS = 1000;

export interface ScriptResult {
  /** ISO time the script finished. */
  when: string;
  viewport: { width: number; height: number };
  /** The drawing-buffer pixel ratio in use. */
  dpr: number;
  tier: string;
  gpu: string;
  refreshMs: number;
  runs: RunStats[];
  median: RunStats;
}

export interface ScriptOptions {
  warmup?: number;
  repeats?: number;
  /** Seconds left, for the on-screen status. */
  onProgress?: (left: number) => void;
}

/** The GPU string from WEBGL_debug_renderer_info, else the masked RENDERER, else a note. */
export function gpuString(renderer: WebGLRenderer): string {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const s: unknown = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  if (typeof s !== 'string' || s === '') return 'Not exposed by this browser';
  return ext ? s : `${s} (renderer info not exposed)`;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));

async function settle(rig: Rig) {
  for (let i = 0; i < 100 && (rig.mode !== 'idle' || rig.riding); i++) await sleep(50);
}

/** Runs the script on the live rig and returns the statistics. */
export async function runScript(
  rig: Rig,
  trace: Trace,
  renderer: WebGLRenderer,
  tier: () => string,
  opts: ScriptOptions = {},
): Promise<ScriptResult> {
  const warmup = opts.warmup ?? WARMUP_MS;
  const repeats = opts.repeats ?? 3;
  const total = warmup + repeats * (RUN_MS + SETTLE_MS);
  const t0 = performance.now();
  const progress = () => opts.onProgress?.(Math.max(0, Math.ceil((total - (performance.now() - t0)) / 1000)));
  const tick = setInterval(progress, 1000);
  progress();
  try {
    if (rig.riding) rig.endRide();
    await settle(rig);
    if (rig.dest !== 'overview') rig.go('overview', { push: false });
    await settle(rig);
    const w0 = trace.frames.length;
    await sleep(warmup - (performance.now() - t0));
    const all: number[] = trace.frames.slice(w0).map((f) => f.frameMs);
    const windows: number[][] = [];
    for (let k = 0; k < repeats; k++) {
      const start = performance.now();
      const i0 = trace.frames.length;
      for (const step of RUN) {
        await sleep(start + step.at - performance.now());
        if (step.go) rig.go(step.go, { push: false });
        if (step.ride === 'start') rig.ride();
        if (step.ride === 'end') {
          windows.push(trace.frames.slice(i0 + 1).map((f) => f.frameMs));
          rig.endRide();
        }
      }
      await sleep(SETTLE_MS);
      await settle(rig);
    }
    for (const w of windows) all.push(...w);
    const refresh = refreshMs(all);
    const runs = windows.map((w) => runStats(w, refresh));
    return {
      when: new Date().toISOString(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      dpr: renderer.getPixelRatio(),
      tier: tier(),
      gpu: gpuString(renderer),
      refreshMs: Math.round(refresh * 100) / 100,
      runs,
      median: medianStats(runs),
    };
  } finally {
    clearInterval(tick);
  }
}
