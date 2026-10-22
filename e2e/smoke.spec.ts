import { test, expect } from '@playwright/test';
import { pages } from '../scripts/routes.mjs';

// JS on: no page errors or console errors on any route at 1440 and 390, and on the home
// and contact pages every email link reads "Email" and becomes a working mail link
// when it's clicked, without the address ever being shown.

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
        // Owner ruling: with JS on every email link reads just "Email", and the address
        // only ever goes into the href. The expected address is rebuilt here from the
        // link's own reversed parts, so this file never holds it.
        const email = page.locator('a[data-u]');
        await expect(email, `no email link on ${route.path}`).not.toHaveCount(0);
        for (const a of await email.all()) {
          await expect(a).toHaveText('Email', { useInnerText: true });
          await expect(a).toHaveAccessibleName('Email');
          expect(await a.getAttribute('aria-label')).toBeNull();
        }
        const link = email.first();
        await expect(link).toBeVisible();
        const expected = await link.evaluate((el: HTMLAnchorElement) => {
          const f = (s?: string) => [...(s ?? '')].reverse().join('');
          return `${f(el.dataset.u)}${String.fromCharCode(64)}${f(el.dataset.d)}.${f(el.dataset.t)}`;
        });
        expect(expected.split(String.fromCharCode(64)).length, 'built address has one at sign').toBe(2);
        await link.focus();
        await link.click();
        expect((await link.getAttribute('href')) === `mailto:${expected}`, 'href is the mail link to the built address').toBe(true);
        await expect(link).toHaveText('Email', { useInnerText: true });
        const shown = await page.evaluate(() => document.body.innerText + document.body.textContent);
        expect(shown.includes(expected), 'the address is shown as text').toBe(false);
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
