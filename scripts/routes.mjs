// The site's routes, held once. The page generator, sitemap, budgets and tests read
// this list (TECH-PLAN §1). M1 grows it to the content doc's full table; until then it
// lists only the pages that exist, so every check runs against real pages.

/** @typedef {{ path: string; title: string; h1: string; facts: string[] }} Route */

/** @type {Route[]} */
export const routes = [
  {
    path: '/',
    title: 'H0 layout · Coming soon',
    h1: 'Coming soon',
    facts: ['H0 LAYOUT', 'COMING SOON', 'Scale 1:87 (H0).'],
  },
];
