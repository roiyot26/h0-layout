// ?trace=1 per-frame logger (M2 spec §5.4). It is only imported from the world chunk,
// so it never reaches a production build. PR 1 records frame time and the renderer's
// draw counts; poses, DOF and opacities join the record with the camera rig.
import type { WebGLRenderer } from 'three';

export interface TraceFrame {
  /** ms since the trace started */
  t: number;
  /** ms since the previous frame */
  frameMs: number;
  render: { calls: number; triangles: number; points: number; lines: number; frame: number };
}

/** The trace card (&card=1) arrives in M2 PR 3; it gets the frames recorded so far. */
export type TraceCardHook = (frames: readonly TraceFrame[]) => void;

export interface Trace {
  frames: TraceFrame[];
  stop(): void;
}

declare global {
  interface Window {
    __h0Trace?: Trace;
  }
}

export const traceOn = (search: string): boolean => new URLSearchParams(search).has('trace');

/** Calls `draw` on every animation frame and records one TraceFrame after it. */
export function startTrace(renderer: WebGLRenderer, draw: () => void, card?: TraceCardHook): Trace {
  const frames: TraceFrame[] = [];
  const start = performance.now();
  let last = start;
  let raf = 0;
  const tick = (now: number) => {
    draw();
    const r = renderer.info.render;
    frames.push({
      t: now - start,
      frameMs: now - last,
      render: { calls: r.calls, triangles: r.triangles, points: r.points, lines: r.lines, frame: r.frame },
    });
    last = now;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const trace: Trace = {
    frames,
    stop() {
      cancelAnimationFrame(raf);
      card?.(frames);
    },
  };
  window.__h0Trace = trace;
  return trace;
}
