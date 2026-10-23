// The M2 checkpoint deliverables (TECH-PLAN §11 M2, M2 spec §7): the shot list, the
// ride and trace card shots and the 20 s capture frames. Runs only with SHOTS_OUT set
// (the handoff folder); the capture frames are encoded to mp4 outside the test.
import { mkdirSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';

const OUT = process.env.SHOTS_OUT;
const DESKTOP = { width: 1440, height: 900 } as const;
const PHONE = { width: 390, height: 844 } as const;
const SIZES = [
  ['1440', DESKTOP],
  ['390', PHONE],
] as const;
type W = {
  __h0World: {
    rig: { mode: string; riding: string | null; unlockCab(): void; rideCam(c: string): void };
    script(o: { warmup?: number; repeats?: number }): Promise<unknown>;
  };
};

test.skip(!OUT, 'SHOTS_OUT not set');

async function open(page: Page, viewport: { width: number; height: number }, path = './', clock = true) {
  await page.setViewportSize(viewport);
  if (clock) await page.clock.install();
  await page.goto(`${path}?3d=1&trace=1`);
  await page.waitForFunction(() => Boolean((window as unknown as Partial<W>).__h0World?.rig));
  if (!clock) return;
  await page.clock.runFor(200);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
  // Parked, labels and DOF settled.
  await page.clock.runFor(1500);
}

test.describe('M2 shot list', () => {
  test.describe.configure({ timeout: 300_000 });
  for (const [name, vp] of SIZES) {
    test(`overview and stations at ${name}`, async ({ page }) => {
      mkdirSync(OUT!, { recursive: true });
      await open(page, vp);
      await page.screenshot({ path: `${OUT}/${name}-overview.png` });
      const ids = name === '1440' ? ['bootcamp', 'teaching', 'now', 'workshop'] : ['now'];
      for (const id of ids) {
        await open(page, vp, `./${id}/`);
        await page.screenshot({ path: `${OUT}/${name}-station-${id}.png` });
      }
    });

    test(`ride chase and cab at ${name}`, async ({ page }) => {
      await open(page, vp);
      await page.click('.ride-start');
      // Chase, 9 s in: cruising down the first straight.
      await page.clock.runFor(9000);
      await page.screenshot({ path: `${OUT}/${name}-ride-chase.png` });
      await page.evaluate(() => {
        const r = (window as unknown as W).__h0World.rig;
        r.unlockCab();
        r.rideCam('cab');
      });
      await page.clock.runFor(1500);
      expect(await page.evaluate(() => (window as unknown as W).__h0World.rig.riding)).toBe('cab');
      await page.screenshot({ path: `${OUT}/${name}-ride-cab.png` });
    });

    test(`trace card at ${name}, real time on the box`, async ({ page }) => {
      test.setTimeout(400_000);
      await open(page, vp, './', false);
      await page.goto('./?3d=1&trace=1&card=1');
      await expect(page.locator('.trace-card')).toBeVisible({ timeout: 300_000 });
      await page.screenshot({ path: `${OUT}/trace-card-${name}.png` });
    });

    test(`20 s capture frames at ${name}`, async ({ page }) => {
      test.setTimeout(1_200_000);
      const dir = `${OUT}/capture-frames-${name}`;
      mkdirSync(dir, { recursive: true });
      await open(page, vp);
      // Started, not awaited: the page clock drives it below.
      await page.evaluate(() => {
        void (window as unknown as W).__h0World.script({ warmup: 0, repeats: 1 });
      });
      // 30 fps: 20 s run + the 0.4 s crossfade home.
      for (let i = 0; i < 612; i++) {
        await page.clock.runFor(1000 / 30);
        await page.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.png` });
      }
    });
  }
});
