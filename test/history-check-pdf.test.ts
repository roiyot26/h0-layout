import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// Goes through the real CLI path (`--text FILE`), so a *.pdf is scanned the
// way the history job scans it. Fixtures are built at runtime, so the repo
// never stores a phone-number shape.
const dir = mkdtempSync(join(tmpdir(), 'h0-pdf-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// A minimal one-page PDF with a standard font and `text` drawn on the page.
// With `widths`, the font dictionary also holds an uncompressed widths table.
function makePdf(text: string, widths: number[] = []): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    widths.length
      ? `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /FirstChar 32 /LastChar ${31 + widths.length} /Widths [${widths.join(' ')}] >>`
      : '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function scan(name: string, bytes: Buffer): { code: number; out: string } {
  const file = join(dir, name);
  writeFileSync(file, new Uint8Array(bytes));
  try {
    const out = execFileSync('node', ['scripts/history-check.mjs', '--text', file], { stdio: 'pipe' }).toString();
    return { code: 0, out };
  } catch (err) {
    const e = err as { status: number; stdout: Buffer; stderr: Buffer };
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
}

// A run of widths that the phone pattern matches when read as raw bytes.
const widthRun = [0, 561, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const phoneText = ['054', ['123', '4567'].join('')].join('-');

describe('history check on PDFs', () => {
  it('passes a PDF whose only digit runs are in its widths table', () => {
    const r = scan('widths.pdf', makePdf('Tel Aviv', widthRun));
    expect(r.code, r.out).toBe(0);
  });
  it('flags a phone number drawn as PDF text', () => {
    const r = scan('phone.pdf', makePdf(`Call ${phoneText}`));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/phone number pattern/);
  });
  it('fails closed on a PDF it cannot read', () => {
    const r = scan('corrupt.pdf', Buffer.from('%PDF-1.4\nnot really a pdf\n', 'latin1'));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/could not extract PDF text/);
  });
});
