import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pages, routes, outFile } from '../scripts/routes.mjs';
import { bannedWords, checkSite, CV_PATH, cvText, emailFromContent, EMPLOYERS, readable } from '../scripts/content-check.mjs';
import { benches, email, kage, links, stations, t } from '../src/site/content';
import { flagsFromEnv, renderSite, type SiteOptions } from '../src/site/pages';
import experience from '../cv/experience.json';

// The content doc's §6 URL table (v4.1), in its order. routes.mjs must equal it.
const CONTENT_DOC_URLS = [
  '/',
  '/timetable',
  '/bootcamp',
  '/teaching',
  '/now',
  '/now/kage-diagram',
  '/workshop',
  '/workshop/virtual-garden',
  '/workshop/chord-cycle-open',
  '/workshop/blender',
  '/workshop/doodle-reborn',
  '/behind-the-scenes',
  '/cv.pdf',
  '/contact',
];

const opts = (over: Partial<SiteOptions> = {}): SiteOptions => ({
  base: '/h0-layout/',
  origin: 'https://roiyot26.github.io',
  showCompanies: true,
  showDoodleRepo: false,
  noindex: false,
  scripts: ['/h0-layout/assets/main.js'],
  styles: ['/h0-layout/assets/main.css'],
  ...over,
});

const address = emailFromContent();

describe('routes', () => {
  it('equal the content doc URL table: 13 pages plus /cv.pdf', () => {
    expect(routes.map((r) => r.path)).toEqual(CONTENT_DOC_URLS);
    expect(pages).toHaveLength(13);
    expect(routes.filter((r) => r.file).map((r) => r.path)).toEqual(['/cv.pdf']);
  });

  it('have no case, work, projects, facts, credits or time-machine routes', () => {
    for (const r of routes) expect(r.path).not.toMatch(/\/(work|projects|facts|credits|time-machine)\b|case/);
  });

  it('each render with their own title and one h1', () => {
    const site = renderSite(opts());
    const titles = new Set<string>();
    for (const r of pages) {
      const html = site.get(outFile(r.path))!;
      expect(html, r.path).toBeTruthy();
      expect(html).toContain(`<title>${r.title.replace(/&/g, '&amp;')}</title>`);
      const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1]);
      expect(h1s, r.path).toEqual([r.h1]);
      titles.add(r.title);
      for (const fact of r.facts) expect(readable(html), `${r.path}: ${fact}`).toContain(fact);
    }
    expect(titles.size).toBe(pages.length);
  });

  it('use the site base everywhere, with canonical URLs on the site origin', () => {
    const site = renderSite(opts({ base: '/pr-7/', scripts: ['/pr-7/assets/main.js'], styles: ['/pr-7/assets/main.css'] }));
    const home = site.get('index.html')!;
    expect(home).toContain('<link rel="canonical" href="https://roiyot26.github.io/pr-7/" />');
    expect(home).toContain('href="/pr-7/cv.pdf" download="Roi-Yotvat-CV.pdf"');
    expect(home).not.toMatch(/href="\/(?!pr-7\/)/);
  });
});

describe('content and honesty, both company states', () => {
  for (const showCompanies of [true, false]) {
    it(`passes the content checks with SHOW_COMPANIES ${showCompanies ? 'on' : 'off'}`, () => {
      const site = renderSite(opts({ showCompanies }));
      expect(checkSite(site, { showCompanies, email: address })).toEqual([]);
    });
  }

  it('names every employer on the board, station panels and /timetable when on', () => {
    const site = renderSite(opts({ showCompanies: true }));
    const timetable = site.get('timetable/index.html')!;
    for (const name of EMPLOYERS) {
      expect(site.get('index.html')).toContain(name.toUpperCase());
      expect(timetable).toContain(name);
    }
    expect(site.get('teaching/index.html')).toContain('Mister Bit');
  });

  it('names no employer anywhere when off', () => {
    const site = renderSite(opts({ showCompanies: false }));
    for (const [path, text] of site) {
      for (const name of EMPLOYERS) {
        expect(text.toLowerCase(), `${path}: ${name}`).not.toContain(name.toLowerCase());
      }
    }
  });

  it('labels the bootcamp row without repeating the destination', () => {
    const row = (showCompanies: boolean) =>
      renderSite(opts({ showCompanies })).get('index.html')!.match(/<tr><td class="c-time">2021<\/td>.*?<\/tr>/)![0];
    expect(row(true)).toContain('<td class="c-rem">CODING ACADEMY</td>');
    expect(row(false)).toContain('<td class="c-rem">FULL-STACK COURSE</td>');
    expect(row(false)).not.toContain('CODING BOOTCAMP');
  });

  it('reads the company flag from the environment, on by default', () => {
    expect(flagsFromEnv({}).showCompanies).toBe(true);
    expect(flagsFromEnv({ SHOW_COMPANIES: '1' }).showCompanies).toBe(true);
    expect(flagsFromEnv({ SHOW_COMPANIES: '0' }).showCompanies).toBe(false);
    expect(flagsFromEnv({ SHOW_COMPANIES: 'off' }).showCompanies).toBe(false);
  });

  it('flags the dead LinkedIn URL and a raw email address', () => {
    const bad = new Map([['index.html', `<p>Tel Aviv</p><a href="https://www.linkedin.com/in/roi-yotvat">x</a> ${address}`]]);
    const problems = checkSite(bad, { showCompanies: true, email: address });
    expect(problems.join('\n')).toMatch(/dead LinkedIn/);
    expect(problems.join('\n')).toMatch(/raw email/);
  });
});

