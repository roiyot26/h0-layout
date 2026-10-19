import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { routes } from '../scripts/routes.mjs';

for (const route of routes) {
  test(`axe: ${route.path}`, async ({ page }) => {
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
