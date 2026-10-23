import type { Page } from '@playwright/test';

/**
 * Waits until the GPU process has drawn every frame the page has queued. On Playwright's
 * clock the page submits frames much faster than SwiftShader draws them, and the backlog
 * then drains at the next GPU sync, often inside the next test. Each world test drains its
 * own frames here, so its time (and any timeout) stays with the test that made them.
 */
export async function drainGpu(page: Page): Promise<void> {
  if (page.isClosed()) return;
  await page
    .evaluate(() => {
      for (const c of document.querySelectorAll('canvas')) {
        const gl = c.getContext('webgl2');
        if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      }
    })
    .catch(() => undefined);
}
