import { describe, expect, it } from 'vitest';
import { assemble, label, LABEL } from '../src/email';

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

const address = ['user', 'example.test'].join(String.fromCharCode(64));

describe('email link', () => {
  it('reads just "Email" once the script runs, with no aria-label', () => {
    const link = fakeLink([['aria-label', 'Email']]);
    label(link as unknown as HTMLAnchorElement);
    expect(LABEL).toBe('Email');
    expect(link.innerHTML).toBe('Email');
    expect(link.getAttribute('aria-label')).toBeNull();
  });

  it('sets only the mail href, never the address as text', () => {
    const link = fakeLink();
    label(link as unknown as HTMLAnchorElement);
    assemble(link as unknown as HTMLAnchorElement);
    expect(link.href).toBe(`mailto:${address}`);
    expect(link.innerHTML).toBe('Email');
    expect(link.innerHTML).not.toContain(String.fromCharCode(64));
  });

  it('leaves a link without parts alone', () => {
    const link = fakeLink();
    link.dataset.u = undefined;
    assemble(link as unknown as HTMLAnchorElement);
    expect(link.href).toBe('/h0-layout/contact/');
    expect(link.innerHTML).toBe(STATIC);
  });
});
