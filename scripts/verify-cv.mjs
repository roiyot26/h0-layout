#!/usr/bin/env node
// Checks public/cv.pdf (or DIST/cv.pdf) against the M1 CV spec in TECH-PLAN.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { actualTexts, cvSourceStrings, joinedWords } from './cv-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pdf = process.argv[2] ?? join(root, 'public/cv.pdf');
const experience = JSON.parse(readFileSync(join(root, 'cv/experience.json'), 'utf8'));

const fail = (m) => {
  console.error(`verify-cv: FAIL ${m}`);
  process.exitCode = 1;
};
const ok = (m) => console.log(`verify-cv: ok ${m}`);

if (!existsSync(pdf)) {
  fail(`missing ${pdf}`);
  process.exit(1);
}

const size = statSync(pdf).size;
if (size > 300 * 1024) fail(`size ${size} > 300 KB`);
else ok(`size ${(size / 1024).toFixed(1)} KB ≤ 300 KB`);

const info = spawnSync('pdfinfo', [pdf], { encoding: 'utf8' });
if (info.status !== 0) {
  fail('pdfinfo failed');
  process.exit(1);
}
const meta = Object.fromEntries(
  info.stdout
    .split('\n')
    .filter((l) => l.includes(':'))
    .map((l) => {
      const i = l.indexOf(':');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
for (const key of ['Author', 'Creator', 'Producer']) {
  if (meta[key] !== 'Roi Yotvat') fail(`${key}=${JSON.stringify(meta[key])} (want "Roi Yotvat")`);
  else ok(`${key}`);
}
if ((meta.Title || '') !== 'Roi Yotvat — CV' && (meta.Title || '') !== 'Roi Yotvat - CV') {
  // em dash may render variously in pdfinfo
  if (!(meta.Title || '').startsWith('Roi Yotvat')) fail(`Title=${JSON.stringify(meta.Title)}`);
  else ok(`Title ${meta.Title}`);
} else ok(`Title`);

// Tagged PDF: the cleaner must keep Chrome's structure tree and /Lang
// (CI also runs: pdfinfo public/cv.pdf | grep -q 'Tagged: *yes').
if (!/^Tagged: *yes$/m.test(info.stdout)) fail('PDF is not tagged (want Tagged: yes)');
else ok('Tagged: yes');

// Document language: the catalog (/Root) must carry /Lang (en). The cleaner
// writes plain objects, so the catalog is readable without a PDF library.
{
  const raw = readFileSync(pdf).toString('latin1');
  const rootRef = [...raw.matchAll(/\/Root\s+(\d+)\s+(\d+)\s+R/g)].pop();
  const catalog = rootRef
    ? raw.match(new RegExp(`(?:^|\\s)${rootRef[1]}\\s+${rootRef[2]}\\s+obj([\\s\\S]*?)endobj`))
    : null;
  const lang = catalog?.[1].match(/\/Lang\s*\(([^)]*)\)/)?.[1];
  if (!catalog) fail('catalog object not found (object streams are not supported here)');
  else if (lang !== 'en') fail(`/Lang=${JSON.stringify(lang)} (want "en")`);
  else ok('/Lang en');
}

// Tag text: Chrome puts no space at a soft line wrap, so the marked content
// glues words together across lines ("withLLM"). build-cv.mjs gives each
// prose block its source string as /ActualText, which is what assistive tech
// reads. Poppler's -struct-text prints the marked content and ignores
// /ActualText, so count the wrap joins there and require every block that has
// one to carry /ActualText equal to its source in cv/cv.html.
{
  const sources = cvSourceStrings(readFileSync(join(root, 'cv/cv.html'), 'utf8'));
  const struct = spawnSync('pdfinfo', ['-struct-text', pdf], { encoding: 'utf8' });
  if (struct.status !== 0) fail('pdfinfo -struct-text failed');
  const actual = actualTexts(readFileSync(pdf).toString('latin1'));
  if (actual.includes(null)) fail('an /ActualText is not a UTF-16BE hex string');
  const stale = actual.filter((t) => t !== null && !sources.includes(t));
  if (stale.length) fail(`/ActualText not in cv/cv.html (rebuild the PDF?): ${stale.map((t) => JSON.stringify(t.slice(0, 40))).join(', ')}`);
  const missing = sources.filter((s) => !actual.includes(s));
  if (missing.length) fail(`${missing.length} prose block(s) without /ActualText: ${missing.map((t) => JSON.stringify(t.slice(0, 40))).join(', ')}`);
  const wraps = joinedWords(sources, struct.stdout || '');
  const joined = wraps.filter((j) => !actual.includes(j.source));
  if (joined.length) fail(`tag text joins ${joined.length} word pair(s): ${joined.map((j) => j.glued).join(', ')}`);
  else ok(`tag text: 0 joined words (${sources.length} blocks with /ActualText; ${wraps.length} wrap joins in the marked content)`);
}

const metaDump = spawnSync('pdfinfo', ['-meta', pdf], { encoding: 'utf8' });
const metaText = `${info.stdout}\n${metaDump.stdout || ''}`;
const metaBad = [
  'chrome', 'skia', 'mozilla',
  String.fromCharCode(99,108,97,117,100,101),
  String.fromCharCode(97,110,116,104,114,111,112,105,99),
];
for (const bad of metaBad) {
  if (metaText.toLowerCase().includes(bad)) fail(`metadata mentions ${bad}`);
}

const textRun = spawnSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
if (textRun.status !== 0) {
  fail('pdftotext failed');
  process.exit(1);
}
const text = textRun.stdout;
for (const company of ['Moveo Creative', 'Mister Bit', 'Coding Academy']) {
  if (!text.includes(company)) fail(`missing employer ${company}`);
  else ok(`employer ${company}`);
}

const telAviv = [...text.matchAll(/Tel Aviv/g)];
if (telAviv.length !== 1) fail(`Tel Aviv count ${telAviv.length} (want 1, in the header)`);
else ok('Tel Aviv once');

// No city on an employer line: the line that names each employer must not also name a city.
for (const company of ['Moveo Creative', 'Mister Bit', 'Coding Academy']) {
  for (const line of text.split('\n')) {
    if (line.includes(company) && /Tel Aviv|London|Berlin|New York|Paris/i.test(line)) {
      fail(`city on employer line: ${JSON.stringify(line.trim())}`);
    }
  }
}
ok('no city on employer lines');

if (/linkedin\.com\/in\/roi-yotvat(?!-874ba9209)/i.test(text)) {
  fail('dead LinkedIn /in/roi-yotvat present');
} else ok('no dead LinkedIn slug');
if (!/linkedin\.com\/in\/roi-yotvat-874ba9209/.test(text)) {
  fail('expected LinkedIn slug missing from text');
} else ok('LinkedIn slug in text');

// Link targets: TECH-PLAN §7 pins the LinkedIn and GitHub URLs exactly. The
// slug check above reads the visible text only, so read every /URI action in
// the raw PDF too. The cleaner writes plain objects; object streams would hide
// annotations from this scan, so they fail closed.
const PINNED_LINKS = {
  LinkedIn: { match: /linkedin\.com/i, url: 'https://www.linkedin.com/in/roi-yotvat-874ba9209/' },
  GitHub: { match: /github\.com/i, url: 'https://github.com/roiyot26' },
};

function pdfString(raw, i) {
  // Decode the PDF string object starting at raw[i] ('(' literal or '<' hex).
  if (raw[i] === '<') {
    const end = raw.indexOf('>', i);
    if (end < 0) return null;
    const hex = raw.slice(i + 1, end).replace(/\s+/g, '');
    if (!/^[0-9a-f]*$/i.test(hex)) return null;
    const padded = hex.length % 2 ? `${hex}0` : hex;
    return Buffer.from(padded, 'hex').toString('latin1');
  }
  let out = '';
  let depth = 0;
  for (let j = i; j < raw.length; j++) {
    const c = raw[j];
    if (c === '\\') {
      const n = raw[++j];
      const esc = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
      if (n in esc) out += esc[n];
      else if (/[0-7]/.test(n)) {
        const oct = raw.slice(j, j + 3).match(/^[0-7]{1,3}/)[0];
        out += String.fromCharCode(parseInt(oct, 8) & 0xff);
        j += oct.length - 1;
      } else if (n === '\r') {
        if (raw[j + 1] === '\n') j++;
      } else if (n !== '\n') out += n;
      continue;
    }
    if (c === '(') {
      if (depth++ > 0) out += c;
    } else if (c === ')') {
      if (--depth === 0) return out;
      out += c;
    } else out += c;
  }
  return null;
}

{
  const raw = readFileSync(pdf).toString('latin1');
  if (/\/Type\s*\/ObjStm\b/.test(raw)) {
    fail('PDF uses object streams; link annotations cannot be checked');
  } else {
    const uris = [];
    for (const m of raw.matchAll(/\/URI\s*(?=[(<])/g)) {
      const value = pdfString(raw, m.index + m[0].length);
      if (value === null) fail('a /URI is not a readable PDF string');
      else uris.push(value);
    }
    const linkAnnots = [...raw.matchAll(/\/Subtype\s*\/Link\b/g)].length;
    if (linkAnnots < uris.length) fail(`${uris.length} /URI actions but only ${linkAnnots} link annotations`);
    for (const [name, { match, url }] of Object.entries(PINNED_LINKS)) {
      // Any URI naming the service counts, whatever its scheme or subdomain.
      const hits = uris.filter((u) => match.test(u));
      if (hits.length === 0) fail(`no ${name} link annotation`);
      const wrong = hits.filter((u) => u !== url);
      if (wrong.length) fail(`${name} link annotation is not ${url}: ${wrong.map((u) => JSON.stringify(u)).join(', ')}`);
      else if (hits.length === 1) ok(`${name} link annotation ${url}`);
      else if (hits.length > 1) ok(`${name} link annotations (${hits.length}) all ${url}`);
    }
  }
}

// Phone: Israeli mobile / international forms.
const phone =
  /(?:\+972[-\s]?)?(?:0?5\d[-\s]?\d{3}[-\s]?\d{4})|(?:\+\d{1,3}[-\s]?)?\(?\d{2,3}\)?[-\s]?\d{3}[-\s]?\d{4}/;
if (phone.test(text)) fail(`phone-like digits in text: ${text.match(phone)?.[0]}`);
else ok('no phone in text');

// Hidden / producer strings in the raw PDF (phone checks use pdftotext above;
// raw streams contain font-width tables that look like phone numbers).
const rawStr = readFileSync(pdf).toString('latin1');
const rawBad = [
  'HeadlessChrome', 'Skia/PDF', 'Mozilla/',
  String.fromCharCode(67,108,97,117,100,101),
  String.fromCharCode(99,108,97,117,100,101),
  String.fromCharCode(97,110,116,104,114,111,112,105,99),
];
for (const bad of rawBad) {
  if (rawStr.includes(bad)) fail(`raw PDF contains ${bad}`);
}
ok('no banned tool strings in raw PDF');

// experience.json years/roles must appear (en-dash or hyphen).
for (const row of experience) {
  const yearsOk =
    text.includes(row.years) ||
    text.includes(row.years.replace(/\u2013/g, '-')) ||
    text.includes(row.years.replace(/-/g, '\u2013'));
  if (!yearsOk) fail(`missing years ${row.years}`);
  else ok(`years ${row.years}`);
  if (!text.includes(row.role)) fail(`missing role ${row.role}`);
  else ok(`role ${row.role}`);
  if (!text.includes(row.employer)) fail(`missing employer from experience.json: ${row.employer}`);
}

// No paid/client 3D claim.
if (/\b(paid|client)\b.{0,40}\b3\s*d\b/i.test(text) || /\b3\s*d\b.{0,40}\b(paid|client)\b/i.test(text)) {
  fail('claims paid/client 3D work');
} else ok('no paid/client 3D claim');

if (process.exitCode) {
  console.error('verify-cv: failed');
  process.exit(1);
}
console.log('verify-cv: all checks passed');
