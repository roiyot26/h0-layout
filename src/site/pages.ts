// Static HTML for every route, generated at build time from content.ts and
// scripts/routes.mjs (TECH-PLAN §1). No framework: plain template strings, escaped.
import { href, pages, routes, outFile, type Route } from '../../scripts/routes.mjs';
import {
  behindTheScenes,
  benches,
  boardExtra,
  email,
  kage,
  links,
  nowParts,
  person,
  stations,
  t,
  type Bench,
  type Station,
  type Text,
} from './content';
import { desktopSvg, phoneSvg } from './kage-svg';

export type SiteOptions = {
  /** SITE_BASE, with a leading and trailing slash. */
  base: string;
  /** Origin for canonical and sitemap URLs. */
  origin: string;
  /** SHOW_COMPANIES: employer names on (default) or the neutral lines. */
  showCompanies: boolean;
  /** SHOW_DOODLE_REPO: off until the public Doodle Reborn repo launches. */
  showDoodleRepo: boolean;
  noindex: boolean;
  /** Built module scripts and stylesheets, as URLs under the base. */
  scripts: string[];
  styles: string[];
};

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const routeFor = (path: string): Route => {
  const r = routes.find((x) => x.path === path);
  if (!r) throw new Error(`no route ${path}`);
  return r;
};

type Ctx = SiteOptions & { u: (path: string) => string; tx: (text: Text) => string };

const external = (url: string, label: string, extra = '') =>
  `<a href="${esc(url)}" rel="noopener"${extra}>${esc(label)}<span class="ext" aria-hidden="true"> ↗</span></a>`;

function emailLink(c: Ctx, cls = 'email', keepSpace = false): string {
  // Static HTML carries the parts reversed. With JS off the visible text reads
  // "name [at] domain [dot] tld" (the name is shown reversed back by CSS); the page
  // script rebuilds the real address on focus, pointerdown or click. Until then the
  // link's accessible name is "Email": the reversed parts are hidden from screen
  // readers and a visually hidden "Email" names the link. (An aria-label would fail
  // axe's label-in-name rule, because the visible text isn't part of the name.)
  // keepSpace puts a no-break space after the reversed name: a plain space right
  // after the right-to-left span gets lost, so "[at]" ran into the name on /contact.
  const gap = keepSpace ? '&nbsp;' : ' ';
  return (
    `<a class="${cls}" href="${c.u('/contact')}" data-u="${email.user}" data-d="${email.domain}" data-t="${email.tld}">` +
    `<span class="visually-hidden">Email</span><span aria-hidden="true"><span class="rev">${email.user}</span>${gap}[at] ${[...email.domain].reverse().join('')} [dot] ${[...email.tld].reverse().join('')}</span></a>`
  );
}

function cvLink(c: Ctx, label: string, cls = ''): string {
  return `<a${cls ? ` class="${cls}"` : ''} href="${c.u('/cv.pdf')}" download="${links.cvDownloadName}">${esc(label)}</a>`;
}

function contactList(c: Ctx): string {
  return `<ul class="contact-links">
  <li>${cvLink(c, 'CV (PDF)')}</li>
  <li>${external(links.linkedin, 'LinkedIn')}</li>
  <li>${external(links.github, 'GitHub')}</li>
  <li>${emailLink(c)}</li>
</ul>`;
}

function layout(c: Ctx, route: Route, body: string, opts: { head?: string; bodyClass?: string } = {}): string {
  const canonical = `${c.origin}${c.u(route.path)}`;
  const current = (p: string) => (route.path === p ? ' aria-current="page"' : '');
  const css = c.styles.map((s) => `<link rel="stylesheet" href="${s}" />`).join('\n    ');
  const js = c.scripts.map((s) => `<script type="module" src="${s}"></script>`).join('\n    ');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />${
      c.noindex ? '\n    <meta name="robots" content="noindex, nofollow" />' : ''
    }
    <title>${esc(route.title)}</title>
    <meta name="description" content="${esc(describe(route))}" />
    <link rel="canonical" href="${canonical}" />
    <meta name="theme-color" content="#16181A" />
    <link rel="icon" href="data:," />
    <link rel="preload" href="${c.base}fonts/plex-mono-500-sub.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="${c.base}fonts/barlow-sc-500-sub.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="${c.base}fonts/barlow-sc-600-sub.woff2" as="font" type="font/woff2" crossorigin />
    ${css}${opts.head ? `\n    ${opts.head}` : ''}
    ${js}
  </head>
  <body class="${opts.bodyClass ?? 'page'}">
    <header class="topbar">
      ${
        route.path === '/timetable'
          ? '<a class="corner skip" href="#main">Skip to content</a>'
          : `<a class="corner skip" href="${c.u('/timetable')}">Skip to the facts</a>`
      }
      <a class="corner" href="${c.base}"${current('/')}>Departures</a>
    </header>
    <main id="main" tabindex="-1">
${body}
    </main>
    <footer class="foot">
      <nav aria-label="Site">
        <a href="${c.u('/timetable')}"${current('/timetable')}>Timetable</a>
        <a href="${c.u('/contact')}"${current('/contact')}>Contact</a>
        ${cvLink(c, 'CV (PDF)')}
        <a href="${c.u('/behind-the-scenes')}"${current('/behind-the-scenes')}>Behind the scenes</a>
      </nav>
    </footer>
  </body>
</html>
`;
}

function describe(route: Route): string {
  switch (route.path) {
    case '/':
      return 'Roi Yotvat, full-stack developer. A portfolio laid out as an H0 model railway: four stations, one per part of his career.';
    case '/timetable':
      return 'Every fact on one plain page: roles, years, Kage, side projects and contact.';
    case '/contact':
      return 'Email, LinkedIn and GitHub for Roi Yotvat.';
    default:
      return `${route.h1}: part of Roi Yotvat's portfolio.`;
  }
}

