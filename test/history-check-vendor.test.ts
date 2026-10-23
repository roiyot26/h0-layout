import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without types
import { VENDOR_CHUNK as GUARD_VENDOR } from '../e2e/dist-guard.mjs';
// @ts-expect-error plain ESM script without types
import { VENDOR_CHUNK, isVendorChunk } from '../scripts/history-check.mjs';

// The three.js vendor chunk skips the phone rule in `--text` mode (the preview job
// scans every built file this way). These go through the real CLI. The planted number
// is built at runtime, so this file holds no phone shape itself.
const dir = mkdtempSync(join(tmpdir(), 'h0-vendor-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const phone = ['050', '123', '4567'].join('-');
const script = join(process.cwd(), 'scripts/history-check.mjs');

function scan(rel: string, text: string): { code: number; out: string } {
  const file = join(dir, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  try {
    const out = execFileSync(process.execPath, [script, '--text', file], { stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, out: out.toString() };
  } catch (err) {
    const e = err as { status: number; stdout: Buffer; stderr: Buffer };
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
}
const js = (s: string) => `var a=1;const t="${s}";export{t};\n`;

describe('history-check vendor chunk', () => {
  it('shares one pattern with dist-guard', () => {
    expect(GUARD_VENDOR).toBe(VENDOR_CHUNK);
    expect(VENDOR_CHUNK.source).toBe('^assets\\/three-[A-Za-z0-9_-]{8}\\.js$');
  });

  it('matches only assets/three-<8>.js under any dist directory', () => {
    expect(isVendorChunk('dist/assets/three-AbCd_-12.js')).toBe(true);
    expect(isVendorChunk('/tmp/x/dist-3d/assets/three-AbCd1234.js')).toBe(true);
    for (const p of [
      'dist/assets/three-AbCd123.js',
      'dist/assets/three-AbCd12345.js',
      'dist/assets/three-AbCd1234.js.map',
      'dist/assets/three-AbCd1234.mjs',
      'dist/assets/world-AbCd1234.js',
      'dist/assets/boot-AbCd1234.js',
      'dist/vendor/three-AbCd1234.js',
      'dist/assets/xthree-AbCd1234.js',
      'dist/assets/three-AbCd.234.js',
    ]) expect(isVendorChunk(p), p).toBe(false);
  });

  it('lets the planted number through in the vendor chunk, and says so', () => {
    const r = scan('dist/assets/three-AbCd1234.js', js(phone));
    expect(r.code).toBe(0);
    expect(r.out).toContain('skips the phone pattern (three.js vendor chunk)');
  });

  for (const rel of [
    'dist/assets/world-AbCd1234.js',
    'dist/assets/boot-AbCd1234.js',
    'dist/assets/three-AbCd123.js',
    'dist/assets/three-AbCd1234.js.map',
    'dist/vendor/three-AbCd1234.js',
    'dist/index.html',
  ]) {
    it(`still catches the planted number in ${rel}`, () => {
      const r = scan(rel, js(phone));
      expect(r.code).toBe(1);
      expect(r.out).toContain(': phone number pattern');
      expect(r.out).not.toContain('vendor chunk');
    });
  }
});
