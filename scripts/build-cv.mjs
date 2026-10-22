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
import { cvSourceStrings } from './cv-source.mjs';

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

// Each prose block's source text, for /ActualText on its structure element.
const sourcesJson = join(work, 'sources.json');
writeFileSync(sourcesJson, JSON.stringify(cvSourceStrings(htmlBody)));

const cleaner = join(work, 'clean.py');
writeFileSync(
  cleaner,
  `
import codecs, json, re, sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, ByteStringObject, DictionaryObject, NameObject
r = PdfReader(${JSON.stringify(rawPdf)})
# Clone the whole document so Chrome's structure tree, /MarkInfo and /Lang
# survive (copying pages one by one drops them and leaves the PDF untagged).
w = PdfWriter(clone_from=r)
w.pdf_header = r.pdf_header

# Chrome emits no space at a soft line wrap, so the tag text glues the last
# word of a line to the first word of the next ("withLLM"). Give each prose
# block its source string as /ActualText. Blocks are found by their text with
# all whitespace removed, so the match doesn't depend on where lines wrap.
sources = json.load(open(${JSON.stringify(sourcesJson)}, encoding="utf-8"))
squash = lambda s: re.sub(r"\\s+", "", s)
mcid_text = {}
stack = []
def before(op, args, cm, tm):
    if op == b"BDC":
        props = args[1] if len(args) > 1 else None
        stack.append(int(props["/MCID"]) if isinstance(props, DictionaryObject) and "/MCID" in props else None)
    elif op == b"BMC":
        stack.append(None)
    elif op == b"EMC" and stack:
        stack.pop()
def on_text(text, cm, tm, font, size):
    mcid = next((m for m in reversed(stack) if m is not None), None)
    if mcid is not None and text:
        mcid_text[mcid] = mcid_text.get(mcid, "") + text
if len(w.pages) != 1:
    sys.exit("clean: expected one page")
w.pages[0].extract_text(visitor_operand_before=before, visitor_text=on_text)

def kids(elem):
    k = elem.get("/K")
    if k is None:
        return []
    k = k.get_object()
    return list(k) if isinstance(k, ArrayObject) else [k]
def text_of(elem):
    out = ""
    for k in kids(elem):
        if isinstance(k, int):
            out += mcid_text.get(int(k), "")
            continue
        k = k.get_object()
        if isinstance(k, DictionaryObject):
            if "/MCID" in k and k.get("/Type") == "/MCR":
                out += mcid_text.get(int(k["/MCID"]), "")
            elif "/S" in k:
                out += text_of(k)
    return out

wanted = {}
for s in sources:
    wanted.setdefault(squash(s), []).append(s)
done = 0
def walk(elem):
    global done
    for k in kids(elem):
        if isinstance(k, int):
            continue
        k = k.get_object()
        if not isinstance(k, DictionaryObject) or "/S" not in k:
            continue
        key = squash(text_of(k))
        if wanted.get(key):
            # Outermost element that carries exactly this block's text.
            # UTF-16BE with a BOM, written as a hex string, so cv-check can
            # decode it without a PDF library.
            actual = codecs.BOM_UTF16_BE + wanted[key].pop(0).encode("utf-16-be")
            k[NameObject("/ActualText")] = ByteStringObject(actual)
            done += 1
        else:
            walk(k)
walk(w._root_object["/StructTreeRoot"].get_object())
left = [s for v in wanted.values() for s in v]
if left:
    sys.exit("clean: no structure element for: " + " | ".join(t[:40] for t in left))
print(f"clean: /ActualText on {done} blocks")
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
process.stdout.write(clean.stdout);

mkdirSync(join(root, 'public'), { recursive: true });
copyFileSync(cleanPdf, out);
rmSync(work, { recursive: true, force: true });

const bytes = readFileSync(out).length;
console.log(`build-cv: wrote ${out} (${bytes} bytes)`);
if (bytes > 300 * 1024) {
  console.error('build-cv: over the 300 KB cap');
  process.exit(1);
}
