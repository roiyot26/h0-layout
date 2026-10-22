import { describe, expect, it } from 'vitest';
import { assemble } from '../src/email';

// A stand-in for the anchor (the unit tests run without a DOM). The parts are made up,
// reversed the way pages.ts writes them, so this file holds no real address.
function fakeLink() {
  const attrs = new Map<string, string>([['aria-label', 'Email']]);
  const link = {
    href: '/h0-layout/contact/',
    textContent: 'resu [at] elpmaxe [dot] tset',
    dataset: { u: 'resu', d: 'elpmaxe', t: 'tset' } as Record<string, string | undefined>,
    getAttribute: (k: string) => attrs.get(k) ?? null,
    removeAttribute: (k: string) => void attrs.delete(k),
  };
  return link;
}

describe('email link accessible name', () => {
  it('keeps aria-label="Email" until the address is written', () => {
    const link = fakeLink();
    expect(link.getAttribute('aria-label')).toBe('Email');
    link.dataset.u = undefined;
    assemble(link as unknown as HTMLAnchorElement);
    expect(link.getAttribute('aria-label')).toBe('Email');
  });

  it('drops the label once the real address is the link text', () => {
    const link = fakeLink();
    assemble(link as unknown as HTMLAnchorElement);
    expect(link.textContent).toBe(['user', 'example.test'].join(String.fromCharCode(64)));
    expect(link.href.startsWith('mailto:')).toBe(true);
    expect(link.getAttribute('aria-label')).toBeNull();
  });
});
