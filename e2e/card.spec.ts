// The trace card (M2 spec §5.4): ?trace=1&card=1 runs the measurement script, then
// shows the median run's numbers with a Copy results button. Readable at 390 (Roi
// screenshots it on his phone). Here the script runs on Playwright's clock, so the
// frame times are the virtual 60 Hz ones; the layout checks use a fixed result.
import { type Page, expect, test } from '@playwright/test';

const DESKTOP = { width: 1440, height: 900 } as const;
const PHONE = { width: 390, height: 844 } as const;

interface Stats {
  frames: number;
  fps: number;
  p50: number;
  p95: number;
  max: number;
  dropped: number;
  over33: number;
}
interface Result {
  when: string;
  viewport: { width: number; height: number };
  dpr: number;
  tier: string;
  gpu: string;
  refreshMs: number;
  runs: Stats[];
  median: Stats;
}
type W = { __h0World: { tier: string; result?: Result; card(r: Result): HTMLElement; rig: { mode: string; dest: string; riding: string | null } } };

const LABELS = ['Median fps', 'Frame time p50', 'Frame time p95', 'Frame time max', 'Dropped frames', 'Frames > 33.4 ms', 'Tier', 'DPR used', 'Viewport', 'GPU'];

async function open(page: Page, viewport: { width: number; height: number }, query: string) {
  await page.setViewportSize(viewport);
  await page.clock.install();
  await page.goto(`./?3d=1&trace=1${query}`);
  await page.waitForFunction(() => Boolean((window as unknown as Partial<W>).__h0World?.rig));
  await page.clock.runFor(200);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
}

test.describe('trace card', () => {
  test('&card=1 runs 3 × 20 s of hops and ride, then shows the median; Copy puts the JSON on the clipboard', async ({ page, context }) => {
    test.setTimeout(400_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page, PHONE, '&card=1');
    await expect(page.locator('.trace-status')).toContainText(/Measuring the preview · \d+ s left/);
    const seen = new Set<string>();
    let rode = false;
    for (let i = 0; i < 90 && !(await page.locator('.trace-card').count()); i++) {
      await page.clock.runFor(1000);
      const r = await page.evaluate(() => {
        const g = (window as unknown as W).__h0World.rig;
        return [g.dest, g.riding] as const;
      });
      seen.add(r[0]);
      rode ||= r[1] === 'chase';
    }
    await expect(page.locator('.trace-card')).toBeVisible();
    expect(await page.locator('.trace-status').count()).toBe(0);
    expect([...seen].sort()).toEqual(['bootcamp', 'campus', 'city', 'overview', 'workshop']);
    expect(rode).toBe(true);
    const r = (await page.evaluate(() => (window as unknown as W).__h0World.result))!;
    expect(r.runs).toHaveLength(3);
    // On the virtual clock every frame is one 60 Hz step.
    expect(r.refreshMs).toBeCloseTo(16.67, 1);
    expect(r.median.frames).toBeGreaterThan(1150);
    expect(r.median.p50).toBeLessThanOrEqual(17);
    expect(r.median.over33).toBe(0);
    expect(r).toMatchObject({ tier: 'phone', viewport: { width: 390, height: 844 } });
    expect(r.dpr).toBeGreaterThan(0);
    expect(r.gpu.length).toBeGreaterThan(0);
    // The card shows every number, and the history was not touched.
    const text = await page.locator('.trace-card').innerText();
    for (const l of LABELS) expect(text).toContain(l);
    expect(text).toContain(`${r.median.p95} ms`);
    expect(text).toContain('390 × 844');
    expect(new URL(page.url()).pathname).toMatch(/\/h0-layout\/$/);
    await page.locator('.trace-copy').click();
    await expect(page.locator('.trace-copy')).toHaveText('Copied');
    const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText())) as Result;
    expect(copied).toEqual(r);
    await page.locator('.trace-close').click();
    expect(await page.locator('.trace-card').count()).toBe(0);
  });

  for (const [name, vp] of [
    ['1440', DESKTOP],
    ['390', PHONE],
  ] as const) {
    test(`the card fits and reads at ${name}: in the viewport, no overflow, ≥ 14 px text, 48 px buttons`, async ({ page }) => {
      await open(page, vp, '');
      const fixture: Result = {
        when: '2026-10-23T09:00:00.000Z',
        viewport: { width: vp.width, height: vp.height },
        dpr: 2,
        tier: name === '390' ? 'phone' : 'desktop',
        gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)',
        refreshMs: 8.33,
        runs: [],
        median: { frames: 2391, fps: 119.8, p50: 8.3, p95: 9.1, max: 41.6, dropped: 4, over33: 1 },
      };
      fixture.runs = [fixture.median, fixture.median, fixture.median];
      await page.evaluate((r) => (window as unknown as W).__h0World.card(r), fixture);
      const card = page.locator('.trace-card');
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
      expect(await card.evaluate((el) => el.scrollHeight <= el.clientHeight && el.scrollWidth <= el.clientWidth)).toBe(true);
      const sizes = await card.locator('dt, dd').evaluateAll((els) => els.map((e) => Number.parseFloat(getComputedStyle(e).fontSize)));
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
      for (const b of await card.locator('button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(48);
      const text = await card.innerText();
      for (const l of LABELS) expect(text).toContain(l);
      for (const v of ['119.8', '8.3 ms', '9.1 ms', '41.6 ms', '4 (at 120 Hz)', '1 of 2391', 'Apple M3 Pro', `${vp.width} × ${vp.height}`]) expect(text).toContain(v);
    });
  }
});
