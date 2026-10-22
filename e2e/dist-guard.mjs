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

const TEXT = /\.(html?|js|mjs|cjs|css|json|xml|txt|svg|webmanifest|map)$/i;
const rules = [
  ['mailto', (s) => /mailto:/i.exec(s)],
  ['email address', (s) => /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/i.exec(s)],
  ['entity-encoded @', (s) => /&#(?:0*64|x0*40)|&commat/i.exec(s)],
  [
    'phone number',
    (s) => /(?:\+972|\b0)[-\s]?5\d(?:[-\s]?\d){7}\b|\+\d{1,3}[-\s]?\(?\d{2,4}\)?(?:[-\s]?\d{2,4}){2,3}/.exec(s),
  ],
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
    for (const { rule, line } of scan(await readFile(file, 'utf8'))) {
      bad++;
      console.log(`FAIL ${relative(dist, file)}:${line}: ${rule}`);
    }
  }
  console.log(`dist-guard: ${files.length} text file(s), ${bad} problem(s)`);
  process.exit(bad ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
