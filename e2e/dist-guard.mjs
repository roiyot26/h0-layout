#!/usr/bin/env node
// Hiring rules 3 and 17: no mailto:, no plain or entity-encoded email address and no
// phone number in any shipped text file. The email is only ever assembled at runtime.
// PDFs are exempt (the CV may carry the email). Matches are reported by rule and line,
// never echoed, so the log can't leak what it found.
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(process.env.DIST_DIR ?? fileURLToPath(new URL('../dist', import.meta.url)));
const TEXT = /\.(html?|js|mjs|cjs|css|json|xml|txt|svg|webmanifest|map)$/i;
const rules = [
  ['mailto', /mailto:/i],
  ['email address', /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/i],
  ['entity-encoded @', /&#(?:0*64|x0*40);|&commat;/i],
  [
    'phone number',
    /(?:\+972|\b0)[-\s]?5\d(?:[-\s]?\d){7}\b|\+\d{1,3}[-\s]?\(?\d{2,4}\)?(?:[-\s]?\d{2,4}){2,3}/,
  ],
];

const walk = async (dir) =>
  (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
      ),
    )
  ).flat();

if (!(await stat(dist).catch(() => null))?.isDirectory()) {
  console.log(`dist-guard: FAIL no built site at ${dist}`);
  process.exit(1);
}

let bad = 0;
const files = (await walk(dist)).filter((p) => TEXT.test(p));
for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const [name, re] of rules) {
    const m = re.exec(text);
    if (!m) continue;
    bad++;
    const line = text.slice(0, m.index).split('\n').length;
    console.log(`FAIL ${relative(dist, file)}:${line}: ${name}`);
  }
}
console.log(`dist-guard: ${files.length} text file(s), ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
