import { test, expect } from '@playwright/test';
import { inFirstViewport } from './hiring-helpers';

// Hiring rules 1 and 3: these facts are fixed here, not in scripts/routes.mjs, so a
// content change can't drop a fact together with its check. Each must be visible inside
// the first viewport at 1440 and 390 with JS off.

const LINKEDIN = 'https://www.linkedin.com/in/roi-yotvat-874ba9209/';
const GITHUB = 'https://github.com/roiyot26';

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
] as const;

for (const vp of viewports) {
  test.describe(`hiring facts on / @ ${vp.name} (JS off)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('name, role, portfolio, CV and contact in the first viewport', async ({ page }) => {
      const response = await page.goto('./', { waitUntil: 'domcontentloaded' });
      expect(response?.status(), 'status for /').toBe(200);

      await expect(page.locator('h1')).toContainText('Roi Yotvat');
      await inFirstViewport(page, 'h1', 'name', { text: 'Roi Yotvat' });
      await inFirstViewport(page, ':is(p,div,span,h2):text-matches("^Full-stack developer")', 'role line');
      await inFirstViewport(page, ':is(p,div,span,h1,h2):text-matches("\\\\bportfolio\\\\b", "i")', '"portfolio"');
      await inFirstViewport(page, 'a[href$="/cv.pdf"]', 'CV link');
      await inFirstViewport(page, `a[href="${LINKEDIN}"]`, 'LinkedIn link');
      await inFirstViewport(page, `a[href="${GITHUB}"]`, 'GitHub link');
      await inFirstViewport(page, 'a:has-text("[at]"):has-text("[dot]")', 'obfuscated email');
    });
  });
}
