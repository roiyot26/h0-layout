#!/usr/bin/env node
// History check for public-history rules.
//
//   node scripts/history-check.mjs --all        every commit, tree, path and ref
//   node scripts/history-check.mjs --pre-push   commits about to be pushed (stdin from git)
//   node scripts/history-check.mjs --text FILE  scan one file (tests, built dist files)
//
// What it checks:
//   1. Author and committer email of every commit is the account's noreply address.
//   2. No banned term in commit messages, author/committer names, file contents,
//      file paths or ref names. Banned terms are stored only as SHA-256 hashes in
//      scripts/banned.sha256.json, so the words never appear in the repo.
//   3. No phone number pattern anywhere.
//
// Matching: text is split on camelCase and on every non-alphanumeric character,
// lowercased, and each run of 1-5 consecutive tokens is joined and hashed. Whole
// tokens only, so a word that merely contains a banned term does not match.
// Letter-only parts of mixed tokens and a trailing plural "s" are also checked.
//
// Scope: an entry may carry "scope": "metadata". It is then only applied to commit
// metadata (author and committer fields, commit messages and ref/branch names), not
// to file contents or file paths. This is for ordinary words that real copy may use
// but that must not appear in the history's metadata.
//
// Multi-word terms are stored as the hash of their words joined with nothing
// between them, lowercased; any whitespace or punctuation between the words in the
// text still matches, because matching works on token runs.
//
// Path rules: an entry in the list may carry "allowIn": ["*.pdf"]. That entry is
// then not applied to the *contents* of files whose path matches one of those
// patterns (it still applies to the path itself, to messages and to every other
// file). Patterns are "*.ext" suffix matches only. This is a rule about where a
// term may appear, not a list of allowed words.
//
// Vendor chunk: in --text mode only, a built file whose last two path parts match
// VENDOR_CHUNK (assets/three-<8-char hash>.js, the same pattern dist-guard uses) skips
// the phone rule, because minified three.js trips it. Banned terms still apply to it,
// and nothing is skipped for any other name or in --all / --pre-push.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const list = JSON.parse(readFileSync(join(here, 'banned.sha256.json'), 'utf8'));
const NOREPLY = list.requiredEmail.toLowerCase();
const entries = new Map(list.entries.map((e) => [e.h, e]));
const MAX_N = 5;
const ZERO = /^0+$/;

const PHONE = [
  /(?<![\d+])(?:\+972|972|0)[-\s.]?5\d(?:[-\s.]?\d){7}(?!\d)/,
  /(?<![\d+])(?:\+972|0)[-\s.]?[2-489](?:[-\s.]?\d){7}(?!\d)/,
  /\+\d{1,3}[\s.-]?\(?\d{2,4}\)?(?:[\s.-]?\d{3,4}){2}(?!\d)/,
];

const hashCache = new Map();
function sha(s) {
  let v = hashCache.get(s);
  if (v === undefined) {
    v = createHash('sha256').update(s).digest('hex');
    hashCache.set(s, v);
  }
  return v;
}

