import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FLAG_KEYS, parseFlags, readFlags } from '../vite.config';

const file = (name: string) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

describe('build flags', () => {
  it('flags.prod.json has every 3D flag off', () => {
    const prod = parseFlags(file('flags.prod.json'));
    expect(Object.keys(prod).sort()).toEqual([...FLAG_KEYS].sort());
    for (const key of FLAG_KEYS) expect(prod[key], key).toBe(false);
  });

  it('flags.preview.json turns 3D and phone 3D on, discoveries off', () => {
    expect(parseFlags(file('flags.preview.json'))).toEqual({ ENABLE_3D: true, PHONE_3D: true, DISCOVERIES: false });
  });

  it('reads flags.prod.json when FLAGS_FILE is unset', () => {
    expect(readFlags('flags.prod.json')).toEqual(parseFlags(file('flags.prod.json')));
  });

  const bad: [string, string, RegExp][] = [
    ['a missing key', '{ "ENABLE_3D": false, "PHONE_3D": false }', /missing flag DISCOVERIES/],
    ['an unknown key', '{ "ENABLE_3D": false, "PHONE_3D": false, "DISCOVERIES": false, "EXTRA": false }', /unknown flag EXTRA/],
    ['a string value', '{ "ENABLE_3D": "false", "PHONE_3D": false, "DISCOVERIES": false }', /ENABLE_3D must be true or false/],
    ['a number value', '{ "ENABLE_3D": false, "PHONE_3D": 0, "DISCOVERIES": false }', /PHONE_3D must be true or false/],
    ['an array', '[]', /expected an object/],
    ['broken JSON', '{ "ENABLE_3D": ', /not valid JSON/],
  ];
  for (const [name, text, msg] of bad) {
    it(`rejects ${name}`, () => {
      expect(() => parseFlags(text)).toThrow(msg);
    });
  }

  it('rejects a flags file that does not exist', () => {
    expect(() => readFlags('flags.missing.json')).toThrow(/not found/);
  });
});