// ---------- Board ----------

function boardRow(cells: [string, string, string, string], link?: string, cls = ''): string {
  const [time, dest, plat, rem] = cells.map(esc) as [string, string, string, string];
  return `<tr${cls ? ` class="${cls}"` : ''}><td class="c-time">${time}</td><td class="c-dest">${
    link ? link.replace('%s', dest) : dest
  }</td><td class="c-plat">${plat}</td><td class="c-rem">${rem}</td></tr>`;
}

function board(c: Ctx): string {
  const rows = stations.map((s) =>
    boardRow([s.board.time, s.board.dest, s.board.platform, c.tx(s.board.remarks)], `<a href="${c.u(s.path)}">%s</a>`),
  );
  rows.push(
    boardRow(['', boardExtra.cv.dest, '', boardExtra.cv.remarks], `<a href="${c.u('/cv.pdf')}" download="${links.cvDownloadName}">%s</a>`),
    boardRow(['', boardExtra.contact.dest, '', boardExtra.contact.remarks], `<a href="${c.u('/contact')}">%s</a>`),
    boardRow(['', '', '', boardExtra.status], undefined, 'status'),
  );
  return `<div class="board-wrap">
<table class="board">
  <caption>${esc(boardExtra.title)}</caption>
  <colgroup><col class="c-time" /><col class="c-dest" /><col class="c-plat" /><col class="c-rem" /></colgroup>
  <thead><tr><th scope="col" class="c-time">TIME</th><th scope="col" class="c-dest">DESTINATION</th><th scope="col" class="c-plat">PLATFORM</th><th scope="col" class="c-rem">REMARKS</th></tr></thead>
  <tbody>
    ${rows.join('\n    ')}
  </tbody>
</table>
</div>`;
}

// ---------- Pages ----------

function home(c: Ctx): string {
  const r = routeFor('/');
  const body = `<section class="facts" aria-label="About">
  <h1>${esc(person.name)}</h1>
  <p class="role">${esc(person.role)}</p>
  <p class="kicker">${esc(person.kicker)}</p>
  ${person.intro.map((p) => `<p class="intro">${esc(c.tx(p))}</p>`).join('\n  ')}
  ${contactList(c)}
  <p class="langs">${esc(person.languages)}</p>
</section>
${board(c)}`;
  return layout(c, r, body, { bodyClass: 'page home' });
}

function stationNav(c: Ctx, s: Station): string {
  const i = stations.indexOf(s);
  const prev = stations[(i + stations.length - 1) % stations.length]!;
  const next = stations[(i + 1) % stations.length]!;
  return `<nav class="hop" aria-label="Stations">
  <a href="${c.u(prev.path)}" rel="prev"><span class="dim">Previous</span> ${esc(prev.name)}</a>
  <a href="${c.u(next.path)}" rel="next"><span class="dim">Next</span> ${esc(next.name)}</a>
</nav>`;
}

function roleLine(c: Ctx, s: Station): string {
  return s.dates && s.role ? `<p class="dates">${esc(s.dates)} · ${esc(c.tx(s.role))}</p>` : '';
}

function stationHead(s: Station, level: 'h1' | 'h2' | 'h3', id?: string): string {
  return `<p class="sign st-${s.id}" aria-hidden="true">${esc(s.sign)}</p>
  <${level}${id ? ` id="${id}"` : ''}>${esc(s.name)}</${level}>`;
}

