// The site's routes, held once: the content doc's URL table (13 pages plus /cv.pdf).
// The page generator, sitemap, budgets, link walker and browser checks all read this
// list, and test/routes.test.ts fails if it drifts from the content doc's table.
//
// `facts` are strings that must be in the page's visible text with JS off (built with
// the company names on, the default). `cap` is the first-screen budget in KB, gzip
// (TECH-PLAN §1); for a file route it is the file's raw size cap.

/** @typedef {{ path: string; title: string; h1: string; facts: string[]; cap: number; file?: boolean }} Route */

const SUFFIX = ' · Roi Yotvat';

/** @type {Route[]} */
export const routes = [
  {
    path: '/',
    title: 'Roi Yotvat · Full-stack developer · Portfolio',
    h1: 'Roi Yotvat',
    facts: [
      'Full-stack developer · AI-driven development · Tel Aviv',
      'DEPARTURES · ROI YOTVAT',
      'CODING ACADEMY',
      'MISTER BIT',
      'MOVEO CREATIVE',
      'SIDE PROJECTS',
      'EMAIL · LINKEDIN · GITHUB',
      'Hebrew (native) · English (fluent)',
    ],
    cap: 200,
  },
  {
    path: '/timetable',
    title: `Timetable${SUFFIX}`,
    h1: 'Timetable',
    facts: ['Bootcamp Town', 'Teaching Campus', 'The City', 'The Workshop', 'Kage', '2,183', 'Contact'],
    cap: 120,
  },
  {
    path: '/bootcamp',
    title: `Bootcamp Town · 2021–22${SUFFIX}`,
    h1: 'Bootcamp Town',
    facts: ['BOOTCAMP · 2021', 'Nov 2021 – Feb 2022', 'Coding Academy'],
    cap: 180,
  },
  {
    path: '/teaching',
    title: `Teaching Campus · 2022–26${SUFFIX}`,
    h1: 'Teaching Campus',
    facts: ['CAMPUS · 2022–2026', 'Feb 2022 – Jan 2026', 'Mister Bit', '60–70 students'],
    cap: 180,
  },
  {
    path: '/now',
    title: `The City · Now${SUFFIX}`,
    h1: 'The City',
    facts: ['CITY · NOW', 'Jan 2026 – now', 'Moveo Creative', 'Kage', '410', '2,183', '443'],
    cap: 180,
  },
  {
    path: '/now/kage-diagram',
    title: `Kage · how a task moves${SUFFIX}`,
    h1: 'Kage · how a task moves',
    facts: ['Back to the City', 'Orchestrator agent', 'Pull request'],
    cap: 150,
  },
  {
    path: '/workshop',
    title: `The Workshop · Side projects${SUFFIX}`,
    h1: 'The Workshop',
    facts: ['WORKSHOP · ANYTIME', 'Virtual Garden', 'chord-cycle-open', 'Doodle Reborn', 'Blender corner'],
    cap: 180,
  },
  {
    path: '/workshop/virtual-garden',
    title: `Virtual Garden · The Workshop${SUFFIX}`,
    h1: 'Virtual Garden',
    facts: ['Chrome extension', 'zen, cosmic, ocean and pixel'],
    cap: 160,
  },
  {
    path: '/workshop/chord-cycle-open',
    title: `chord-cycle-open · The Workshop${SUFFIX}`,
    h1: 'chord-cycle-open',
    facts: ['chord wheel', 'Web Audio'],
    cap: 160,
  },
  {
    path: '/workshop/blender',
    title: `Blender corner · The Workshop${SUFFIX}`,
    h1: 'Blender corner',
    facts: ['I model in Blender.'],
    cap: 160,
  },
  {
    path: '/workshop/doodle-reborn',
    title: `Doodle Reborn · The Workshop${SUFFIX}`,
    h1: 'Doodle Reborn',
    facts: ['draw-and-guess', 'paper plane', 'Live demo'],
    cap: 160,
  },
  {
    path: '/behind-the-scenes',
    title: `Behind the scenes${SUFFIX}`,
    h1: 'Behind the scenes',
    facts: ['No cookies', 'Open Font License'],
    cap: 120,
  },
  {
    path: '/cv.pdf',
    title: '',
    h1: '',
    facts: [],
    cap: 300,
    file: true,
  },
  {
    path: '/contact',
    title: `Contact${SUFFIX}`,
    h1: 'Contact',
    facts: ['Email', 'LinkedIn', 'GitHub'],
    cap: 100,
  },
];

/** Routes that are HTML pages (everything except downloads such as /cv.pdf). */
export const pages = routes.filter((r) => !r.file);

/** The page's URL path under a site base, with the trailing slash Pages redirects to. */
export function href(base, path) {
  const b = base.endsWith('/') ? base : `${base}/`;
  if (path === '/') return b;
  const rest = path.replace(/^\//, '');
  return /\.[a-z0-9]+$/i.test(rest) ? `${b}${rest}` : `${b}${rest}/`;
}

/** The built file for a route, relative to dist. */
export function outFile(path) {
  if (path === '/') return 'index.html';
  const rest = path.replace(/^\//, '');
  return /\.[a-z0-9]+$/i.test(rest) ? rest : `${rest}/index.html`;
}
