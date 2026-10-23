#!/usr/bin/env node
// Byte budget for the built site. Fails the build on any overage; caps are never raised.
// It checks:
//   - the first-screen set of every HTML page (the page plus the JS, CSS, fonts and
//     images it references, including fonts pulled in by its CSS), gzip, against its
//     route's cap in scripts/routes.mjs (TECH-PLAN §1), or the 200 KB first-screen cap
//     for pages that aren't routes (404.html),
//   - the whole build output, raw bytes, against the desktop first-load cap,
//   - each file route (/cv.pdf) against its own raw-size cap,
//   - that no production HTML preloads or loads a three-* or world-* chunk, and that
//     dist/assets holds no such file, so production ships the M1 file list (M2 spec §5.3),
//   - the 3D preview build in dist-3d, when present, against the same total cap.
// M2 PR 1 added the last three. The per-tier first-load lists from assets.json arrive
// with M2-M3.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { outFile, routes } from './routes.mjs';

const dist = process.argv[2] ?? 'dist';
const dist3d = process.argv[3] ?? 'dist-3d';
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

const total = (dir, list) => {
  const raw = list.reduce((n, f) => n + statSync(f).size, 0);
  const ok = raw <= DESKTOP_TOTAL_CAP;
  failed ||= !ok;
  console.log(`budget: total ${dir} ${(raw / KB).toFixed(1)} KB raw (cap ${DESKTOP_TOTAL_CAP / 1e6} MB) ${ok ? 'ok' : 'OVER'}`);
};
total(dist, files);

// The 3D chunks never reach production: no file, no script and no modulepreload.
const CHUNK_3D = /(?:^|\/)(?:three|world)-[^/]*\.js$/;
let has3d = false;
for (const f of files) {
  const rel = relative(dist, f).replace(/\\/g, '/');
  if (/^assets\/(?:three|world)-/.test(rel)) {
    console.error(`budget: ${dist}/${rel} is a 3D chunk in the production build`);
    has3d = true;
  }
  if (!rel.endsWith('.html')) continue;
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/<(?:link|script)\b[^>]*>/gi)) {
    const ref = /\b(?:src|href)="([^"]+)"/i.exec(m[0])?.[1] ?? '';
    if (CHUNK_3D.test(ref.split(/[?#]/)[0])) {
      console.error(`budget: ${rel} ${/modulepreload/i.test(m[0]) ? 'preloads' : 'loads'} the 3D chunk ${ref}`);
      has3d = true;
    }
  }
}
failed ||= has3d;
console.log(`budget: three-* and world-* chunks in ${dist} ${has3d ? 'FOUND' : 'none, ok'}`);

if (existsSync(dist3d)) total(dist3d, walk(dist3d));

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
