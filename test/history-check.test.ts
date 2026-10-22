import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without types
import { blankIds, findBanned, findPhone, findPhoneOutsideIds, hashTerm, tokenize } from '../scripts/history-check.mjs';

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

describe('ID blanking before the phone scan', () => {
  // Built at runtime so the file itself holds no phone-number shape. The hex
  // head of each ID reads like a mobile number on its own.
  const head = ['a0', '50', '1234'].join('');
  const guid = [head, '567a', 'cdef', 'abcd', 'ef0123456789'].join('-');
  const join = (sep: string, ...parts: string[]) => parts.join(sep);

  it('the raw IDs would trip the phone check', () => {
    expect(findPhone(guid)).toBe(true);
    expect(findPhone(`xmpMM:InstanceID="xmp.iid:${guid}"`)).toBe(true);
  });

  it('a bare GUID, uuid: or xmp.iid/did/id value no longer trips it', () => {
    expect(findPhoneOutsideIds(guid)).toBe(false);
    expect(findPhoneOutsideIds(`<xmpMM:DocumentID>uuid:${guid}</xmpMM:DocumentID>`)).toBe(false);
    expect(findPhoneOutsideIds(`xmpMM:InstanceID="xmp.iid:${guid}"`)).toBe(false);
    expect(findPhoneOutsideIds(`xmp.did:${guid.toUpperCase()}`)).toBe(false);
    expect(findPhoneOutsideIds(`xmp.id:${guid.replace(/-/g, '')}`)).toBe(false);
  });

  it('a real phone-shaped number still trips it, next to an ID or alone', () => {
    const phone = join('-', '050', '123', '4567');
    expect(findPhoneOutsideIds(phone)).toBe(true);
    expect(findPhoneOutsideIds(`xmp.iid:${guid} call ${phone}`)).toBe(true);
    expect(findPhoneOutsideIds(join(' ', '+972', '50', '123', '4567'))).toBe(true);
  });

  it('blanks only exact ID shapes', () => {
    expect(blankIds(`uuid:${guid}`)).toBe('[id]');
    // One hex digit short of a GUID is left alone.
    const short = guid.slice(0, -1);
    expect(blankIds(short)).toBe(short);
    expect(findPhoneOutsideIds(short)).toBe(true);
  });

  it('leaves the text the banned-term scan sees untouched', () => {
    expect(findBanned(`semaphore uuid:${guid}`, null, table)).toHaveLength(1);
    expect(findBanned(blankIds(`uuid:${guid}`), null, table)).toHaveLength(0);
  });
});
