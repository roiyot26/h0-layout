import type { Page, TestInfo } from '@playwright/test';

/** How long one drain may wait, on top of the test's own budget. */
export const DRAIN_CAP_MS = Number(process.env.DRAIN_CAP_MS) || 120_000;

/**
 * Waits until the GPU process has drawn every frame the page has queued. On Playwright's
 * clock the page submits frames much faster than SwiftShader draws them, and the backlog
 * then drains at the next GPU sync, often inside the next test. Each world test drains its
 * own frames here, so its time stays with the test that made them.
 *
 * The wait gets its own budget (DRAIN_CAP_MS, added to the test's timeout), is logged as
 * `[drain] <test> <ms> ms`, and fails the test by name if the GPU is still busy at the cap.
 */
export async function drainGpu(page: Page, testInfo: TestInfo): Promise<void> {
  if (page.isClosed()) return;
  testInfo.setTimeout(testInfo.timeout + DRAIN_CAP_MS + 5_000);
  const name = testInfo.titlePath.slice(1).join(' › ');
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const capped = new Promise<'cap'>((resolve) => {
    timer = setTimeout(() => resolve('cap'), DRAIN_CAP_MS);
  });
  const drawn = page
    .evaluate(() => {
      for (const c of document.querySelectorAll('canvas')) {
        const gl = c.getContext('webgl2');
        if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      }
    })
    .then(() => 'drawn' as const, () => 'drawn' as const);
  const how = await Promise.race([drawn, capped]);
  clearTimeout(timer);
  const ms = Date.now() - start;
  console.log(`[drain] ${name} ${ms} ms`);
  if (how === 'cap') throw new Error(`[drain] ${name}: the GPU was still drawing this test's frames after ${ms} ms (cap ${DRAIN_CAP_MS} ms)`);
}

type Drawable = { __h0World?: { renderer: { render: (...a: unknown[]) => void } }; __h0Draw?: (...a: unknown[]) => void };

/**
 * Switches the world's draw calls off (or back on) for a test whose checks read only the
 * trace: the rig still steps every frame and the trace still records poses, opacities,
 * labels and DOF, but SwiftShader draws nothing, so no backlog builds up. The render
 * counters in the trace read zero while drawing is off, so tests that check counts,
 * luminance or pixels keep drawing.
 */
export async function setDraw(page: Page, on: boolean): Promise<void> {
  await page.evaluate((on) => {
    const w = window as unknown as Drawable;
    const r = w.__h0World!.renderer;
    if (!on && !w.__h0Draw) {
      w.__h0Draw = r.render;
      r.render = () => undefined;
    } else if (on && w.__h0Draw) {
      r.render = w.__h0Draw;
      w.__h0Draw = undefined;
    }
  }, on);
}
