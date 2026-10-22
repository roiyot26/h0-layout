import { expect, type Page } from '@playwright/test';

// Hiring rule 3: a fact counts only if a visitor can read it in the first viewport.
// Beyond Playwright's toBeVisible this rejects text that is transparent (opacity 0
// on the element or an ancestor), clipped away by clip-path, moved out of the viewport
// inside a visible parent, or below 4.5:1 contrast against its effective background.

export type ViewportOptions = { text?: string; timeout?: number };
type Rect = { x: number; y: number; width: number; height: number };
type Report = { problems: string[]; seen: string };

export async function inFirstViewport(page: Page, sel: string, label: string, opts: ViewportOptions = {}) {
  const el = page.locator(sel).first();
  await expect(el, `${label} not visible`).toBeVisible({ timeout: opts.timeout });
  const box = await el.boundingBox();
  const vp = page.viewportSize()!;
  expect(box, `${label} has no box`).toBeTruthy();
  expect(
    box!.width > 2 && box!.height > 2,
    `${label} is clipped to ${box!.width}x${box!.height}`,
  ).toBe(true);
  expect(
    box!.x >= 0 && box!.y >= 0 && box!.x + box!.width <= vp.width && box!.y + box!.height <= vp.height,
    `${label} is outside the first viewport: ${JSON.stringify(box)}`,
  ).toBe(true);

  const report: Report = await el.evaluate(readable, { vw: vp.width, vh: vp.height, text: opts.text ?? null });
  expect(report.problems, `${label} is not readable in the first viewport`).toEqual([]);
  if (opts.text) expect(report.seen, `${label}: readable text`).toContain(opts.text);
}

// Runs in the page. Checks every non-empty text node under the element, skipping
// screen-reader-only text (a box of 1px or less), and returns what it found.
function readable(root: Element, arg: { vw: number; vh: number; text: string | null }): Report {
  const problems: string[] = [];
  const parse = (c: string) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = '1'] = m[1].split(/[\s,/]+/).filter(Boolean);
    return { r: +r, g: +g, b: +b, a: +a };
  };
  type C = { r: number; g: number; b: number; a: number };
  const over = (top: C, base: C): C => ({
    r: top.r * top.a + base.r * (1 - top.a),
    g: top.g * top.a + base.g * (1 - top.a),
    b: top.b * top.a + base.b * (1 - top.a),
    a: 1,
  });
  const lum = (c: C) => {
    const ch = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  };
  const chain = (e: Element | null) => {
    const out: Element[] = [];
    for (let n = e; n; n = n.parentElement) out.push(n);
    return out;
  };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent!.trim()) nodes.push(n as Text);

  let seen = '';
  let checked = 0;
  for (const node of nodes) {
    const parent = node.parentElement!;
    const range = document.createRange();
    range.selectNodeContents(node);
    const r: Rect = range.getBoundingClientRect();
    const pr = parent.getBoundingClientRect();
    if (pr.width <= 1 || pr.height <= 1) continue; // screen-reader-only text
    if (arg.text && !(node.textContent!.includes(arg.text) || arg.text.includes(node.textContent!.trim()))) {
      seen += node.textContent;
      continue;
    }
    checked++;
    const where = JSON.stringify(node.textContent!.trim().slice(0, 24));
    const ancestors = chain(parent);

    let opacity = 1;
    for (const a of ancestors) opacity *= +getComputedStyle(a).opacity;
    if (opacity < 0.1) problems.push(`${where}: opacity ${opacity}`);

    if (r.width <= 2 || r.height <= 2) problems.push(`${where}: text box ${r.width}x${r.height}`);
    if (r.x < 0 || r.y < 0 || r.x + r.width > arg.vw || r.y + r.height > arg.vh)
      problems.push(`${where}: text outside the viewport ${JSON.stringify({ x: r.x, y: r.y, w: r.width, h: r.height })}`);

    // clip-path: the text has to be hit-testable at points across its box.
    if (ancestors.some((a) => getComputedStyle(a).clipPath !== 'none')) {
      const y = r.y + r.height / 2;
      const missed = [0.1, 0.3, 0.5, 0.7, 0.9].filter((f) => {
        const hits = document.elementsFromPoint(r.x + r.width * f, y);
        return !hits.some((h) => h === parent || parent.contains(h));
      });
      if (missed.length) problems.push(`${where}: clipped by clip-path`);
    }

    // Contrast: text colour over the stacked backgrounds, page white at the bottom.
    const layers: C[] = [];
    let image = false;
    for (const a of ancestors) {
      const s = getComputedStyle(a);
      if (s.backgroundImage !== 'none') image = true;
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a >= 1) break;
    }
    if (!image) {
      let bg: C = { r: 255, g: 255, b: 255, a: 1 };
      for (const l of layers.reverse()) bg = over(l, bg);
      const fg0 = parse(getComputedStyle(parent).color)!;
      const fg = over({ ...fg0, a: fg0.a * opacity }, bg);
      const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
      const ratio = (hi + 0.05) / (lo + 0.05);
      if (ratio < 4.5) problems.push(`${where}: contrast ${ratio.toFixed(2)}:1`);
    }
    seen += node.textContent;
  }
  if (nodes.length && !checked) problems.push('no readable text');
  return { problems, seen: seen.replace(/\s+/g, ' ') };
}
