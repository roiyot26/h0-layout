import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without types
import { findBanned, findPhone, hashTerm, tokenize } from '../scripts/history-check.mjs';

// The real list holds hashes only. These tests use a stand-in list built from
// neutral words, so no banned term has to appear here.
const table = new Map<string, { h: string; allowIn?: string[]; scope?: 'metadata' }>();
for (const term of ['semaphore', 'goodsshed', 'turnoutcoil']) table.set(hashTerm(term), { h: hashTerm(term) });
table.set(hashTerm('ballast2026'), { h: hashTerm('ballast2026'), allowIn: ['*.pdf'] });
// A two-word term and a metadata-only word, built at runtime.
const pairWords: [string, string] = ['signal', 'box'];
table.set(hashTerm(pairWords.join('')), { h: hashTerm(pairWords.join('')) });
const metaWord = ['plat', 'form'].join('');
table.set(hashTerm(metaWord), { h: hashTerm(metaWord), scope: 'metadata' });

describe('tokenize', () => {
  it('splits camelCase, digits and punctuation', () => {
    expect(tokenize('stationHopDelay')).toEqual(['station', 'hop', 'delay']);
    expect(tokenize('Goods-Shed_v2')).toEqual(['goods', 'shed', 'v2']);
  });
});

describe('findBanned', () => {
  it('matches whole words, any case, in camelCase and paths', () => {
    expect(findBanned('a Semaphore here', null, table)).toHaveLength(1);
    expect(findBanned('fixSemaphoreTiming', null, table)).toHaveLength(1);
    expect(findBanned('feature/semaphore-fix', null, table)).toHaveLength(1);
    expect(findBanned('semaphores', null, table)).toHaveLength(1);
  });
  it('does not match a word that only contains the term', () => {
    expect(findBanned('semaphoreless', null, table)).toHaveLength(0);
  });
  it('matches multi-token terms across separators', () => {
    expect(findBanned('goods-shed', null, table)).toHaveLength(1);
    expect(findBanned('x@turnout.coil', null, table)).toHaveLength(1);
  });
  it('applies path rules to file contents only', () => {
    expect(findBanned('ballast2026@example', null, table)).toHaveLength(1);
    expect(findBanned('ballast2026@example', 'cv/notes.md', table)).toHaveLength(1);
    expect(findBanned('ballast2026@example', 'public/cv.pdf', table)).toHaveLength(0);
    expect(findBanned('semaphore', 'public/cv.pdf', table)).toHaveLength(1);
  });
});

describe('pairs and scopes', () => {
  it('matches a two-word term with any whitespace or punctuation between the words', () => {
    const [a, b] = pairWords;
    expect(findBanned(`the ${a} ${b} at the end`, null, table)).toHaveLength(1);
    expect(findBanned(`${a.toUpperCase()} \t\n  ${b}`, null, table)).toHaveLength(1);
    expect(findBanned(`${a}-${b}`, null, table)).toHaveLength(1);
    expect(findBanned(`${a} only, then ${b}`, null, table)).toHaveLength(0);
  });
  it('applies metadata-only terms to messages and refs, not to files or paths', () => {
    expect(findBanned(`Fix the ${metaWord} sign`, null, table, 'metadata')).toHaveLength(1);
    expect(findBanned(`refs/heads/${metaWord}-fix`, null, table, 'metadata')).toHaveLength(1);
    expect(findBanned(`${metaWord} 1`, 'index.html', table, 'content')).toHaveLength(0);
    expect(findBanned(`docs/${metaWord}.md`, null, table, 'path')).toHaveLength(0);
  });
});

describe('findPhone', () => {
  it('still flags digit runs that look like mobiles when they appear as text', () => {
    // Built at runtime so the file itself holds no phone-number shape.
    // (Raw PDF font-width tables used to trip this; *.pdf content is now scanned
    // via pdftotext in textForScan, so those streams no longer reach findPhone.)
    const widths = ['0', '561', '0', '0', '0', '0', '0', '0', '0'].join(' ');
    expect(findPhone(widths)).toBe(true);
    expect(findPhone('Moveo Creative · Mister Bit · Coding Academy')).toBe(false);
  });

  it('flags phone-number shapes', () => {
    // Built at runtime so the file itself holds no phone-number shape.
    const join = (sep: string, ...parts: string[]) => parts.join(sep);
    expect(findPhone(`call ${join('-', '050', '123', '4567')}`)).toBe(true);
    expect(findPhone(join(' ', '+972', '50', '123', '4567'))).toBe(true);
    expect(findPhone(join(' ', '+1', '415', '555', '0100'))).toBe(true);
  });
  it('ignores versions, sizes and ids', () => {
    expect(findPhone('three 0.186.1, 5331 mm, 95028994')).toBe(false);
  });
});