describe('facts', () => {
  it('match experience.json: years, roles and employers', () => {
    for (const job of experience) {
      const station = stations.find((s) => s.role && t(s.role, true).includes(job.employer));
      expect(station, job.employer).toBeTruthy();
      expect(t(station!.role!, true)).toContain(job.role);
      const [from, to] = job.years.split('–').map((x) => x.trim());
      expect(station!.dates).toContain(from);
      expect(station!.dates).toContain(to === 'now' ? 'now' : to);
    }
  });

  it('keep the Kage numbers exactly as recorded', () => {
    expect(kage.numbers.map((n) => n.value)).toEqual(['410', '16', '2,183', '443']);
    const now = renderSite(opts()).get('now/index.html')!;
    for (const n of kage.numbers) expect(now).toContain(`<dd>${n.value}</dd>`);
    expect(now).not.toMatch(/\d+\s*%/);
  });

  it('use the content doc alt text as the diagram description', () => {
    const page = renderSite(opts()).get('now/kage-diagram/index.html')!;
    expect(page).toContain(`<desc id="kd-desktop">${kage.alt}</desc>`);
    expect(page).toContain(`<desc id="kd-phone">${kage.alt}</desc>`);
    expect(page.match(/<li>/g)?.length).toBe(kage.steps.length);
  });

  it('list exactly four Workshop benches', () => {
    expect(benches.map((b) => b.slug)).toEqual(['virtual-garden', 'chord-cycle-open', 'doodle-reborn', 'blender']);
  });

  it('pin LinkedIn and GitHub exactly', () => {
    expect(links.linkedin).toBe('https://www.linkedin.com/in/roi-yotvat-874ba9209/');
    expect(links.github).toBe('https://github.com/roiyot26');
  });
});

describe('Doodle Reborn repo link', () => {
  const repo = 'https://github.com/roiyot26/draw-reborn';
  it('stays out of the build until SHOW_DOODLE_REPO is on', () => {
    expect(flagsFromEnv({}).showDoodleRepo).toBe(false);
    for (const [, html] of renderSite(opts())) expect(html).not.toContain(repo);
  });
  it('shows on the bench page and /timetable when the flag is on', () => {
    const site = renderSite(opts({ showDoodleRepo: true }));
    expect(site.get('workshop/doodle-reborn/index.html')).toContain(`href="${repo}"`);
    expect(site.get('timetable/index.html')).toContain(`href="${repo}"`);
  });
});

describe('email', () => {
  it('is stored only as reversed parts and never written out', () => {
    const source = readFileSync(new URL('../src/site/content.ts', import.meta.url), 'utf8');
    expect(source.toLowerCase()).not.toContain(address.toLowerCase());
    expect(Object.keys(email)).toEqual(['user', 'domain', 'tld']);
    for (const [path, html] of renderSite(opts())) {
      expect(html.toLowerCase(), path).not.toContain(address.toLowerCase());
      expect(html, path).not.toMatch(/mailto:/i);
    }
  });

  it('names every static email link "Email" for screen readers', () => {
    for (const [path, html] of renderSite(opts())) {
      const links = [...html.matchAll(/<a [^>]*data-u="[^>]*>(.*?)<\/a>/g)];
      for (const [a, inner] of links) {
        expect(a, path).not.toContain('aria-label');
        expect(inner, path).toMatch(/^<span class="visually-hidden">Email<\/span><span aria-hidden="true">.*<\/span>$/);
      }
    }
  });

  it('falls back to "name [at] domain [dot] tld" with JS off', () => {
    const home = renderSite(opts()).get('index.html')!;
    expect(home).toMatch(/<a class="email" href="\/h0-layout\/contact\/" data-u="[^"]+" data-d="[^"]+" data-t="[^"]+"><span class="visually-hidden">Email<\/span><span aria-hidden="true"><span class="rev">[^<]+<\/span> \[at\] \w+ \[dot\] \w+<\/span><\/a>/);
  });
});

describe('banned words: site pages vs the CV', () => {
  const cvLine = 'Built and ran the platform, from first release to maintenance.';

  it('allows "maintenance" in the CV text', () => {
    expect(CV_PATH).toBe('cv.pdf');
    expect(bannedWords('cv.pdf', cvLine)).toEqual([]);
  });

  it('still bans "maintenance" on a site page', () => {
    expect(bannedWords('index.html', cvLine)).toHaveLength(1);
    expect(bannedWords('timetable/index.html', 'Maintenance window')).toHaveLength(1);
    expect(bannedWords('cv/index.html', cvLine)).toHaveLength(1);
  });

  it('still bans SLA and the other words in the CV', () => {
    expect(bannedWords('cv.pdf', 'Kept a 99.9% SLA')).toHaveLength(1);
    expect(bannedWords('cv.pdf', 'on-call rota and maintenance')).toHaveLength(1);
  });

  it('the published CV passes', () => {
    expect(bannedWords('cv.pdf', cvText('public/cv.pdf'))).toEqual([]);
  });
});
