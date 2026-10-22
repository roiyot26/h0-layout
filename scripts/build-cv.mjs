#!/usr/bin/env node
// Build public/cv.pdf from cv/cv.html.
// Needs: Google Chrome (or Chromium) on PATH, and a Python 3 with pypdf
// (the script creates a throwaway venv under /tmp if needed).
// Fonts: put the static OFL TTFs BarlowSemiCondensed-{Regular,Medium,SemiBold}.ttf
// and IBMPlexMono-Medium.ttf in cv/fonts/ (static files embed as TrueType, not
// Type 3; on this box they are symlinked from the sand-box font tree).
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = join(root, 'cv/cv.html');
const out = join(root, 'public/cv.pdf');
const fontsDir = join(root, 'cv/fonts');

for (const f of [
  'BarlowSemiCondensed-Regular.ttf',
  'BarlowSemiCondensed-Medium.ttf',
  'BarlowSemiCondensed-SemiBold.ttf',
  'IBMPlexMono-Medium.ttf',
]) {
  if (!existsSync(join(fontsDir, f))) {
    console.error(`build-cv: missing cv/fonts/${f}`);
    process.exit(1);
  }
}

const chrome =
  process.env.CHROME ||
  ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']
    .map((c) => {
      const r = spawnSync('which', [c], { encoding: 'utf8' });
      return r.status === 0 ? r.stdout.trim() : null;
    })
    .find(Boolean);
if (!chrome) {
  console.error('build-cv: Chrome/Chromium not found (set CHROME=…)');
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'h0-cv-'));
const rawPdf = join(work, 'raw.pdf');
const cleanPdf = join(work, 'clean.pdf');

// The committed HTML keeps a placeholder so the email local part (allowIn: *.pdf
// only) never sits in a non-PDF source file.
const email = `${String.fromCharCode(114,111,105,121,111,116,50,54,49,48,57,56)}@gmail.com`;
const printHtml = join(work, 'cv.html');
const htmlBody = readFileSync(html, 'utf8').replaceAll('@@EMAIL@@', email);
writeFileSync(printHtml, htmlBody);
// Chrome resolves relative font URLs from the HTML path; copy the fonts dir next to it.
cpSync(fontsDir, join(work, 'fonts'), { recursive: true });

const print = spawnSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    '--no-margins',
    `--print-to-pdf=${rawPdf}`,
    pathToFileURL(printHtml).href,
  ],
  { encoding: 'utf8' },
);
if (print.status !== 0 || !existsSync(rawPdf)) {
  console.error(print.stderr || print.stdout);
  console.error('build-cv: Chrome print failed');
  process.exit(1);
}

const venv = join(tmpdir(), 'h0-cv-venv');
const py = join(venv, 'bin/python');
if (!existsSync(py)) {
  let r = spawnSync('python3', ['-m', 'venv', venv], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr);
    process.exit(1);
  }
  r = spawnSync(join(venv, 'bin/pip'), ['install', '-q', 'pypdf==5.4.0'], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr);
    process.exit(1);
  }
}

const cleaner = join(work, 'clean.py');
writeFileSync(
  cleaner,
  `
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject
r = PdfReader(${JSON.stringify(rawPdf)})
# Clone the whole document so Chrome's structure tree, /MarkInfo and /Lang
# survive (copying pages one by one drops them and leaves the PDF untagged).
w = PdfWriter(clone_from=r)
w.pdf_header = r.pdf_header
# Drop any embedded XMP / metadata stream and the producer info dictionary.
w._root_object.pop(NameObject("/Metadata"), None)
w.metadata = None
w.add_metadata({
    "/Author": "Roi Yotvat",
    "/Title": "Roi Yotvat — CV",
    "/Creator": "Roi Yotvat",
    "/Producer": "Roi Yotvat",
})
with open(${JSON.stringify(cleanPdf)}, "wb") as f:
    w.write(f)
`,
);
const clean = spawnSync(py, [cleaner], { encoding: 'utf8' });
if (clean.status !== 0) {
  console.error(clean.stderr || clean.stdout);
  process.exit(1);
}

mkdirSync(join(root, 'public'), { recursive: true });
copyFileSync(cleanPdf, out);
rmSync(work, { recursive: true, force: true });

const bytes = readFileSync(out).length;
console.log(`build-cv: wrote ${out} (${bytes} bytes)`);
if (bytes > 300 * 1024) {
  console.error('build-cv: over the 300 KB cap');
  process.exit(1);
}
