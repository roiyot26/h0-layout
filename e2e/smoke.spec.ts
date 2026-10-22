import { test, expect } from '@playwright/test';
import { pages } from '../scripts/routes.mjs';

// JS on: no page errors or console errors on any route at 1440 and 390, and on the home
// and contact pages the obfuscated email assembles into a working address when it's
// clicked.

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
] as const;

for (const route of pages) {
  for (const vp of viewports) {
    test(`smoke: ${route.path} @ ${vp.name} (JS on)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`);
      });

      const response = await page.goto(route.path === '/' ? './' : route.path.replace(/^\//, ''), {
        waitUntil: 'networkidle',
      });
      expect(response, `no response for ${route.path}`).toBeTruthy();
      expect(response!.status()).toBe(200);

      if (route.path === '/' || route.path === '/contact') {
        const email = page.locator('a:has-text("[at]"):has-text("[dot]")');
        await expect(email, `no obfuscated email link on ${route.path}`).not.toHaveCount(0);
        await expect(email.first(), 'obfuscated email link not visible').toBeVisible();
        // Hold the element itself: its text changes once the address is assembled.
        const link = (await email.first().elementHandle())!;
        await expect(email.first(), 'static email link is not named "Email"').toHaveAccessibleName('Email');
        await link.focus();
        await link.click();
        expect(await link.getAttribute('href')).toMatch(/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}$/);
        expect(await link.textContent()).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/);
        expect(await link.getAttribute('aria-label'), 'aria-label left on the written address').toBeNull();
        expect(await link.evaluate((el) => el.querySelector('.visually-hidden, [aria-hidden]')), 'hidden "Email" name left on the written address').toBeNull();
      }

      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
}

// Font swap (M1-06): with the web fonts held back 3 s, the page lays out in the
// metric-matched local fallbacks and swapping the real fonts in barely moves it.
for (const width of [390, 360]) {
  for (const path of ['/', '/now/kage-diagram']) {
    test(`font swap: ${path} @ ${width} has no layout shift`, async ({ page }) => {
      await page.setViewportSize({ width, height: 780 });
      await page.addInitScript(() => {
        (window as unknown as { cls: number }).cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
            if (!e.hadRecentInput) (window as unknown as { cls: number }).cls += e.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.route('**/*.woff2', async (r) => {
        await new Promise((done) => setTimeout(done, 3000));
        await r.continue();
      });
      await page.goto(path === '/' ? './' : path.replace(/^\//, '') + '/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.fonts.status === 'loaded' && [...document.fonts].some((f) => f.family === 'Barlow Semi Condensed' && f.status === 'loaded'));
      await page.waitForTimeout(500);
      const cls = await page.evaluate(() => (window as unknown as { cls: number }).cls);
      expect(cls).toBeLessThan(0.005);
    });
  }
}
