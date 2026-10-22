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
    await expect(a.locator('span[aria-hidden="true"]')).toHaveText(/^\S+[ \u00a0]\[at\] \S+ \[dot\] \S+$/); // /contact keeps a no-break space before [at]
    await expect(a).toHaveAccessibleName('Email');
    expect(await a.getAttribute('href')).not.toMatch(/^mailto:/i);
    expect(await page.locator('a[href^="mailto:" i]').count()).toBe(0);
  });
}

test('Skip to the facts is on every page and goes to /timetable', async ({ page }) => {
  for (const route of pages.filter((r) => r.path !== '/timetable')) {
    await page.goto(route.path === '/' ? './' : route.path.replace(/^\//, ''));
    const skip = page.getByRole('link', { name: 'Skip to the facts' });
    await expect(skip, route.path).toBeVisible();
    expect(await skip.getAttribute('href')).toMatch(/\/timetable\/$/);
  }
});

// On /timetable itself Skip would only reload the page, so it skips to the content.
test('on /timetable Skip to content moves focus to main', async ({ page }) => {
  await page.goto('timetable');
  const skip = page.locator('.topbar .skip');
  await expect(skip).toHaveText('Skip to content');
  expect(await skip.getAttribute('href')).toBe('#main');
  await expect(page.locator('main#main')).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('main');
});

// M1-10: the /timetable section anchors land clear of the sticky top bar.
for (const id of ['tt-now', 'tt-workshop']) {
  test(`/timetable#${id} lands below the top bar`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`timetable/#${id}`);
    const bar = await page.locator('.topbar').boundingBox();
    const target = await page.locator(`#${id}`).boundingBox();
    expect(target!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height);
  });
}

// M1-08: these links were 20-25 px tall; each is now a 44 px target.
for (const [path, selector, count] of [
  ['workshop/blender', '.crumb a', 1],
  ['timetable', '.st-workshop .part h3 a', 4],
  ['behind-the-scenes', '.src a', 1],
] as const) {
  test(`${selector} on /${path} is at least 44 px tall`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    const links = page.locator(selector);
    await expect(links).toHaveCount(count);
    for (const a of await links.all()) expect((await a.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
}

// M1-08: the /contact links sit at least 8 px apart.
for (const width of [1440, 390]) {
  test(`/contact links are at least 8 px apart @ ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('contact');
    const boxes = await page.locator('.contact a').evaluateAll((as) => as.map((a) => a.getBoundingClientRect()).map((r) => ({ top: r.top, bottom: r.bottom })));
    expect(boxes.length).toBeGreaterThan(1);
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].top - boxes[i - 1].bottom).toBeGreaterThanOrEqual(8);
  });
}

// M1-09: no horizontal scroll on the home page down to 320 px.
test('/ has no horizontal overflow @ 320', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto('./');
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(320);
});

// M1-03: Skip is the first Tab stop on every page, and sits left of Departures.
test('the first Tab focuses Skip on every page', async ({ page }) => {
  for (const route of pages) {
    await page.goto(route.path === '/' ? './' : route.path.replace(/^\//, ''));
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.className ?? '');
    expect(focused, route.path).toBe('corner skip');
    const skip = await page.locator('.topbar .skip').boundingBox();
    const departures = await page.locator('.topbar .corner:not(.skip)').boundingBox();
    expect(skip!.x, route.path).toBeLessThan(departures!.x);
  }
});

// Design ruling 1 (WCAG 2.4.11): walking back up /timetable with Shift+Tab, no focused
// link may sit under the sticky top bar.
for (const vp of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`Shift+Tab on /timetable @ ${vp.width} never hides focus under the top bar`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto('timetable');
    const hidden: string[] = [];
    for (let i = 0; i < 200; i++) {
      await page.keyboard.press('Shift+Tab');
      const r = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const bar = document.querySelector('.topbar')!;
        if (!el || el === document.body) return { done: true, inBar: false, covered: false, name: '' };
        const a = el.getBoundingClientRect();
        const b = bar.getBoundingClientRect();
        return { done: false, inBar: bar.contains(el), covered: a.top < b.bottom - 0.5, name: (el.textContent ?? '').trim().slice(0, 40) };
      });
      if (r.done || r.inBar) break;
      if (r.covered) hidden.push(r.name);
    }
    expect(hidden, `focused under the bar: ${hidden.join(' | ')}`).toEqual([]);
  });
}

// Arrows are hidden inline SVG, so they're not part of any link's name.
test('link names carry no arrow', async ({ page }) => {
  await page.goto('behind-the-scenes');
  await expect(page.getByRole('link', { name: 'Source on GitHub', exact: true })).toHaveCount(1);
  await page.goto('now/kage-diagram');
  await expect(page.getByRole('link', { name: 'Back to the City', exact: true })).toHaveCount(1);
  await page.goto('');
  const names = await page.locator('a').evaluateAll((as) => as.map((a) => a.textContent ?? ''));
  expect(names.filter((n) => /[↗←→]/.test(n))).toEqual([]);
});
