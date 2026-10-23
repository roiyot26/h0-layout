import { test, expect } from '@playwright/test';
import { pages } from '../scripts/routes.mjs';
import { EMPLOYERS } from '../scripts/content-check.mjs';

// Same reading as flagsFromEnv: SHOW_COMPANIES=0/false/off/no builds the names-off site.
const namesOff = /^(0|false|off|no)$/i.test(process.env.SHOW_COMPANIES ?? '');
const namesIn = (text: string) => EMPLOYERS.filter((n) => text.toLowerCase().includes(n.toLowerCase()));

const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
] as const;

for (const route of pages) {
  for (const vp of viewports) {
    test.describe(`${route.path} @ ${vp.name} (JS off)`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('renders its facts, no overflow, no console errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        page.on('console', (msg) => {
          if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
        });

        const response = await page.goto(route.path === '/' ? './' : route.path.replace(/^\//, ''), {
          waitUntil: 'domcontentloaded',
        });
        expect(response, `no response for ${route.path}`).toBeTruthy();
        expect(response!.status(), `status for ${route.path}`).toBe(200);

        await expect(page).toHaveTitle(route.title);
        const h1 = page.locator('h1');
        await expect(h1).toHaveCount(1);
        await expect(h1).toHaveText(route.h1);

        const bodyText = await page.locator('body').innerText();
        for (const fact of route.facts) {
          // With names off, a fact that names an employer is meant to be gone.
          if (namesOff && namesIn(fact).length) continue;
          expect(bodyText, `missing fact ${JSON.stringify(fact)}`).toContain(fact);
        }
        if (namesOff) {
          expect(namesIn(bodyText), 'employer names on a names-off build').toEqual([]);
        }

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
          };
        });
        expect(
          overflow.scrollWidth,
          `horizontal overflow: scrollWidth ${overflow.scrollWidth} > clientWidth ${overflow.clientWidth}`,
        ).toBeLessThanOrEqual(overflow.clientWidth + 1);

        expect(errors, errors.join('\n')).toEqual([]);
      });
    });
  }
}
