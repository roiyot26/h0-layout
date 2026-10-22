import { test, expect } from '@playwright/test';
import { pages, routes } from '../scripts/routes.mjs';

// The M1 site with JS off: the CV download, the board's hit areas and order (UX
// ruling 5, fix F7), the email fallback and the 360 px minimum width.

test('/cv.pdf is served as a PDF within its cap', async ({ request }) => {
  const cv = routes.find((r) => r.path === '/cv.pdf')!;
  const res = await request.get('cv.pdf');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/pdf');
  const body = await res.body();
  expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(body.length).toBeLessThanOrEqual(cv.cap * 1024);
});

test('every CV link downloads /cv.pdf under the site base', async ({ page }) => {
  await page.goto('./');
  const cvLinks = page.locator('a[href$="cv.pdf"]');
  expect(await cvLinks.count()).toBeGreaterThan(0);
  const base = new URL(page.url()).pathname;
  for (const a of await cvLinks.all()) {
    expect(await a.getAttribute('href')).toBe(`${base}cv.pdf`);
    expect(await a.getAttribute('download')).toBe('Roi-Yotvat-CV.pdf');
  }
});

for (const vp of [
  { width: 1440, height: 900, min: 44 },
  { width: 390, height: 844, min: 48 },
  { width: 360, height: 780, min: 48 },
]) {
  test.describe(`board @ ${vp.width}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`each board row is a link with a ≥${vp.min} px hit area`, async ({ page }) => {
      await page.goto('./');
      const rows = page.locator('.board tbody tr:not(.status)');
      await expect(rows).toHaveCount(6);
      for (const row of await rows.all()) {
        const link = row.locator('a');
        await expect(link).toHaveCount(1);
        await row.scrollIntoViewIfNeeded();
        const box = (await row.boundingBox())!;
        expect(box.height, `row height for ${await link.textContent()}`).toBeGreaterThanOrEqual(vp.min - 0.5);
        // The link's hit area covers the row: a click at the row's right edge lands on it.
        const hit = await page.evaluate(
          ([x, y]) => document.elementFromPoint(x!, y!)?.closest('a')?.textContent ?? null,
          [box.x + box.width - 4, box.y + box.height / 2],
        );
        expect(hit).toBe(await link.textContent());
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test('first-screen facts come before the board, in the DOM and on screen', async ({ page }) => {
      await page.goto('./');
      const facts = (await page.locator('.facts').boundingBox())!;
      const board = (await page.locator('.board').boundingBox())!;
      expect(facts.y + facts.height).toBeLessThanOrEqual(board.y + 1);
      const order = await page.evaluate(
        () => document.querySelector('.facts')!.compareDocumentPosition(document.querySelector('.board')!) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(order).toBeTruthy();
    });
  });
}

test.describe('360 px minimum width', () => {
  test.use({ viewport: { width: 360, height: 780 } });
  for (const route of pages) {
    test(`${route.path} has no horizontal overflow at 360`, async ({ page }) => {
      await page.goto(route.path === '/' ? './' : route.path.replace(/^\//, ''));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});

for (const path of ['/', '/contact']) {
  test(`email fallback on ${path} reads name [at] domain [dot] tld with no mail link`, async ({ page }) => {
    await page.goto(path === '/' ? './' : path.replace(/^\//, ''));
    const a = page.locator('a[data-u]').first();
    await expect(a).toHaveText(/^\S+ \[at\] \S+ \[dot\] \S+$/);
    await expect(a).toHaveAttribute('aria-label', 'Email');
    expect(await a.getAttribute('href')).not.toMatch(/^mailto:/i);
    expect(await page.locator('a[href^="mailto:" i]').count()).toBe(0);
  });
}

test('Skip to the facts is on every page and goes to /timetable', async ({ page }) => {
  for (const route of pages) {
    await page.goto(route.path === '/' ? './' : route.path.replace(/^\//, ''));
    const skip = page.getByRole('link', { name: 'Skip to the facts' });
    await expect(skip, route.path).toBeVisible();
    expect(await skip.getAttribute('href')).toMatch(/\/timetable\/$/);
  }
});
