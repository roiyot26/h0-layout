// The known findings in the pinned three.js vendor chunk, shared by scripts/history-check.mjs
// and e2e/dist-guard.mjs.
//
// Minified three.js holds digit runs that the phone rules read as a number. Rather than
// skip rules for the whole chunk, each known finding is listed here by the SHA-256 of the
// exact matched string, the character just before it and how many times it occurs in
// the build. Only those occurrences are blanked (same length, so line numbers hold), and
// only in assets/three-<8>.js. Every rule then runs on what is left, so anything planted
// in the chunk still fails. The strings themselves are not written here: they are phone
// shaped, and the history check scans this file too.
//
// The list belongs to one three.js version. After an upgrade, rebuild, list the new
// findings and update THREE_VERSION and VENDOR_FINDINGS together. An unlisted finding
// fails both guards, so a stale list fails closed.
import { createHash } from 'node:crypto';

export const THREE_VERSION = '0.186.1';

// The three.js vendor chunk by its exact built name, relative to the dist root (M2 spec,
// opening PR backlog 1).
export const VENDOR_CHUNK = /^assets\/three-[A-Za-z0-9_-]{8}\.js$/;

/** True when a built file's path ends in assets/three-<8>.js (any dist directory). */
export const isVendorChunk = (path) =>
  VENDOR_CHUNK.test(path.replace(/\\/g, '/').split('/').slice(-2).join('/'));

/**
 * @typedef {{ rule: 'phone' | 'email', sha256: string, length: number, before: string,
 *   count: number, what: string }} VendorFinding
 */

/** @type {VendorFinding[]} */
export const VENDOR_FINDINGS = [
  {
    rule: 'phone',
    sha256: 'fd3314ab1b68e99f6f3f743930ca4eaac248da8b07a2893a29fb7fa8c3059130',
    length: 10,
    before: '.',
    count: 3,
    what: 'the fraction digits of the sRGB-to-linear offset, minified without its leading 0',
  },
];

const sha = (s) => createHash('sha256').update(s).digest('hex');
const globalCopy = (re) => new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);

/**
 * Blanks the listed vendor findings in `text`. `patterns` are the caller's own rule
 * patterns; every match of any of them that is a listed finding (same string, same
 * preceding character) is replaced with "x"s, up to the listed count per finding.
 * Returns the blanked text and how many occurrences were blanked.
 *
 * @param {string} text
 * @param {RegExp[]} patterns
 * @param {VendorFinding[]} [findings]
 * @returns {{ text: string, blanked: number }}
 */
export function blankVendorFindings(text, patterns, findings = VENDOR_FINDINGS) {
  const left = new Map(findings.map((f) => [f, f.count]));
  const spans = new Map();
  for (const re of patterns) {
    for (const m of text.matchAll(globalCopy(re))) {
      const key = `${m.index}:${m[0].length}`;
      if (spans.has(key)) continue;
      const f = findings.find(
        (e) => e.length === m[0].length && text[m.index - 1] === e.before && e.sha256 === sha(m[0]),
      );
      if (f) spans.set(key, { start: m.index, end: m.index + m[0].length, f });
    }
  }
  let out = text;
  let blanked = 0;
  for (const { start, end, f } of [...spans.values()].sort((a, b) => a.start - b.start)) {
    if (left.get(f) === 0) continue;
    left.set(f, left.get(f) - 1);
    out = out.slice(0, start) + 'x'.repeat(end - start) + out.slice(end);
    blanked++;
  }
  return { text: out, blanked };
}
