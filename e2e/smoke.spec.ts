import { test, expect } from '@playwright/test';
import { routes } from '../scripts/routes.mjs';

// JS on: no page errors or console errors on any route at 1440 and 390, and on the home
// the obfuscated email assembles into a working address when it's clicked.

// Placeholder switch: delete this constant in the PR that replaces the placeholder home,
// so the email check becomes unconditional.
const PLACEHOLDER_TITLE = 'H0 layout · Coming soon';

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
] as const;

for (const route of routes) {
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

      if (route.path === '/' && (await page.title()) !== PLACEHOLDER_TITLE) {
        const email = page.locator('a:text-matches("\\\\[at\\\\].*\\\\[dot\\\\]")');
        await expect(email, 'no obfuscated email link on the home').not.toHaveCount(0);
        await expect(email.first(), 'obfuscated email link not visible').toBeVisible();
        // Hold the element itself: its text changes once the address is assembled.
        const link = (await email.first().elementHandle())!;
        await link.focus();
        await link.click();
        expect(await link.getAttribute('href')).toMatch(/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}$/);
        expect(await link.textContent()).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/);
      }

      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
}
