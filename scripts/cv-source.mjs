// The CV's prose blocks as written in cv/cv.html, with whitespace collapsed.
// build-cv.mjs puts each one into the tagged PDF as /ActualText, and
// verify-cv.mjs checks the tag text against them, so a soft line wrap can't
// join two words ("withLLM") for a screen reader.
const collapse = (s) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

export function cvSourceStrings(html) {
  const body = html.slice(html.indexOf('<body'));
  const out = [];
  // Paragraphs, list items and skill values, plus a row's bare prose that
  // follows its role line (the education entry).
  const re =
    /<p>([\s\S]*?)<\/p>|<li>([\s\S]*?)<\/li>|<dd>([\s\S]*?)<\/dd>|<div class="role">[^<]*(?:<span[^>]*>[^<]*<\/span>)?\s*<\/div>\s*([^<]+?)\s*<\/div>/g;
  for (const m of body.matchAll(re)) {
    const text = collapse(m[1] ?? m[2] ?? m[3] ?? m[4]);
    if (text) out.push(text);
  }
  return out;
}

// Adjacent word pairs from the source that show up glued together in `text`,
// as { source, glued }.
export function joinedWords(sources, text) {
  const tokens = text.split(/\s+/);
  const sourceText = sources.join(' ');
  const joins = [];
  for (const source of sources) {
    const words = source.split(' ');
    for (let i = 0; i + 1 < words.length; i++) {
      const glued = words[i] + words[i + 1];
      if (sourceText.includes(glued)) continue;
      if (tokens.some((t) => t.includes(glued))) joins.push({ source, glued });
    }
  }
  return joins;
}

// Every /ActualText in a PDF whose objects are written plainly (no object
// streams), decoded from the UTF-16BE hex form build-cv.mjs writes.
export function actualTexts(raw) {
  const out = [];
  for (const m of raw.matchAll(/\/ActualText\s*(<[0-9A-Fa-f\s]*>|\()/g)) {
    const hex = m[1].startsWith('<') ? m[1].slice(1, -1).replace(/\s+/g, '') : '';
    if (!/^feff/i.test(hex) || hex.length % 4) {
      out.push(null); // not in the expected form
      continue;
    }
    const bytes = Buffer.from(hex.slice(4), 'hex');
    out.push(bytes.swap16().toString('utf16le'));
  }
  return out;
}
