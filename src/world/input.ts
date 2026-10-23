// Input (M2 spec §1.2, STYLE §5 and §11, CHECKLIST B7/B8): one-finger or mouse drag
// orbits (after an 8 px threshold), pinch and Ctrl-wheel dolly, a plain wheel scrolls
// the page, the arrow keys walk the story order inside the layout region, the switcher
// and station labels hop. Only the canvas takes touch-action: none.
import { type Dest, step } from './camera/views';
import type { Region } from './layout';
import type { Rig } from './rig';

/** Degrees of orbit per CSS px of drag. */
export const DRAG_GAIN = 0.2;
/** Drag threshold in CSS px before a press becomes an orbit. */
export const DRAG_THRESHOLD = 8;

export function wireInput(region: Region, canvas: HTMLCanvasElement, rig: Rig): () => void {
  const pointers = new Map<number, { x: number; y: number; x0: number; y0: number }>();
  let dragging = false;
  let pinch = 0;
  const off: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) => {
    el.addEventListener(type, fn, o);
    off.push(() => el.removeEventListener(type, fn, o));
  };
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  on(canvas, 'pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    canvas.focus({ preventScroll: true });
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    if (pointers.size === 2) pinch = spread();
  });
  on(canvas, 'pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size >= 2) {
      const s = spread();
      if (pinch > 0 && s > 0) rig.orbitBy({ scale: pinch / s });
      pinch = s;
      return;
    }
    if (!dragging && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < DRAG_THRESHOLD) return;
    dragging = true;
    rig.orbitBy({ azimuth: -dx * DRAG_GAIN, polar: -dy * DRAG_GAIN });
  });
  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (pointers.size === 0) dragging = false;
  };
  on(canvas, 'pointerup', up);
  on(canvas, 'pointercancel', up);
  on(
    canvas,
    'wheel',
    (e) => {
      if (!e.ctrlKey) return; // a plain wheel scrolls the page
      e.preventDefault();
      rig.orbitBy({ scale: Math.exp(e.deltaY * 0.002) });
    },
    { passive: false },
  );

  const hop = (d: Dest) => rig.go(d);
  on(region.root, 'keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = step(rig.mode === 'idle' ? rig.dest : rig.to, e.key === 'ArrowRight' ? 1 : -1);
    hop(next);
    // Roving focus follows the switcher's current button.
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement && active.parentElement?.classList.contains('switcher')) region.switcher.get(next)?.focus();
  });
  for (const [d, b] of region.switcher) on(b, 'click', () => hop(d));
  for (const [id, b] of region.labels) on(b, 'click', () => hop(id));

  return () => {
    for (const f of off) f();
  };
}
