import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { routes } from '../scripts/routes.mjs';

// Every route at both checked widths: a violation that only shows on a phone or only
// on a wide screen must still fail.
const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
] as const;

for (const route of routes) {
  for (const vp of viewports) {
    test(`axe: ${route.path} @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const response = await page.goto(route.path === '/' ? './' : route.path.replace(/^\//, ''), {
        waitUntil: 'networkidle',
      });
      expect(response, `no response for ${route.path}`).toBeTruthy();
      expect(response!.status()).toBe(200);

      const results = await new AxeBuilder({ page }).analyze();
      const violations = results.violations.map((v) => {
        const nodes = v.nodes
          .slice(0, 5)
          .map((n) => `    - ${n.target.join(' ')}: ${n.failureSummary?.split('\n')[0] ?? ''}`)
          .join('\n');
        return `${v.id} [${v.impact}]: ${v.help} (${v.nodes.length})\n${nodes}`;
      });
      expect(violations, violations.join('\n\n')).toEqual([]);
    });
  }
}
