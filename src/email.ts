// The email address is never in the HTML, and never shown as text. Each link carries
// its parts reversed in data attributes. With JS on, the link's text becomes just
// "Email" as soon as the page script runs (replacing the "[at]/[dot]" fallback and
// its hidden "Email" name), and on focus, pointerdown or click the address is rebuilt
// into the href only, so the link becomes a mail link. The scheme is assembled too,
// so the built script holds no literal mail-link prefix.
const flip = (s: string | undefined): string => [...(s ?? '')].reverse().join('');

export const LABEL = 'Email';

/** Show the link as plain "Email": its visible text and accessible name. */
export function label(a: HTMLAnchorElement): void {
  if (a.textContent !== LABEL) a.textContent = LABEL;
  a.removeAttribute('aria-label');
}

/** Point the link at the address. Only the href changes; the text stays "Email". */
export function assemble(a: HTMLAnchorElement): void {
  if (a.dataset.ready) return;
  const { u, d, t } = a.dataset;
  if (!u || !d || !t) return;
  a.href = flip(':otliam') + `${flip(u)}${String.fromCharCode(64)}${flip(d)}.${flip(t)}`;
  a.dataset.ready = '1';
}

export function wireEmail(root: ParentNode): void {
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[data-u]')) {
    label(a);
    const go = () => assemble(a);
    a.addEventListener('focus', go);
    a.addEventListener('pointerdown', go);
    a.addEventListener('click', go);
  }
}
