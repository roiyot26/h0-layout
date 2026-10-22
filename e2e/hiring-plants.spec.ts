import { test, expect, type Page } from '@playwright/test';
import { inFirstViewport, isPlaceholderHome, PLACEHOLDER_TITLE } from './hiring-helpers';

// Planted pages for the hiring helpers and the placeholder switch. Each plant hides a
// fact or fakes the placeholder in a way the old checks let through, and has to fail.

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

// The placeholder home as it ships on main, used by the switch plants below.
const PLACEHOLDER_BODY = `<h1 class="visually-hidden">Coming soon</h1>
  <table class="board"><caption>Departures</caption>
  <thead><tr><th>Time</th><th>Destination</th><th>Platform</th><th>Remarks</th></tr></thead>
  <tbody><tr><td>--:--</td><td>H0 LAYOUT</td><td>1</td><td>COMING SOON</td></tr></tbody></table>
  <p class="note">The layout is still on the workbench. Please check the timetable again soon. Scale 1:87 (H0).</p>`;
const withTitle = (title: string, body: string) =>
  `<!doctype html><html lang="en"><head><title>${title}</title></head><body><main>${body}</main></body></html>`;
const REAL_HOME = `<h1>Roi Yotvat</h1><p>Full-stack developer</p><p>A portfolio laid out as an H0 railway.</p>
  <a href="/h0-layout/cv.pdf">CV</a> <a href="${'https://www.linkedin.com/in/roi-yotvat-874ba9209/'}">LinkedIn</a>
  <a href="https://github.com/roiyot26">GitHub</a> <a href="#">user [at] example [dot] com</a>`;

test.describe('placeholder switch plants', () => {
  test('control: the real placeholder home is skipped', async ({ page }) => {
    await page.setContent(withTitle(PLACEHOLDER_TITLE, PLACEHOLDER_BODY));
    expect(await isPlaceholderHome(page)).toBe(true);
  });

  test('control: a home with its own title runs the checks', async ({ page }) => {
    await page.setContent(withTitle('Roi Yotvat · portfolio', REAL_HOME));
    expect(await isPlaceholderHome(page)).toBe(false);
  });

  for (const width of [1440, 390]) {
    test(`control: every hiring check passes on a plain real home @ ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.setContent(withTitle('Roi Yotvat · portfolio', REAL_HOME));
      await inFirstViewport(page, 'h1', 'name', { text: 'Roi Yotvat' });
      await inFirstViewport(page, ':is(p,div,span,h2):text-matches("^Full-stack developer")', 'role line');
      await inFirstViewport(page, ':is(p,div,span,h1,h2):text-matches("\\\\bportfolio\\\\b", "i")', '"portfolio"');
      await inFirstViewport(page, 'a[href$="/cv.pdf"]', 'CV link');
      await inFirstViewport(page, 'a[href*="linkedin.com"]', 'LinkedIn link');
      await inFirstViewport(page, 'a[href*="github.com"]', 'GitHub link');
      await inFirstViewport(page, 'a:text-matches("\\\\[at\\\\].*\\\\[dot\\\\]")', 'obfuscated email');
    });
  }

  const plants: [string, string][] = [
    ['real home that kept the placeholder title (S1)', REAL_HOME],
    ['placeholder with a name h1 added', PLACEHOLDER_BODY.replace('Coming soon</h1>', 'Coming soon</h1><h2>Roi Yotvat</h2>')],
    ['placeholder with a contact nav added', `${PLACEHOLDER_BODY}<nav id="contact"><a href="#">Contact</a></nav>`],
    ['placeholder with any other text added', `${PLACEHOLDER_BODY}<p>Now hiring-ready.</p>`],
  ];
  for (const [name, body] of plants) {
    test(`fails on ${name}`, async ({ page }) => {
      await page.setContent(withTitle(PLACEHOLDER_TITLE, body));
      await expect(isPlaceholderHome(page)).rejects.toThrow(/not the placeholder home/);
    });
  }

  test('fails in CI on a non-placeholder build', async ({ page }) => {
    const ci = process.env.CI;
    process.env.CI = 'true';
    try {
      await page.setContent(withTitle(PLACEHOLDER_TITLE, REAL_HOME));
      await expect(isPlaceholderHome(page)).rejects.toThrow(/not the placeholder home \(CI\)/);
    } finally {
      if (ci === undefined) delete process.env.CI;
      else process.env.CI = ci;
    }
  });
});
