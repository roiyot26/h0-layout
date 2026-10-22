#!/usr/bin/env node
// Byte budget for the built site. Fails the build on any overage; caps are never raised.
// It checks:
//   - the first-screen set of every HTML page (the page plus the JS, CSS, fonts and
//     images it references, including fonts pulled in by its CSS), gzip, against its
//     route's cap in scripts/routes.mjs (TECH-PLAN §1), or the 200 KB first-screen cap
//     for pages that aren't routes (404.html),
//   - the whole build output, raw bytes, against the desktop first-load cap,
//   - each file route (/cv.pdf) against its own raw-size cap.
// The per-tier first-load lists from assets.json arrive with M2-M3.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { outFile, routes } from './routes.mjs';

const dist = process.argv[2] ?? 'dist';
const KB = 1024;
const FIRST_SCREEN_CAP = 200 * KB;
const DESKTOP_TOTAL_CAP = 6 * 1000 * 1000;

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const files = walk(dist);
const gz = (p) => gzipSync(readFileSync(p), { level: 9 }).length;

let failed = false;
for (const page of files.filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(page, 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => /\.(js|css|woff2|webp|png|jpg|svg)$/.test(u) && !/^https?:/.test(u));
  // Fonts and images that the page's CSS pulls in count towards the first screen too.
  for (const css of refs.filter((u) => u.endsWith('.css'))) {
    const local = files.find((f) => css.endsWith('/' + relative(dist, f).replace(/\\/g, '/')));
    if (!local) continue;
    for (const m of readFileSync(local, 'utf8').matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      if (!/^(data:|https?:)/.test(m[1]) && !refs.includes(m[1])) refs.push(m[1]);
    }
  }
  let total = gz(page);
  for (const ref of refs) {
    const local = files.find((f) => ref.endsWith('/' + relative(dist, f).replace(/\\/g, '/')));
    if (!local) {
      console.error(`budget: ${relative(dist, page)} references ${ref}, which is not in ${dist}`);
      failed = true;
      continue;
    }
    total += gz(local);
  }
  const rel = relative(dist, page).replace(/\\/g, '/');
  const route = routes.find((r) => !r.file && outFile(r.path) === rel);
  const cap = route ? route.cap * KB : FIRST_SCREEN_CAP;
  const ok = total <= cap;
  failed ||= !ok;
  console.log(`budget: first screen ${rel} ${(total / KB).toFixed(1)} KB gzip (cap ${cap / KB} KB) ${ok ? 'ok' : 'OVER'}`);
}

const raw = files.reduce((n, f) => n + statSync(f).size, 0);
const okTotal = raw <= DESKTOP_TOTAL_CAP;
failed ||= !okTotal;
console.log(`budget: total ${dist} ${(raw / KB).toFixed(1)} KB raw (cap ${DESKTOP_TOTAL_CAP / 1e6} MB) ${okTotal ? 'ok' : 'OVER'}`);

for (const r of routes.filter((x) => x.file)) {
  const name = outFile(r.path);
  const file = files.find((f) => relative(dist, f).replace(/\\/g, '/') === name);
  if (!file) {
    console.error(`budget: dist/${name} is missing`);
    failed = true;
    continue;
  }
  const size = statSync(file).size;
  const ok = size <= r.cap * KB;
  failed ||= !ok;
  console.log(`budget: ${name} ${(size / KB).toFixed(1)} KB raw (cap ${r.cap} KB) ${ok ? 'ok' : 'OVER'}`);
}
process.exit(failed ? 1 : 0);
