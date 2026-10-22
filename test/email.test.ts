import { describe, expect, it } from 'vitest';
import { assemble } from '../src/email';

// A stand-in for the anchor (the unit tests run without a DOM). The parts are made up,
// reversed the way pages.ts writes them, so this file holds no real address. Setting
// textContent replaces the link's children, as it does in a browser.
const STATIC = '<span class="visually-hidden">Email</span><span aria-hidden="true">…</span>';

function fakeLink(attrs: [string, string][] = []) {
  const a = new Map(attrs);
  return {
    href: '/h0-layout/contact/',
    innerHTML: STATIC,
    set textContent(v: string) { this.innerHTML = v; },
    get textContent() { return this.innerHTML; },
    dataset: { u: 'resu', d: 'elpmaxe', t: 'tset' } as Record<string, string | undefined>,
    getAttribute: (k: string) => a.get(k) ?? null,
    removeAttribute: (k: string) => void a.delete(k),
  };
}

describe('email link accessible name', () => {
  it('keeps the hidden "Email" name until the address is written', () => {
    const link = fakeLink();
    link.dataset.u = undefined;
    assemble(link as unknown as HTMLAnchorElement);
    expect(link.innerHTML).toBe(STATIC);
  });

  it('replaces the "Email" name with the address once it is written', () => {
    const link = fakeLink([['aria-label', 'Email']]);
    assemble(link as unknown as HTMLAnchorElement);
    expect(link.innerHTML).toBe(['user', 'example.test'].join(String.fromCharCode(64)));
    expect(link.innerHTML).not.toContain('Email');
    expect(link.href.startsWith('mailto:')).toBe(true);
    expect(link.getAttribute('aria-label')).toBeNull();
  });
});
