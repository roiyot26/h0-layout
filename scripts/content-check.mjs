#!/usr/bin/env node
// Content and honesty checks on the built site (TECH-PLAN §7, content doc v4.2).
//
//   node scripts/content-check.mjs [dist] [--companies on|off]
//
// The same checks run in Vitest on the rendered pages (test/site.test.ts), and in CI
// on two real builds: SHOW_COMPANIES on (the default) and off. Problems are reported
// by rule and file; matched text is never echoed.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const EMPLOYERS = ['Moveo Creative', 'Mister Bit', 'Coding Academy'];
const BANNED_WORDS = ['SLA', 'maintenance', 'on-call', 'retrieval-tracer', 'duck', 'local only', 'why local', 'one machine'];
// Where a banned word is allowed. The ban is on the site pages; the CV (cv.pdf)
// may say "maintenance" (content doc §7). Every other word, SLA included, is
// banned in the CV too.
const ALLOWED_IN = { maintenance: ['cv.pdf'] };
export const CV_PATH = 'cv.pdf';

/**
 * Banned words found in one file's text. `path` is dist-relative.
 * @returns {string[]} problems
 */
export function bannedWords(path, text) {
  const problems = [];
  for (const w of BANNED_WORDS) {
    if (ALLOWED_IN[w]?.includes(path)) continue;
    const re = new RegExp(`\\b${w.replace(/[-]/g, '\\-')}\\b`, w === 'SLA' ? '' : 'i');
    if (re.test(text)) problems.push(`${path}: banned word "${w}"`);
  }
  return problems;
}

/** The CV's text as a reader sees it (needs poppler's pdftotext). */
export function cvText(pdfPath) {
  return execFileSync('pdftotext', ['-layout', pdfPath, '-'], { maxBuffer: 64 << 20 }).toString('utf8');
}
const TEXT = /\.(html?|js|css|json|xml|txt|svg)$/i;

/** Visible text plus the attributes a reader can hear or see (alt, aria-label, title). */
export function readable(html) {
  const attrs = [...html.matchAll(/\s(?:alt|aria-label|title)="([^"]*)"/g)].map((m) => m[1]);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&quot;/g, '"');
  return `${text} ${attrs.join(' ')}`;
}

/**
 * @param {Map<string, string>} files dist-relative path → text (text files only)
 * @param {{ showCompanies: boolean, email: string }} opts
 * @returns {string[]} problems
 */
export function checkSite(files, { showCompanies, email }) {
  const problems = [];
  const html = [...files].filter(([p]) => p.endsWith('.html'));
  const all = [...files];
  const count = (text, word) => text.split(word).length - 1;

  for (const [path, text] of all) {
    problems.push(...bannedWords(path, text));
    if (/mailto:/i.test(text)) problems.push(`${path}: literal mail link prefix`);
    if (text.toLowerCase().includes(email.toLowerCase())) problems.push(`${path}: the raw email address`);
    if (/&#(?:0*64|x0*40);|&commat;/i.test(text)) problems.push(`${path}: entity-encoded @`);
    if (/\/in\/roi-yotvat(?!-874ba9209)/.test(text)) problems.push(`${path}: the dead LinkedIn URL`);
    if (/desk-3d/i.test(text)) problems.push(`${path}: a reference to the parked room`);
    for (const name of EMPLOYERS) {
      if (!showCompanies && text.includes(name)) problems.push(`${path}: employer name with SHOW_COMPANIES off`);
    }
  }

  let telAviv = 0;
  let inputs = 0;
  for (const [path, text] of html) {
    const visible = readable(text);
    if (/\blocal\b/i.test(visible)) problems.push(`${path}: the word "local" in readable text`);
    telAviv += count(visible, 'Tel Aviv');
    if (/<(input|textarea|select)\b/i.test(text)) inputs++;
    for (const m of text.matchAll(/href="(https:\/\/[^"]*(?:linkedin|github)\.com[^"]*)"/g)) {
      const u = m[1];
      if (u.includes('linkedin') && u !== 'https://www.linkedin.com/in/roi-yotvat-874ba9209/')
        problems.push(`${path}: LinkedIn URL is not the pinned one`);
      if (u.includes('github.com') && !u.startsWith('https://github.com/roiyot26'))
        problems.push(`${path}: GitHub URL outside the account`);
    }
  }
  if (telAviv !== 1) problems.push(`Tel Aviv appears ${telAviv} times in readable text (want exactly 1)`);
  if (inputs) problems.push(`${inputs} page(s) with a text input (no chatbot, no forms)`);

  const home = files.get('index.html') ?? '';
  for (const name of EMPLOYERS) {
    if (showCompanies && !home.includes(name.toUpperCase())) problems.push(`index.html: board is missing ${name}`);
  }
  // Employers never sit on a line with a city.
  for (const [path, text] of html) {
    for (const line of readable(text).split(/\n/)) {
      if (EMPLOYERS.some((e) => line.includes(e) || line.includes(e.toUpperCase())) && /Tel Aviv/.test(line))
        problems.push(`${path}: an employer line names a city`);
    }
  }

  const kage = files.get('now/kage-diagram/index.html') ?? '';
  if (!/<desc id="kd-desktop">[^<]+back to the vault\.<\/desc>/.test(kage)) problems.push('kage diagram: <desc> missing or cut');
  if (/stamp|#A8321F|\bred\b/i.test(kage.replace(/<style[\s\S]*?<\/style>/g, ''))) problems.push('kage diagram: a stamp or red ink');

  const workshop = files.get('workshop/index.html') ?? '';
  const benches = (workshop.match(/<ul class="benches">([\s\S]*?)<\/ul>/)?.[1].match(/<li>/g) ?? []).length;
  if (benches !== 4) problems.push(`workshop: ${benches} benches (want 4)`);

  return problems;
}

/** Rebuild the address from content.ts's reversed parts (it's never stored whole). */
export function emailFromContent(source = readFileSync(new URL('../src/site/content.ts', import.meta.url), 'utf8')) {
  const m = source.match(/export const email = \{ user: '([^']+)', domain: '([^']+)', tld: '([^']+)' \}/);
  if (!m) throw new Error('content.ts: email parts not found');
  const flip = (s) => [...s].reverse().join('');
  return `${flip(m[1])}@${flip(m[2])}.${flip(m[3])}`;
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const isCli = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isCli) {
  const args = process.argv.slice(2);
  const dist = args.find((a) => !a.startsWith('--') && !['on', 'off'].includes(a)) ?? 'dist';
  const i = args.indexOf('--companies');
  const showCompanies = i < 0 ? true : args[i + 1] !== 'off';
  const files = new Map(
    walk(dist)
      .filter((p) => TEXT.test(p))
      .map((p) => [relative(dist, p).replace(/\\/g, '/'), readFileSync(p, 'utf8')]),
  );
  const problems = checkSite(files, { showCompanies, email: emailFromContent() });
  // The CV gets the banned-word check only (it carries the address and the
  // employers on purpose). Fail closed if it can't be read.
  try {
    problems.push(...bannedWords(CV_PATH, cvText(join(dist, CV_PATH))));
  } catch (err) {
    problems.push(`${CV_PATH}: could not read the CV text (${err.code === 'ENOENT' ? 'install poppler-utils' : 'pdftotext failed'})`);
  }
  for (const p of problems) console.log(`FAIL ${p}`);
  console.log(`content-check: ${files.size} text file(s) + ${CV_PATH}, companies ${showCompanies ? 'on' : 'off'}, ${problems.length} problem(s)`);
  process.exit(problems.length ? 1 : 0);
}
