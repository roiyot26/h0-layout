// ?trace=1 per-frame logger (M2 spec §5.4). It is only imported from the world chunk,
// so it never reaches a production build. The camera rig calls record() once per
// animation frame, after it renders, with the pose, DOF and opacities of that frame.
import type { WebGLRenderer } from 'three';
import type { TablePoint } from './units';

/** What the rig knows about a frame (§5.4). */
export interface RigSample {
  /** Destination the camera is at or heading to. */
  dest: string;
  /** 'idle', 'fly', 'fade' or 'ride'. */
  mode: string;
  /** Transition progress: the fly's curve parameter, a fade's elapsed fraction, 1 when idle. */
  u: number;
  /** Eased progress: the arc-length fraction on a back-pair fly, the elapsed fraction of a fade. */
  e: number;
  /** Camera position, table mm datum. */
  pos: TablePoint;
  yaw: number;
  pitch: number;
  roll: number;
  /** Vertical FOV in degrees. */
  fov: number;
  /** Focus distance in mm (logged only in M2, §1.4). */
  dof: number;
  /** Opacity of the outgoing frame (the crossfade quad). */
  opacityA: number;
  /** Weight of the incoming, live frame. */
  opacityB: number;
  /** Station label opacity. */
  label: number;
  /**
   * During a ride: its clock (ms), the train's front arc length (mm, unwrapped) and speed
   * (mm/s), the camera ('chase', 'cab' or 'stations' under reduced motion), the chase
   * spring's arc length and the cab's yaw drag.
   */
  ride?: { t: number; s: number; v: number; cam: string; sc: number; yaw: number };
}

export interface TraceFrame extends RigSample {
  /** ms since the trace started */
  t: number;
  /** ms since the previous frame */
  frameMs: number;
  render: { calls: number; triangles: number; points: number; lines: number; frame: number };
}

/** The trace card (&card=1) gets the frames recorded so far. */
export type TraceCardHook = (frames: readonly TraceFrame[]) => void;

export interface Trace {
  frames: TraceFrame[];
  record(now: number, sample: RigSample): void;
  stop(): void;
  stopped: boolean;
}

declare global {
  interface Window {
    __h0Trace?: Trace;
  }
}

export const traceOn = (search: string): boolean => new URLSearchParams(search).has('trace');

/** A trace that records one TraceFrame per record() call until stop(). */
export function createTrace(renderer: WebGLRenderer, card?: TraceCardHook): Trace {
  const frames: TraceFrame[] = [];
  let start = -1;
  let last = 0;
  const trace: Trace = {
    frames,
    stopped: false,
    record(now, sample) {
      if (trace.stopped) return;
      if (start < 0) start = last = now;
      const r = renderer.info.render;
      frames.push({
        ...sample,
        pos: { ...sample.pos },
        t: now - start,
        frameMs: now - last,
        render: { calls: r.calls, triangles: r.triangles, points: r.points, lines: r.lines, frame: r.frame },
      });
      last = now;
    },
    stop() {
      trace.stopped = true;
      card?.(frames);
    },
  };
  window.__h0Trace = trace;
  return trace;
}