function kageBlock(c: Ctx, level: 'h2' | 'h3'): string {
  const sub = level === 'h2' ? 'h3' : 'h4';
  return `<section class="kage" aria-labelledby="kage-${level}">
  <${level} id="kage-${level}">${esc(kage.heading)}</${level}>
  <blockquote><p>“${esc(kage.intro)}”</p></blockquote>
  <${sub}>What matters</${sub}>
  <ul>${kage.matters.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
  <dl class="figures">${kage.numbers
    .map((n) => `<div><dt>${esc(n.label)}</dt><dd>${esc(n.value)}</dd></div>`)
    .join('')}</dl>
  <p class="small">${esc(kage.numbersNote)}</p>
  <p><a class="more" href="${c.u('/now/kage-diagram')}">See how a task moves through Kage</a></p>
</section>`;
}

function nowPartsBlock(c: Ctx, level: 'h2' | 'h3'): string {
  return nowParts
    .map((p) => `<section class="part"><${level}>${esc(p.title.replace(/\.$/, ''))}</${level}><p>${esc(c.tx(p.body))}</p></section>`)
    .join('\n');
}

function benchLinks(c: Ctx, b: Bench): string {
  const list = [...b.links];
  for (const f of b.flagged ?? []) if (f.flag === 'SHOW_DOODLE_REPO' && c.showDoodleRepo) list.unshift(f);
  return list.length
    ? `<ul class="links">${list.map((l) => `<li>${external(l.href, l.label)}</li>`).join('')}</ul>`
    : '';
}

function stationPage(c: Ctx, s: Station): string {
  const r = routeFor(s.path);
  let extra = '';
  if (s.id === 'now') {
    extra = `${kageBlock(c, 'h2')}\n${nowPartsBlock(c, 'h2')}`;
  } else if (s.id === 'workshop') {
    extra = `<ul class="benches">${benches
      .map((b) => `<li><a href="${c.u(`/workshop/${b.slug}`)}">${esc(b.name)}</a></li>`)
      .join('')}</ul>`;
  }
  const body = `<article class="sheet st-${s.id}">
  ${stationHead(s, 'h1')}
  ${roleLine(c, s)}
  ${s.body.map((p) => `<p>${esc(c.tx(p))}</p>`).join('\n  ')}
  ${extra}
</article>
${stationNav(c, s)}`;
  return layout(c, r, body);
}

function benchPage(c: Ctx, b: Bench): string {
  const r = routeFor(`/workshop/${b.slug}`);
  const body = `<article class="sheet st-workshop">
  <p class="crumb"><a href="${c.u('/workshop')}">The Workshop</a></p>
  <h1>${esc(b.name)}</h1>
  <p>${esc(b.body)}</p>
  ${benchLinks(c, b)}
</article>`;
  return layout(c, r, body);
}

function kagePage(c: Ctx): string {
  const r = routeFor('/now/kage-diagram');
  const fill = (svg: string) => svg.replace('__TITLE__', 'How Kage works').replace('__DESC__', esc(kage.alt));
  const font = `${c.base}fonts/patrick-hand-sub.woff2`;
  const head = `<link rel="preload" href="${font}" as="font" type="font/woff2" crossorigin />
    <style>@font-face{font-family:'Patrick Hand';src:url(${font}) format('woff2');font-weight:400;font-style:normal;font-display:swap}</style>`;
  const body = `<article class="kage-page">
  <div class="kage-top">
    <h1>${esc(kage.diagramKicker)}</h1>
    <a class="back" href="${c.u('/now')}">← Back to the City</a>
  </div>
  <figure class="kage-figure">
    ${fill(desktopSvg)}
    ${fill(phoneSvg)}
  </figure>
  <section class="kage-steps" aria-labelledby="steps">
    <h2 id="steps">The same flow, step by step</h2>
    <ol>${kage.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
  </section>
</article>`;
  return layout(c, r, body, { head, bodyClass: 'page paper' });
}

