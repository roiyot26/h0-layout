import { test, expect, type Page } from '@playwright/test';
import { inFirstViewport } from './hiring-helpers';

// Planted pages for the hiring helpers. Each plant hides a fact in a way the old
// visibility check let through; the helper has to reject every one of them.

test.use({ viewport: { width: 1440, height: 900 } });

const page_ = (body: string, style = '') =>
  `<!doctype html><html lang="en"><head><title>Plant</title><style>
  body { margin: 0; background: #ffffff; color: #111111; font: 24px/1.4 sans-serif; }
  ${style}</style></head><body><main>${body}</main></body></html>`;

async function load(page: Page, body: string, style = '') {
  await page.setContent(page_(body, style), { waitUntil: 'domcontentloaded' });
}

test.describe('inFirstViewport plants', () => {
  test('control: a plain visible fact passes', async ({ page }) => {
    await load(page, '<h1>Roi Yotvat</h1><p id="fact">Full-stack developer</p>');
    await inFirstViewport(page, '#fact', 'fact');
  });

  const plants: [string, string, RegExp][] = [
    ['opacity 0 on the element', '<p id="fact" style="opacity:0">Full-stack developer</p>', /opacity/],
    ['opacity 0 on an ancestor', '<div style="opacity:0"><p id="fact">Full-stack developer</p></div>', /opacity/],
    ['clip-path inset(50%)', '<p id="fact" style="clip-path:inset(50%)">Full-stack developer</p>', /clip-path/],
    [
      'clip-path circle(0) on an ancestor',
      '<div style="clip-path:circle(0)"><p id="fact">Full-stack developer</p></div>',
      /clip-path/,
    ],
    [
      'name off-screen inside a visible h1',
      '<h1 id="fact">Hello <span style="position:relative;left:-5000px">Roi Yotvat</span> here</h1>',
      /outside the viewport/,
    ],
    ['text colour equal to the background', '<p id="fact" style="color:#ffffff">Full-stack developer</p>', /contrast/],
    ['contrast below 4.5:1', '<p id="fact" style="color:#949494">Full-stack developer</p>', /contrast/],
    [
      'low contrast against an ancestor background',
      '<div style="background:#202020"><p id="fact" style="color:#555555">Full-stack developer</p></div>',
      /contrast/,
    ],
  ];
  for (const [name, body, reason] of plants) {
    test(`rejects ${name}`, async ({ page }) => {
      await load(page, body);
      await expect(inFirstViewport(page, '#fact', 'fact', { timeout: 1000 })).rejects.toThrow(reason);
    });
  }

  test('control: a visually-hidden helper inside a fact is ignored', async ({ page }) => {
    await load(
      page,
      '<a id="fact" href="#">CV <span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">(PDF)</span></a>',
    );
    await inFirstViewport(page, '#fact', 'fact');
  });

  test('control: the name check reads the name inside the h1', async ({ page }) => {
    await load(page, '<h1 id="fact">Roi Yotvat</h1>');
    await inFirstViewport(page, '#fact', 'name', { text: 'Roi Yotvat' });
  });
});
