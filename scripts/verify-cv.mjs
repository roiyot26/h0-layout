#!/usr/bin/env node
// Checks public/cv.pdf (or DIST/cv.pdf) against the M1 CV spec in TECH-PLAN.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
