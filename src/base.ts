// SITE_BASE is the one place the site's public path is set. It is read by Vite
// (vite.config.ts) and, from M1, by the page generator, canonical URLs and assets.json.
export function siteBase(raw: string | undefined): string {
  const value = (raw ?? '/').trim();
  if (value === '' || value === '/') return '/';
  return `/${value.replace(/^\/+|\/+$/g, '')}/`;
}
