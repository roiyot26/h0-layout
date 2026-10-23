#!/usr/bin/env node
// Hiring rules 3 and 17: no mailto:, no plain or entity-encoded email address and no
// phone number in any shipped text file. The email is only ever assembled at runtime.
// PDFs are exempt (the CV may carry the email). Matches are reported by rule and line,
// never echoed, so the log can't leak what it found.
//
// Each file is scanned as written and again the way a browser would read it: tags
// stripped (so an address split across elements joins up), entities decoded with or
// without the trailing semicolon, and percent-escapes decoded (as in an href).
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMAIL, findPhone, PHONE } from '../scripts/history-check.mjs';
import { blankVendorFindings, THREE_VERSION, VENDOR_CHUNK } from '../scripts/vendor-allowlist.mjs';

// The repo's own phone rule (history-check), so dotted mobiles, 972 without the plus
// and landlines are caught, plus this guard's earlier pattern so nothing scans less.
const PHONE_EXTRA = /(?:\+972|\b0)[-\s]?5\d(?:[-\s]?\d){7}\b|\+\d{1,3}[-\s]?\(?\d{2,4}\)?(?:[-\s]?\d{2,4}){2,3}/;
// Float literals such as 0.5872000000 in a bundled shader read as a trunk 0 and a
// mobile number. No phone format starts with "0.", so they are masked first.
const FLOAT = /(?<![\w.])0\.\d+(?![\w.])/g;
const maskFloats = (s) => s.replace(FLOAT, (m) => m.replace(/\d/g, 'x'));
// findPhone only answers yes or no, so locate the line it fires on.
function phoneHit(raw) {
  const s = maskFloats(raw);
  if (!findPhone(s)) return null;
  let index = 0;
  for (const line of s.split('\n')) {
    if (findPhone(line)) return { index };
    index += line.length + 1;
  }
  return { index: 0 };
}

const TEXT = /\.(html?|js|mjs|cjs|css|json|xml|txt|svg|webmanifest|map)$/i;
const rules = [
  ['mailto', (s) => /mailto:/i.exec(s)],
  ['email address', (s) => EMAIL.exec(s)],
  ['entity-encoded @', (s) => /&#(?:0*64|x0*40)|&commat/i.exec(s)],
  ['phone number', (s) => PHONE_EXTRA.exec(s) ?? phoneHit(s)],
];

// Named entities that can hide parts of an address or a number. Unknown names are left
// as they are.
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', commat: '@', period: '.',
  colon: ':', sol: '/', hyphen: '-', dash: '-', plus: '+', lpar: '(', rpar: ')',
  percnt: '%', num: '#', lowbar: '_', semi: ';', equals: '=', quest: '?', excl: '!',
};

const codePoint = (n) => {
  try {
    return String.fromCodePoint(n);
  } catch {
    return '';
  }
};

// Removes tags but keeps their line breaks, so line numbers still match the file.
export const stripTags = (s) => s.replace(/<\/?[a-z!][^>]*>/gi, (t) => t.replace(/[^\n]/g, ''));

export const decodeEntities = (s) =>
  s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => codePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);?/g, (_, d) => codePoint(parseInt(d, 10)))
    .replace(/&([a-z]+)(;?)/gi, (m, name, semi) => {
      const lower = name.toLowerCase();
      if (NAMED[lower] !== undefined) return NAMED[lower];
      if (semi) return m;
      // Without a semicolon, read the longest known name at the start (&commatfoo).
      const key = Object.keys(NAMED)
        .filter((k) => lower.startsWith(k))
        .sort((a, b) => b.length - a.length)[0];
      return key ? NAMED[key] + name.slice(key.length) : m;
    });

export const percentDecode = (s) => s.replace(/%([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

// The text as written, plus each normalised reading of it.
export function views(text) {
  const plain = stripTags(text);
  const out = [text, plain];
  for (const base of [text, plain]) {
    const decoded = decodeEntities(base);
    out.push(decoded, percentDecode(decoded), decodeEntities(percentDecode(base)));
  }
  return [...new Set(out)];
}

// The three.js vendor chunk (assets/three-<8>.js at the dist root): the known findings
// in the pinned build, listed in scripts/vendor-allowlist.mjs and shared with
// history-check, are blanked first. Every rule then runs on the rest of the chunk.
export const VENDOR_PATTERNS = [EMAIL, PHONE_EXTRA, ...PHONE];

/** The text the rules read for a dist-relative path, and how many findings were blanked. */
export function forScan(rel, text) {
  if (!VENDOR_CHUNK.test(rel)) return { text, blanked: 0 };
  return blankVendorFindings(text, VENDOR_PATTERNS);
}

// Returns [{ rule, line }] for the first hit of each rule. Never returns the match.
export function scan(text) {
  const found = [];
  for (const [rule, find] of rules) {
    for (const view of views(text)) {
      const m = find(view);
      if (!m) continue;
      found.push({ rule, line: view.slice(0, m.index).split('\n').length });
      break;
    }
  }
  return found;
}

const walk = async (dir) =>
  (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
      ),
    )
  ).flat();

async function main() {
  const dist = resolve(process.env.DIST_DIR ?? fileURLToPath(new URL('../dist', import.meta.url)));
  if (!(await stat(dist).catch(() => null))?.isDirectory()) {
    console.log(`dist-guard: FAIL no built site at ${dist}`);
    process.exit(1);
  }
  let bad = 0;
  const files = (await walk(dist)).filter((p) => TEXT.test(p));
  for (const file of files) {
    const rel = relative(dist, file).replace(/\\/g, '/');
    const { text, blanked } = forScan(rel, await readFile(file, 'utf8'));
    if (VENDOR_CHUNK.test(rel)) {
      console.log(`dist-guard: ${rel}: ${blanked} listed finding(s) blanked (three ${THREE_VERSION})`);
    }
    for (const { rule, line } of scan(text)) {
      bad++;
      console.log(`FAIL ${rel}:${line}: ${rule}`);
    }
  }
  console.log(`dist-guard: ${files.length} text file(s), ${bad} problem(s)`);
  process.exit(bad ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
