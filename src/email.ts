// The email address is never in the HTML. Each link carries its parts reversed in
// data attributes; on focus, pointerdown or click the address is rebuilt and the
// link becomes a mail link. The scheme is assembled too, so the built script holds
// no literal mail-link prefix. Writing the address replaces the static link's hidden
// "Email" name and its aria-hidden fallback, so the address becomes the accessible
// name; any aria-label is dropped too.
const flip = (s: string | undefined): string => [...(s ?? '')].reverse().join('');

export function assemble(a: HTMLAnchorElement): void {
  if (a.dataset.ready) return;
  const { u, d, t } = a.dataset;
  if (!u || !d || !t) return;
  const address = `${flip(u)}@${flip(d)}.${flip(t)}`;
  a.href = flip(':otliam') + address;
  a.textContent = address;
  a.removeAttribute('aria-label');
  a.dataset.ready = '1';
}

export function wireEmail(root: ParentNode): void {
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[data-u]')) {
    const go = () => assemble(a);
    a.addEventListener('focus', go);
    a.addEventListener('pointerdown', go);
    a.addEventListener('click', go);
  }
}
