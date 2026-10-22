// The email address is never in the HTML. Each link carries its parts reversed in
// data attributes; on focus, pointerdown or click the address is rebuilt and the
// link becomes a mail link. The scheme is assembled too, so the built script holds
// no literal mail-link prefix. The static link's aria-label ("Email") is dropped
// once the real address is its text, so the address becomes the accessible name.
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