export function tokenize(text) {
  const spaced = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return spaced.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function matchesPattern(path, pattern) {
  return pattern.startsWith('*.') && path.toLowerCase().endsWith(pattern.slice(1).toLowerCase());
}

function allowedHere(entry, path) {
  return Boolean(path && entry.allowIn && entry.allowIn.some((p) => matchesPattern(path, p)));
}

// Returns a list of { hash, term-position } findings. `path` is set when the text
// is the content of a file at that path.
// `context` is 'metadata', 'path' or 'content'.
export function findBanned(text, path = null, table = entries, context = path ? 'content' : 'metadata') {
  const tokens = tokenize(text);
  const found = new Set();
  const check = (s) => {
    const e = table.get(sha(s));
    if (!e || allowedHere(e, path)) return;
    if (e.scope === 'metadata' && context !== 'metadata') return;
    found.add(e.h.slice(0, 12));
  };
  for (let i = 0; i < tokens.length; i++) {
    let gram = '';
    for (let n = 0; n < MAX_N && i + n < tokens.length; n++) {
      gram += tokens[i + n];
      check(gram);
    }
    const t = tokens[i];
    if (t.length > 3 && t.endsWith('s')) check(t.slice(0, -1));
    if (/\d/.test(t) && /[a-z]/.test(t)) for (const part of t.split(/\d+/)) if (part) check(part);
  }
  return [...found];
}

export function hashTerm(term) {
  return sha(term);
}

export function findPhone(text) {
  return PHONE.some((re) => re.test(text));
}

// Document and instance IDs (XMP uuid:, xmp.iid:, xmp.did:, xmp.id: values and
// bare 8-4-4-4-12 GUIDs) are random hex, and their digit runs can look like a
// phone number. Blank only those exact shapes, and only for the phone scan; the
// banned-term scan always sees the text as it is.
const HEX_GUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ID_SHAPES = [
  new RegExp(`\\b(?:uuid|xmp\\.(?:iid|did|id)):(?:${HEX_GUID}|[0-9a-f]{32})(?![0-9a-z-])`, 'gi'),
  new RegExp(`(?<![0-9a-z-])${HEX_GUID}(?![0-9a-z-])`, 'gi'),
];

export function blankIds(text) {
  return ID_SHAPES.reduce((t, re) => t.replace(re, '[id]'), text);
}

// The phone check the scan runs: IDs blanked first.
export function findPhoneOutsideIds(text) {
  return findPhone(blankIds(text));
}

function git(args, opts = {}) {
  return execFileSync('git', args, { maxBuffer: 1 << 30, ...opts });
}

const problems = [];
function report(where, what) {
  problems.push(`${where}: ${what}`);
}

function textForScan(path, rawLatin1) {
  // PDF streams contain font-width tables that look like phone numbers to the
  // regex. Scan the page text and the metadata instead (email allowIn still
  // applies).
  if (!path || !path.toLowerCase().endsWith('.pdf')) return rawLatin1;
  const tmp = join(tmpdir(), `h0-hist-${process.pid}-${Math.random().toString(16).slice(2)}.pdf`);
  try {
    writeFileSync(tmp, Buffer.from(rawLatin1, 'latin1'));
    const run = (cmd, args) => execFileSync(cmd, args, {
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString('utf8');
    const pageText = run('pdftotext', ['-layout', tmp, '-']);
    // Every document-info field, custom keys and multi-line values included,
    // plus the XMP packet. Their ID values are blanked before the phone scan
    // (see blankIds); nothing else is filtered out.
    const info = run('pdfinfo', ['-custom', tmp]);
    const xmp = run('pdfinfo', ['-meta', tmp]);
    return [pageText, info, xmp].join('\n');
  } catch (err) {
    // Fail closed: a PDF we cannot read as text is a problem, not a pass.
    const why = err.code === 'ENOENT'
      ? `${err.path ?? 'pdftotext'} not found (install poppler-utils)`
      : (err.stderr?.toString().trim().split('\n').pop() || err.message);
    report(path, `could not extract PDF text: ${why}`);
    return '';
  } finally {
    try { unlinkSync(tmp); } catch { /* ignore */ }
  }
}

// The three.js vendor chunk by its exact built name, relative to the dist root (M2 spec,
// opening PR backlog 1). e2e/dist-guard.mjs imports this same pattern.
export const VENDOR_CHUNK = /^assets\/three-[A-Za-z0-9_-]{8}\.js$/;

/** True when a built file's path ends in assets/three-<8>.js (any dist directory). */
export const isVendorChunk = (path) => VENDOR_CHUNK.test(path.replace(/\\/g, '/').split('/').slice(-2).join('/'));

function scanText(where, text, path = null, context = path ? 'content' : 'metadata', skipPhone = false) {
  const hits = findBanned(text, path, entries, context);
  if (hits.length) report(where, `banned term (hash ${hits.join(', ')})`);
  if (!skipPhone && findPhoneOutsideIds(text)) report(where, 'phone number pattern');
}

const seenBlobs = new Set();
function scanCommit(sha7) {
  const meta = git(['show', '-s', '--format=%an%x00%ae%x00%cn%x00%ce%x00%B', sha7]).toString('utf8');
  const [an, ae, cn, ce, body] = meta.split('\0');
  const at = `commit ${sha7.slice(0, 7)}`;
  if (ae.toLowerCase() !== NOREPLY) report(at, 'author email is not the noreply address');
  if (ce.toLowerCase() !== NOREPLY) report(at, 'committer email is not the noreply address');
  scanText(`${at} author/committer`, `${an}\n${ae}\n${cn}\n${ce}`);
  scanText(`${at} message`, body);

  const tree = git(['ls-tree', '-r', '-z', '--full-tree', sha7]).toString('utf8').split('\0').filter(Boolean);
  for (const line of tree) {
    const [info, path] = line.split('\t');
    const [, type, blob] = info.split(' ');
    if (type !== 'blob') continue;
    const key = `${blob}:${path}`;
    if (seenBlobs.has(key)) continue;
    seenBlobs.add(key);
    scanText(`${at} path`, path, null, 'path');
    const content = git(['cat-file', 'blob', blob]).toString('latin1');
    scanText(`${at} ${path}`, textForScan(path, content), path);
  }
}

function scanRefs(names) {
  for (const r of names) scanText('ref', r);
}

function revList(args) {
  const out = git(['rev-list', ...args]).toString().trim();
  return out ? out.split('\n') : [];
}

function finish(label, count) {
  if (problems.length) {
    console.error(`history-check: ${problems.length} problem(s) in ${label}`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`history-check: clean (${label}, ${count} commit(s), ${seenBlobs.size} file version(s))`);
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
const mode = isCli ? process.argv[2] : undefined;
if (mode === '--all') {
  const commits = revList(['--all']);
  for (const c of commits) scanCommit(c);
  scanRefs(git(['for-each-ref', '--format=%(refname)']).toString().split('\n').filter(Boolean));
  finish('full history', commits.length);
} else if (mode === '--pre-push') {
  const input = readFileSync(0, 'utf8').trim();
  let count = 0;
  for (const line of input ? input.split('\n') : []) {
    const [localRef, localSha, remoteRef, remoteSha] = line.split(' ');
    scanRefs([localRef, remoteRef]);
    if (ZERO.test(localSha)) continue;
    const range = ZERO.test(remoteSha) ? [localSha, '--not', '--remotes'] : [`${remoteSha}..${localSha}`];
    const commits = revList(range);
    for (const c of commits) scanCommit(c);
    count += commits.length;
  }
  finish('push', count);
} else if (mode === '--text') {
  const path = process.argv[3];
  const vendor = isVendorChunk(path);
  if (vendor) console.log(`history-check: ${path} skips the phone pattern (three.js vendor chunk)`);
  scanText(path, textForScan(path, readFileSync(path).toString('latin1')), path, 'content', vendor);
  finish(path, 0);
} else if (mode) {
  console.error('usage: history-check.mjs --all | --pre-push | --text FILE');
  process.exit(2);
}
