#!/usr/bin/env node
// Walk every HTML (and CSS) file under DIST_DIR. Internal links and anchors fail the
// job when the target is missing. External links are soft: a fetch failure is a
// warning, and hosts on the allowlist are skipped so CI stays quiet.
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'parse5';
import { routes } from '../scripts/routes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(process.env.DIST_DIR ?? join(here, '../dist'));
const siteBase = process.env.SITE_BASE ?? '/h0-layout/';
const baseNoSlash = siteBase.replace(/\/$/, '') || '';
const allow = new Set(
  JSON.parse(await readFile(new URL('./external-allowlist.json', import.meta.url), 'utf8')).hosts,
);

const failures = [];
const warnings = [];
const log = (list, msg) => {
  list.push(msg);
  console.log(msg);
};

async function isFile(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

async function listFiles(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await listFiles(p, out);
    else out.push(p);
  }
  return out;
}

function* nodes(node) {
  yield node;
  for (const c of node.childNodes ?? []) yield* nodes(c);
  if (node.content?.childNodes) for (const c of node.content.childNodes) yield* nodes(c);
}

function attrMap(node) {
  const out = {};
  for (const a of node.attrs ?? []) out[a.name] = a.value;
  return out;
}

async function idsIn(file) {
  const doc = parse(await readFile(file, 'utf8'));
  const ids = new Set();
  for (const n of nodes(doc)) {
    const id = attrMap(n).id;
    if (id) ids.add(id);
  }
  return ids;
}

/** Map a site pathname (/h0-layout/… or /…) to a file under dist, or null. */
async function fileForPath(pathname) {
  let rest = pathname;
  if (rest === baseNoSlash || rest === siteBase) rest = '/';
  else if (siteBase !== '/' && rest.startsWith(siteBase)) rest = '/' + rest.slice(siteBase.length);
  else if (baseNoSlash && rest.startsWith(baseNoSlash + '/')) rest = rest.slice(baseNoSlash.length);
  else if (!rest.startsWith('/')) return null;

  const rel = decodeURIComponent(rest.replace(/^\//, ''));
  if (rest.endsWith('/') || rest === '/') {
    const idx = join(dist, rel, 'index.html');
    if (await isFile(idx)) return idx;
    return null;
  }
  const direct = join(dist, rel);
  if (await isFile(direct)) return direct;
  if (await isFile(join(direct, 'index.html'))) return join(direct, 'index.html');
  // extension-less → try .html
  if (!extname(direct) && (await isFile(direct + '.html'))) return direct + '.html';
  return null;
}

function classify(fromFile, raw) {
  if (!raw || /^(data:|mailto:|tel:|javascript:)/i.test(raw)) return { kind: 'skip' };
  if (raw.startsWith('#')) return { kind: 'anchor', id: decodeURIComponent(raw.slice(1)) };
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    try {
      const u = new URL(raw);
      return { kind: 'external', host: u.host, href: u.href };
    } catch {
      return { kind: 'bad' };
    }
  }
  // Site-absolute or relative.
  const fromRel = relative(dist, fromFile).split(sep).join('/');
  const fromDir = fromRel.includes('/') ? fromRel.slice(0, fromRel.lastIndexOf('/') + 1) : '';
  let abs;
  if (raw.startsWith('/')) {
    abs = new URL(raw, 'https://site.invalid');
  } else {
    // Resolve relative to the file's directory, then re-express under siteBase.
    const fileUrl = pathToFileURL(join(dist, fromDir));
    const resolved = new URL(raw, fileUrl);
    const inside = decodeURIComponent(resolved.pathname);
    // On POSIX the file URL path is the absolute path.
    const relToDist = inside.startsWith(dist) ? inside.slice(dist.length) : inside;
    abs = new URL(siteBase.replace(/\/?$/, '/') + relToDist.replace(/^\//, ''), 'https://site.invalid');
    // Preserve hash from raw.
  }
  return {
    kind: 'internal',
    path: abs.pathname,
    hash: abs.hash ? decodeURIComponent(abs.hash.slice(1)) : '',
  };
}

const urlRe = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
const files = await listFiles(dist);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const refs = [];

for (const file of htmlFiles) {
  const rel = relative(dist, file);
  const doc = parse(await readFile(file, 'utf8'));
  for (const n of nodes(doc)) {
    if (!n.tagName) continue;
    const a = attrMap(n);
    for (const key of ['href', 'src', 'poster', 'xlink:href']) {
      if (a[key]) refs.push({ file: rel, abs: file, raw: a[key], via: `${n.tagName}[${key}]` });
    }
    if (a.srcset) {
      for (const part of a.srcset.split(',')) {
        const u = part.trim().split(/\s+/)[0];
        if (u) refs.push({ file: rel, abs: file, raw: u, via: `${n.tagName}[srcset]` });
      }
    }
    if (n.tagName === 'style') {
      const text = (n.childNodes ?? []).map((c) => c.value ?? '').join('');
      let m;
      urlRe.lastIndex = 0;
      while ((m = urlRe.exec(text))) refs.push({ file: rel, abs: file, raw: m[2], via: 'style url()' });
    }
  }
}
for (const file of files.filter((f) => f.endsWith('.css'))) {
  const text = await readFile(file, 'utf8');
  let m;
  urlRe.lastIndex = 0;
  while ((m = urlRe.exec(text))) {
    refs.push({ file: relative(dist, file), abs: file, raw: m[2], via: 'css url()' });
  }
}

// Every declared route must have a built page.
for (const r of routes) {
  const path =
    r.path === '/'
      ? siteBase
      : `${baseNoSlash}${r.path.endsWith('/') ? r.path : `${r.path}/`}`;
  if (!(await fileForPath(path))) {
    log(failures, `FAIL route ${r.path}: no built page at ${path}`);
  }
}

const seenExternal = new Set();
for (const ref of refs) {
  const c = classify(ref.abs, ref.raw);
  if (c.kind === 'skip') continue;
  if (c.kind === 'bad') {
    log(failures, `FAIL ${ref.file}: bad URL ${JSON.stringify(ref.raw)} (${ref.via})`);
    continue;
  }
  if (c.kind === 'anchor') {
    if (c.id && !(await idsIn(ref.abs)).has(c.id)) {
      log(failures, `FAIL ${ref.file}: missing #${c.id} (${ref.via})`);
    }
    continue;
  }
  if (c.kind === 'internal') {
    const target = await fileForPath(c.path);
    if (!target) {
      log(failures, `FAIL ${ref.file}: broken ${ref.via} → ${ref.raw}`);
      continue;
    }
    if (c.hash && !(await idsIn(target)).has(c.hash)) {
      log(failures, `FAIL ${ref.file}: missing #${c.hash} in ${relative(dist, target)} (${ref.via})`);
    }
    continue;
  }
  if (c.kind === 'external') {
    if (allow.has(c.host) || seenExternal.has(c.href)) continue;
    seenExternal.add(c.href);
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 8000);
      const res = await fetch(c.href, {
        redirect: 'follow',
        signal: ac.signal,
        headers: { 'user-agent': 'h0-layout-link-check/1.0' },
      });
      clearTimeout(t);
      if (!res.ok) log(warnings, `WARN external ${c.href} → HTTP ${res.status} (from ${ref.file})`);
    } catch (err) {
      log(warnings, `WARN external ${c.href} → ${err.name ?? 'error'} (from ${ref.file})`);
    }
  }
}

console.log(`\nChecked ${htmlFiles.length} HTML page(s), ${refs.length} reference(s).`);
console.log(`Failures: ${failures.length}. Warnings: ${warnings.length}.`);
if (failures.length) process.exit(1);