function timetable(c: Ctx): string {
  const r = routeFor('/timetable');
  const st = stations
    .map((s) => {
      let extra = '';
      if (s.id === 'now') extra = `${kageBlock(c, 'h3')}\n${nowPartsBlock(c, 'h3')}`;
      if (s.id === 'workshop')
        extra = benches
          .map(
            (b) => `<section class="part"><h3><a href="${c.u(`/workshop/${b.slug}`)}">${esc(b.name)}</a></h3><p>${esc(b.body)}</p>${benchLinks(c, b)}</section>`,
          )
          .join('\n');
      return `<section class="sheet st-${s.id}" aria-labelledby="tt-${s.id}">
  ${stationHead(s, 'h2', `tt-${s.id}`)}
  ${roleLine(c, s)}
  ${s.body.map((p) => `<p>${esc(c.tx(p))}</p>`).join('\n  ')}
  ${extra}
  <p><a class="more" href="${c.u(s.path)}">${esc(s.name)} page</a></p>
</section>`;
    })
    .join('\n');
  const body = `<h1>Timetable</h1>
<section class="sheet" aria-labelledby="tt-facts">
  <h2 id="tt-facts">${esc(person.name)}</h2>
  <p class="role">${esc(person.role.replace(/ · Tel Aviv$/, ''))}</p>
  ${person.intro.map((p) => `<p>${esc(c.tx(p))}</p>`).join('\n  ')}
  <p>${esc(person.languages)}</p>
</section>
${st}
<section class="sheet" aria-labelledby="tt-contact">
  <h2 id="tt-contact">Contact</h2>
  ${contactList(c)}
</section>`;
  return layout(c, r, body);
}

function contact(c: Ctx): string {
  const r = routeFor('/contact');
  const body = `<article class="sheet">
  <h1>Contact</h1>
  <dl class="contact">
    <div><dt>Email</dt><dd>${emailLink(c, 'email', true)}</dd></div>
    <div><dt>LinkedIn</dt><dd>${external(links.linkedin, 'linkedin.com/in/roi-yotvat-874ba9209')}</dd></div>
    <div><dt>GitHub</dt><dd>${external(links.github, 'github.com/roiyot26')}</dd></div>
    <div><dt>CV</dt><dd>${cvLink(c, 'Download the CV (PDF)')}</dd></div>
  </dl>
</article>`;
  return layout(c, r, body);
}

function behind(c: Ctx): string {
  const r = routeFor('/behind-the-scenes');
  const b = behindTheScenes;
  const body = `<article class="sheet">
  <h1>Behind the scenes</h1>
  <p>${esc(b.intro)}</p>
  <h2>How it's built</h2>
  <ul>${b.how.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
  <h2>Who did what</h2>
  ${b.who.map((x) => `<p>${esc(x)}</p>`).join('\n  ')}
  <h2>Privacy</h2>
  <p>${esc(b.privacy)}</p>
  <h2>Credits</h2>
  ${b.credits.map((x) => `<p>${esc(x)}</p>`).join('\n  ')}
  <p>${external('https://github.com/roiyot26/h0-layout', 'Source on GitHub')}</p>
</article>`;
  return layout(c, r, body);
}

function notFound(c: Ctx): string {
  const r: Route = { path: '/404', title: 'Off the map · Roi Yotvat', h1: 'Off the map', facts: [], cap: 100 };
  const body = `<article class="sheet">
  <h1>Off the map</h1>
  <p>There's no station at this address.</p>
  <p><a class="more" href="${c.base}">Back to the departures board</a></p>
</article>`;
  return layout(c, r, body).replace(/\s*<link rel="canonical"[^>]*>/, '');
}

function sitemap(c: Ctx): string {
  const urls = pages.map((p) => `  <url><loc>${c.origin}${c.u(p.path)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Every generated file, keyed by its path under dist. */
export function renderSite(opts: SiteOptions): Map<string, string> {
  const c: Ctx = { ...opts, u: (p) => href(opts.base, p), tx: (x) => t(x, opts.showCompanies) };
  const out = new Map<string, string>();
  const put = (path: string, html: string) => out.set(outFile(path), html);
  put('/', home(c));
  put('/timetable', timetable(c));
  for (const s of stations) put(s.path, stationPage(c, s));
  put('/now/kage-diagram', kagePage(c));
  for (const b of benches) put(`/workshop/${b.slug}`, benchPage(c, b));
  put('/behind-the-scenes', behind(c));
  put('/contact', contact(c));
  out.set('404.html', notFound(c));
  out.set('sitemap.xml', sitemap(c));
  for (const p of pages) if (!out.has(outFile(p.path))) throw new Error(`route ${p.path} has no page`);
  return out;
}

/** Build-time flags from the environment. SHOW_COMPANIES defaults to on. */
export function flagsFromEnv(env: Record<string, string | undefined>) {
  const off = (v: string | undefined) => /^(0|false|off|no)$/i.test(v ?? '');
  const on = (v: string | undefined) => /^(1|true|on|yes)$/i.test(v ?? '');
  return {
    showCompanies: !off(env.SHOW_COMPANIES),
    showDoodleRepo: on(env.SHOW_DOODLE_REPO),
    noindex: env.NOINDEX === '1',
    origin: (env.SITE_ORIGIN ?? 'https://roiyot26.github.io').replace(/\/$/, ''),
  };
}
