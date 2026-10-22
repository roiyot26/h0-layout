import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// Planted dist files for e2e/dist-guard.mjs. Every address and number is built at
// runtime from neutral parts, so this file holds no email or phone shape itself.
const guard = new URL('../e2e/dist-guard.mjs', import.meta.url).pathname;
const at = String.fromCharCode(64);
const user = ['user', 'example'];
const host = ['example', 'com'].join('.');
const dirs: string[] = [];

function run(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'h0-guard-'));
  dirs.push(dir);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  try {
    const out = execFileSync('node', [guard], { env: { ...process.env, DIST_DIR: dir }, encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string };
    return { code: err.status, out: err.stdout };
  }
}

const page = (body: string) => `<!doctype html>\n<html><body>\n<p>${body}</p>\n</body></html>\n`;

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe('dist-guard', () => {
  it('passes a clean page', () => {
    expect(run({ 'index.html': page('Roi Yotvat, Full-stack developer') }).code).toBe(0);
  });

  describe('email channels a browser still renders', () => {
    const cases: [string, string][] = [
      ['decimal entity without semicolon', `${user[0]}&#64${host}`],
      ['hex entity without semicolon', `${user[0]}&#x40${host}`],
      ['named entity without semicolon', `${user[0]}&commat${host}`],
      ['@ split across tags', `${user[0]}<span>${at}</span>${host}`],
      ['address split across several tags', `<b>${user[0]}</b><i>&#64;</i><b>${host}</b>`],
      ['entity colon and percent-encoded @', `<a href="MAILTO&#58${user[0]}%40${host}">write</a>`],
      ['percent-encoded mailto', `<a href="%6Dailto%3A${user[0]}%40${host}">write</a>`],
    ];
    for (const [name, body] of cases) {
      it(`fails on ${name}`, () => {
        const r = run({ 'index.html': page(body) });
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/FAIL index\.html:\d+: (mailto|email address|entity-encoded @)/);
      });
    }

    it('passes the shipped email link: an "Email" label over reversed parts', () => {
      const rev = (x: string) => [...x].reverse().join('');
      const link = `<a class="email" href="/h0-layout/contact/" data-u="${rev('user')}" data-d="${rev('example')}" data-t="${rev('com')}"><span class="visually-hidden">Email</span><span aria-hidden="true"><span class="rev">${rev('user')}</span> [at] example [dot] com</span></a>`;
      const js = `const f=s=>[...s].reverse().join('');a.textContent='Email';a.href=f(':otliam')+f(u)+String.fromCharCode(64)+f(d)+'.'+f(t);`;
      expect(run({ 'index.html': page(link), 'main.js': js }).code).toBe(0);
    });

    it('fails when the address is written out as the link text', () => {
      const r = run({ 'index.html': page(`<a class="email" href="/h0-layout/contact/">${user[0]}${at}${host}</a>`) });
      expect(r.code).toBe(1);
      expect(r.out).toMatch(/FAIL index\.html:\d+: email address/);
    });

    it('never prints any part of the match', () => {
      const r = run({ 'index.html': page(`${user[0]}<span>${at}</span>${host}`) });
      expect(r.out).not.toContain(user[0]);
      expect(r.out).not.toContain(host);
    });
  });

  describe('phone numbers, using the repo findPhone rule', () => {
    const cases: [string, string][] = [
      ['dotted mobile', ['050', '123', '4567'].join('.')],
      ['972 without the plus', ['972', '50', '123', '4567'].join('-')],
      ['landline', ['03', '123', '4567'].join('-')],
      ['number split across tags', `${['050', '123'].join('-')}<span>-4567</span>`],
      ['number with entity separators', ['050', '123', '4567'].join('&#45;')],
    ];
    for (const [name, body] of cases) {
      it(`fails on ${name}`, () => {
        const r = run({ 'index.html': page(body) });
        expect(r.code).toBe(1);
        expect(r.out).toMatch(/FAIL index\.html:\d+: phone number/);
        expect(r.out).not.toMatch(/\d{3}[-.]\d{3}/);
      });
    }

    it('ignores versions, sizes and ids', () => {
      expect(run({ 'index.html': page('three 0.186.1, 5331 mm, 95028994') }).code).toBe(0);
    });

    it('ignores float literals in bundled code', () => {
      const js = `const k=vec3(${['0', '5', '87'].join('.').replace('.87', '87')}00000000,0.2126729,0.0721750);`;
      expect(run({ 'index.js': js }).code).toBe(0);
    });
  });
});
