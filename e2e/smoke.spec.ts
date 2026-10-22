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
        const email = page.locator('a:text-matches("\\\\[at\\\\].*\\\\[dot\\\\]")');
        await expect(email, `no obfuscated email link on ${route.path}`).not.toHaveCount(0);
        await expect(email.first(), 'obfuscated email link not visible').toBeVisible();
        // Hold the element itself: its text changes once the address is assembled.
        const link = (await email.first().elementHandle())!;
        expect(await link.getAttribute('aria-label'), 'static email link has no "Email" label').toBe('Email');
        await link.focus();
        await link.click();
        expect(await link.getAttribute('href')).toMatch(/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}$/);
        expect(await link.textContent()).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/);
        expect(await link.getAttribute('aria-label'), 'aria-label left on the written address').toBeNull();
      }

      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
}
