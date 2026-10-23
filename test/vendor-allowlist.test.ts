import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without types
import { VENDOR_PATTERNS } from '../e2e/dist-guard.mjs';
// @ts-expect-error plain ESM script without types
import { THREE_VERSION, VENDOR_CHUNK, VENDOR_FINDINGS, blankVendorFindings, isVendorChunk } from '../scripts/vendor-allowlist.mjs';

// The real vendor chunk from a preview build, planted with a phone number and an email
// address, through both guards' CLIs. Every planted value is built at runtime from
// neutral parts, and no test prints a match.
const root = process.cwd();
const work = mkdtempSync(join(tmpdir(), 'h0-vendor-'));
const built = join(work, 'build');
const guard = join(root, 'e2e/dist-guard.mjs');
const history = join(root, 'scripts/history-check.mjs');
const phone = ['050', '123', '4567'].join('-');
const email = ['someone', String.fromCharCode(64), ['example', 'org'].join('.')].join('');
let chunkName = '';
let chunk = '';

beforeAll(() => {
  execFileSync('npx', ['vite', 'build', '--logLevel', 'error'], {
    cwd: root,
    env: { ...process.env, SITE_BASE: '/h0-layout/', FLAGS_FILE: 'flags.preview.json', OUT_DIR: built },
    stdio: 'ignore',
  });
  chunkName = readdirSync(join(built, 'assets')).find((f) => /^three-.*\.js$/.test(f)) ?? '';
  chunk = readFileSync(join(built, 'assets', chunkName), 'utf8');
}, 120_000);
afterAll(() => rmSync(work, { recursive: true, force: true }));

function run(cmd: string, args: string[], env: Record<string, string> = {}) {
  try {
    const out = execFileSync(process.execPath, [cmd, ...args], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out: out.toString() };
  } catch (err) {
    const e = err as { status: number; stdout: Buffer; stderr: Buffer };
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
}

/** A dist holding only the vendor chunk, with `text` as its contents; both guards run on it. */
function guards(text: string) {
  const dist = mkdtempSync(join(work, 'dist-'));
  const file = join(dist, 'assets', chunkName);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return { guard: run(guard, [], { DIST_DIR: dist }), history: run(history, ['--text', file]) };
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe('the shared three.js allowlist', () => {
  it('is pinned to the installed three.js', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'node_modules/three/package.json'), 'utf8'));
    const lock = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(pkg.version).toBe(THREE_VERSION);
    expect(lock.dependencies?.three ?? lock.devDependencies?.three).toBe(THREE_VERSION);
  });

  it('is the one both guards import', () => {
    for (const f of ['e2e/dist-guard.mjs', 'scripts/history-check.mjs']) {
      const src = readFileSync(join(root, f), 'utf8');
      expect(src, f).toMatch(/from '\.{1,2}\/(?:scripts\/)?vendor-allowlist\.mjs'/);
      expect(src, f).not.toMatch(/three-\[A-Za-z0-9/);
    }
  });

  it('matches only assets/three-<8>.js', () => {
    expect(VENDOR_CHUNK.test('assets/three-AbCd_-12.js')).toBe(true);
    expect(isVendorChunk('/tmp/x/dist-3d/assets/three-AbCd1234.js')).toBe(true);
    for (const p of [
      'dist/assets/three-AbCd123.js',
      'dist/assets/three-AbCd12345.js',
      'dist/assets/three-AbCd1234.js.map',
      'dist/assets/three-AbCd1234.mjs',
      'dist/assets/world-AbCd1234.js',
      'dist/vendor/three-AbCd1234.js',
      'dist/assets/xthree-AbCd1234.js',
    ]) expect(isVendorChunk(p), p).toBe(false);
  });

  it('lists exactly the findings in the built chunk, each as often as it occurs', () => {
    expect(VENDOR_CHUNK.test(`assets/${chunkName}`)).toBe(true);
    const { text, blanked } = blankVendorFindings(chunk, VENDOR_PATTERNS);
    expect(blanked).toBe(VENDOR_FINDINGS.reduce((n: number, f: { count: number }) => n + f.count, 0));
    for (const re of VENDOR_PATTERNS) expect(new RegExp(re.source, re.flags).test(text), String(re)).toBe(false);
  });

  it('passes the clean vendor chunk in both guards', () => {
    const r = guards(chunk);
    expect(r.guard.code, r.guard.out).toBe(0);
    expect(r.guard.out).toContain(`listed finding(s) blanked (three ${THREE_VERSION})`);
    expect(r.history.code, r.history.out).toBe(0);
    expect(r.history.out).toContain('listed three.js finding(s) blanked');
  });

  const plant = (s: string) => chunk.replace('export{', `const __planted="${s}";export{`);

  it('fails a phone number planted in the vendor chunk, in both guards', () => {
    const r = guards(plant(phone));
    expect(r.guard.code).toBe(1);
    expect(r.guard.out).toMatch(/FAIL assets\/three-[\w-]{8}\.js:\d+: phone number/);
    expect(r.history.code).toBe(1);
    expect(r.history.out).toContain(': phone number pattern');
    for (const o of [r.guard.out, r.history.out]) expect(o).not.toContain('4567');
  });

  it('fails an email address planted in the vendor chunk, in both guards', () => {
    const r = guards(plant(email));
    expect(r.guard.code).toBe(1);
    expect(r.guard.out).toMatch(/FAIL assets\/three-[\w-]{8}\.js:\d+: email address/);
    expect(r.history.code).toBe(1);
    expect(r.history.out).toContain(': email address pattern');
    for (const o of [r.guard.out, r.history.out]) expect(o).not.toContain('someone');
  });

  it('fails one more copy of a listed finding than the build holds, in both guards', () => {
    // Find the listed string in the chunk by its hash, then plant one extra copy.
    const f = VENDOR_FINDINGS[0];
    const runs = chunk.match(new RegExp(`\\${f.before}\\d{${f.length}}(?!\\d)`, 'g')) ?? [];
    const hit = runs.map((s) => s.slice(1)).find((s) => sha(s) === f.sha256);
    expect(hit).toBeDefined();
    const r = guards(chunk.replace('export{', `const __planted=${f.before}${hit};export{`));
    expect(r.guard.code).toBe(1);
    expect(r.history.code).toBe(1);
  });

  it('does not blank a listed string outside the vendor chunk', () => {
    const dist = mkdtempSync(join(work, 'dist-'));
    mkdirSync(join(dist, 'assets'), { recursive: true });
    const world = join(dist, 'assets', 'world-AbCd1234.js');
    copyFileSync(join(built, 'assets', chunkName), world);
    expect(run(guard, [], { DIST_DIR: dist }).code).toBe(1);
    expect(run(history, ['--text', world]).code).toBe(1);
  });
});
