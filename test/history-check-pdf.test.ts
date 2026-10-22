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
// `info` adds a document-info dictionary and `xmp` an XMP metadata stream.
function makePdf(
  text: string,
  widths: number[] = [],
  meta: { info?: Record<string, string>; xmp?: string } = {},
): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objs = [
    meta.xmp ? '<< /Type /Catalog /Pages 2 0 R /Metadata 6 0 R >>' : '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    widths.length
      ? `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /FirstChar 32 /LastChar ${31 + widths.length} /Widths [${widths.join(' ')}] >>`
      : '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  if (meta.xmp) objs.push(`<< /Type /Metadata /Subtype /XML /Length ${meta.xmp.length} >>\nstream\n${meta.xmp}\nendstream`);
  if (meta.info) objs.push(`<< ${Object.entries(meta.info).map(([k, v]) => `/${k} (${v})`).join(' ')} >>`);
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  const infoRef = meta.info ? ` /Info ${objs.length} 0 R` : '';
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R${infoRef} >>\nstartxref\n${xref}\n%%EOF\n`;
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

const xmp = (fields: string) => '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>'
  + '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
  + '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/">'
  + `${fields}</rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;

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
  it('flags a phone number that is only in the Author field', () => {
    const r = scan('author.pdf', makePdf('Tel Aviv', [], { info: { Title: 'CV', Author: phoneText } }));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/phone number pattern/);
  });
  it('flags a phone number that is only in the XMP metadata', () => {
    const r = scan('xmp.pdf', makePdf('Tel Aviv', [], { xmp: xmp(`<dc:creator>${phoneText}</dc:creator>`) }));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/phone number pattern/);
  });
  it('flags a phone number on a continuation line of a multi-line field', () => {
    const r = scan('multiline.pdf', makePdf('Tel Aviv', [], { info: { Title: 'CV', Subject: `Contact\\n${phoneText}` } }));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/phone number pattern/);
  });
  it('flags a phone number in a custom document-info key', () => {
    const r = scan('custom.pdf', makePdf('Tel Aviv', [], { info: { Title: 'CV', Note: phoneText } }));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/phone number pattern/);
  });
  it('does not flag XMP timestamps or document IDs', () => {
    const fields = '<xmp:CreateDate>2026-10-22T12:38:40+03:00</xmp:CreateDate>'
      + '<xmpMM:DocumentID>uuid:0b6a1c2e-1234-4a5b-9c8d-001122334455</xmpMM:DocumentID>';
    const r = scan('dates.pdf', makePdf('Tel Aviv', [], { info: { Title: 'CV' }, xmp: xmp(fields) }));
    expect(r.code, r.out).toBe(0);
  });
  it('fails closed on a PDF it cannot read', () => {
    const r = scan('corrupt.pdf', Buffer.from('%PDF-1.4\nnot really a pdf\n', 'latin1'));
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/could not extract PDF text/);
  });
});
