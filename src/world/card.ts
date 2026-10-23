// The trace card (M2 spec §5.4, ?trace=1&card=1): after the measurement script, a card
// at the top left, clear of the ride controls, with the median run's frame times, the
// device facts and a Copy results button (JSON to the clipboard, a local action only).
// Sized to be read and screenshotted on a 390 px phone. Preview builds only.
import type { ScriptResult } from './script';

const CSS = `
.trace-card, .trace-status { position: fixed; z-index: 50; left: 12px; top: 76px; box-sizing: border-box;
  font: 16px/1.35 var(--sans, system-ui, sans-serif); color: #f2eee4; background: #1c1d1f;
  border: 2px solid #f2eee4; border-radius: 6px; box-shadow: 0 4px 18px rgba(0,0,0,.35); }
.trace-status { padding: 10px 14px; font-weight: 600; }
.trace-card { width: min(420px, calc(100vw - 24px)); max-height: calc(100vh - 88px); max-height: calc(100svh - 88px);
  overflow: auto; padding: 14px 16px 16px; }
.trace-card h2 { margin: 0 0 2px; font-size: 18px; letter-spacing: 0.02em; }
.trace-card .sub { margin: 0 0 10px; font-size: 14px; color: #cfc8b8; }
.trace-card dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin: 0; }
.trace-card dt { color: #cfc8b8; }
.trace-card dd { margin: 0; font-weight: 700; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.trace-card .note { margin: 10px 0 0; font-size: 14px; color: #ffd27a; }
.trace-card .actions { display: flex; gap: 8px; margin-top: 14px; }
.trace-card button { min-height: 48px; padding: 0 16px; font: 700 16px/1 var(--sans, system-ui, sans-serif);
  color: #1c1d1f; background: #f2eee4; border: 2px solid #f2eee4; border-radius: 4px; cursor: pointer; }
.trace-card button.secondary { color: #f2eee4; background: transparent; }
.trace-card button:focus-visible { outline: 3px solid #ffd27a; outline-offset: 2px; }
`;

let styled = false;
function style() {
  if (styled) return;
  styled = true;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.append(s);
}

/** "Measuring…" while the script runs. */
export function showStatus(parent: HTMLElement = document.body): { set(left: number): void; remove(): void } {
  style();
  const el = document.createElement('p');
  el.className = 'trace-status';
  el.setAttribute('role', 'status');
  parent.append(el);
  return {
    set(left) {
      el.textContent = `Measuring the preview · ${left} s left`;
    },
    remove() {
      el.remove();
    },
  };
}

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/** The rows the card shows, label → value (exported for tests). */
export function cardRows(r: ScriptResult): [string, string][] {
  const m = r.median;
  const hz = Math.round(1000 / r.refreshMs);
  return [
    ['Median fps', `${m.fps}`],
    ['Frame time p50', `${m.p50} ms`],
    ['Frame time p95', `${m.p95} ms`],
    ['Frame time max', `${m.max} ms`],
    ['Dropped frames', `${m.dropped} (at ${hz} Hz)`],
    ['Frames > 33.4 ms', `${m.over33} of ${m.frames}`],
    ['Tier', r.tier],
    ['DPR used', `${r.dpr}`],
    ['Viewport', `${r.viewport.width} × ${r.viewport.height}`],
    ['GPU', r.gpu],
  ];
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** Draws the card; Close removes it. */
export function showCard(r: ScriptResult, parent: HTMLElement = document.body): HTMLElement {
  style();
  const card = document.createElement('section');
  card.className = 'trace-card';
  card.setAttribute('aria-label', 'Trace results');
  const h = document.createElement('h2');
  h.textContent = 'H0 preview · trace';
  const sub = document.createElement('p');
  sub.className = 'sub';
  sub.textContent = `Median of ${r.runs.length} × 20 s runs · ${new Date(r.when).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
  const dl = document.createElement('dl');
  for (const [k, v] of cardRows(r)) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    dl.append(dt, dd);
  }
  card.append(h, sub, dl);
  if (SOFTWARE.test(r.gpu)) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = 'Software renderer: frame times are advisory only.';
    card.append(note);
  }
  const actions = document.createElement('div');
  actions.className = 'actions';
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'trace-copy';
  copyBtn.textContent = 'Copy results';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'secondary trace-close';
  close.textContent = 'Close';
  const said = document.createElement('span');
  said.className = 'sr-only';
  said.setAttribute('aria-live', 'polite');
  said.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)';
  actions.append(copyBtn, close, said);
  card.append(actions);
  copyBtn.addEventListener('click', () => {
    void copy(JSON.stringify(r, null, 2)).then((ok) => {
      copyBtn.textContent = ok ? 'Copied' : 'Copy failed';
      said.textContent = ok ? 'Results copied to the clipboard.' : 'Could not copy the results.';
      setTimeout(() => (copyBtn.textContent = 'Copy results'), 2000);
    });
  });
  close.addEventListener('click', () => card.remove());
  parent.append(card);
  return card;
}
