import { describe, expect, it } from 'vitest';
import { siteBase } from '../src/base';

describe('siteBase', () => {
  it('defaults to the root', () => {
    expect(siteBase(undefined)).toBe('/');
    expect(siteBase('')).toBe('/');
    expect(siteBase('/')).toBe('/');
  });
  it('always has one leading and one trailing slash', () => {
    expect(siteBase('h0-layout')).toBe('/h0-layout/');
    expect(siteBase('/h0-layout')).toBe('/h0-layout/');
    expect(siteBase('//h0-layout-preview/pr-2//')).toBe('/h0-layout-preview/pr-2/');
  });
});
