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

// Fonts (M1-06, CLS 0): with the woff2 files held back 3 s, the page lays out in the
// metric-matched fallbacks and nothing moves when the fonts arrive (they're
// font-display: optional, so a late font is kept for the next view, not swapped in).
const platformFont = async (page: import('@playwright/test').Page, selector: string) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  // Only the downloaded faces count, not a copy that happens to be installed locally.
  return fonts.filter((f) => f.isCustomFont).map((f) => f.familyName).join(', ');
};

for (const width of [390, 360]) {
  for (const path of ['/', '/now/kage-diagram']) {
    test(`fonts held back 3 s: ${path} @ ${width} has CLS 0`, async ({ page }) => {
      await page.setViewportSize({ width, height: 780 });
      await page.addInitScript(() => {
        (window as unknown as { cls: number }).cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
            if (!e.hadRecentInput) (window as unknown as { cls: number }).cls += e.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });
      let pending = 0;
      await page.route('**/*.woff2', async (r) => {
        pending++;
        await new Promise((done) => setTimeout(done, 3000));
        await r.continue();
        pending--;
      });
      await page.goto(path === '/' ? './' : path.replace(/^\//, '') + '/', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      await expect.poll(() => pending).toBe(0);
      await page.waitForTimeout(1000);
      const cls = await page.evaluate(() => (window as unknown as { cls: number }).cls);
      expect(cls).toBe(0);
    });
  }
}

// ...and when the fonts arrive in time they are the ones used.
test('the web fonts are used when they load in time', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => document.fonts.ready);
  expect(await platformFont(page, '.facts h1')).toContain('Barlow Semi Condensed');
  expect(await platformFont(page, '.board td.c-rem')).toContain('IBM Plex Mono');
});

// M1-03: with JS on too, the first Tab stop on every route is Skip.
test('the first Tab focuses Skip on every route (JS on)', async ({ page }) => {
  for (const route of pages) {
    await page.goto(route.path === '/' ? './' : route.path.replace(/^\//, '') + '/');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return { cls: el?.className ?? '', text: el?.textContent?.trim() ?? '' };
    });
    expect(focused.cls, route.path).toBe('corner skip');
    expect(focused.text, route.path).toBe(route.path === '/timetable' ? 'Skip to content' : 'Skip to the facts');
  }
});

// #21: the home CV button gets the same hover cue as the other contact links.
test('the home CV button changes its border on hover', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  const cv = page.locator('.home .contact-links a[download]');
  const border = () => cv.evaluate((e) => getComputedStyle(e).borderTopColor);
  const rest = await border();
  await cv.hover();
  await expect.poll(border).not.toBe(rest);
  expect(await border()).toBe('rgb(242, 238, 228)');
});
