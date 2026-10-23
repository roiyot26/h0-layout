// The layout region (M2 spec §1.3, STYLE §11, CHECKLIST B2/B7/B8): the 3D canvas lives
// in one full-bleed, viewport-tall section in the page flow, right after the top bar,
// instead of a fixed layer over the whole page. The sticky top bar (Skip first, the
// first Tab stop) stays above it, the M1 page follows below it, and the page scrolls
// natively. Only the canvas takes touch-action: none. Styles come from the world
// chunk, so a production build ships none of this.
import type { Dest } from './camera/views';
import type { StationId } from './camera/poses';
import { STATIONS } from './camera/poses';
import { STATION_INFO } from './stations';

const CSS = `
.layout-region { position: relative; z-index: 1; height: 100vh; height: 100svh; overflow: hidden; background: #d8c6a6; }
.layout-region canvas.world { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
.layout-region canvas.world:focus { outline: none; }
.layout-region .station-label { position: absolute; left: 0; top: 0; margin: 0;
  padding: 4px 10px; font: 600 15px/1.2 var(--sans); letter-spacing: 0.04em; white-space: nowrap;
  color: #1c1d1f; background: #f2eee4; border: 0; border-radius: 3px; cursor: pointer; }
.layout-region .station-label:focus-visible { outline-color: #1f3a5f; }
.layout-region .switcher { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%);
  display: flex; gap: 8px; margin: 0; padding: 0; }
.layout-region .switcher button { min-height: 44px; min-width: 72px; padding: 0 12px; font: 600 15px/1.15 var(--sans);
  letter-spacing: 0.04em; color: #1c1d1f; background: #f2eee4; border: 2px solid #f2eee4; border-radius: 3px; cursor: pointer; }
.layout-region .switcher button[aria-current='true'] { border-color: #1f3a5f; }
.layout-region .switcher button:focus-visible { outline-color: #1f3a5f; }
.layout-region .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 882.98px), (max-height: 499.98px) {
  .layout-region .switcher { bottom: 88px; left: 8px; right: 8px; transform: none; }
  .layout-region .switcher button { flex: 1 1 0; min-width: 0; padding: 0 4px; font-size: 13px; }
}
`;

/** Phone free area (§1.3): 64 px top bar; 88 px peek + 44 px switcher + 8 px gap at the bottom. */
export const FREE_AREA = { top: 64, bottom: 88 + 44 + 8 } as const;

export interface Region {
  root: HTMLElement;
  canvasHost: HTMLElement;
  switcher: Map<Dest, HTMLButtonElement>;
  labels: Map<StationId, HTMLButtonElement>;
  live: HTMLElement;
  /** Re-fits the region to the body padding and the top bar. */
  fit(): void;
  dispose(): void;
}

function px(v: string): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** Builds the region after the top bar (or at the start of `parent`). */
export function createRegion(parent: HTMLElement = document.body): Region {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);

  const root = document.createElement('section');
  root.className = 'layout-region';
  root.setAttribute('aria-label', 'The layout');
  const topbar = parent.querySelector<HTMLElement>(':scope > .topbar');
  if (topbar) topbar.after(root);
  else parent.prepend(root);

  const canvasHost = root;
  const labels = new Map<StationId, HTMLButtonElement>();
  for (const id of STATIONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'station-label';
    b.dataset.station = id;
    b.tabIndex = -1;
    b.textContent = STATION_INFO[id].name;
    b.style.opacity = '0';
    b.style.pointerEvents = 'none';
    labels.set(id, b);
    root.append(b);
  }

  const nav = document.createElement('nav');
  nav.className = 'switcher';
  nav.setAttribute('aria-label', 'Stations');
  const switcher = new Map<Dest, HTMLButtonElement>();
  const dests: Dest[] = ['overview', ...STATIONS];
  for (const d of dests) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.dest = d;
    b.textContent = d === 'overview' ? 'Overview' : STATION_INFO[d].switcher;
    b.tabIndex = d === 'overview' ? 0 : -1;
    switcher.set(d, b);
    nav.append(b);
  }
  root.append(nav);

  const live = document.createElement('p');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');
  root.append(live);

  const fit = () => {
    const body = getComputedStyle(parent);
    root.style.marginLeft = `${-px(body.paddingLeft)}px`;
    root.style.marginRight = `${-px(body.paddingRight)}px`;
    // Start at the top of the page, under the sticky top bar.
    // (Its margin collapses with the top bar's, so correct until the top is 0.)
    let margin = 0;
    root.style.marginTop = '0px';
    for (let i = 0; i < 3; i++) {
      const top = root.getBoundingClientRect().top + window.scrollY - px(body.paddingTop);
      if (Math.abs(top) < 0.5) break;
      margin -= top;
      root.style.marginTop = `${margin}px`;
    }
  };
  fit();

  return {
    root,
    canvasHost,
    switcher,
    labels,
    live,
    fit,
    dispose() {
      root.remove();
      style.remove();
    },
  };
}
