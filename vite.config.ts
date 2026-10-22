/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { siteBase } from './src/base';
import { flagsFromEnv, renderSite } from './src/site/pages';

const base = siteBase(process.env.SITE_BASE);
const flags = flagsFromEnv(process.env);

// Every route is a static HTML page generated from src/site/content.ts and
// scripts/routes.mjs. The bundle has one entry, src/main.ts; at build time each page
// gets its hashed script and stylesheet, and in dev the same pages are rendered on
// request with the unbundled entry.
const sitePages = (): Plugin => ({
  name: 'site-pages',
  configureServer(server) {
    const pagesNow = () =>
      renderSite({ ...flags, base, scripts: ['/src/main.ts'], styles: [] });
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? '/', 'http://dev.invalid');
      if (!url.pathname.startsWith(base)) return next();
      let rel = url.pathname.slice(base.length);
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      const html = pagesNow().get(rel);
      if (!html) return next();
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(await server.transformIndexHtml(url.pathname, html));
    });
  },
  generateBundle(_options, bundle) {
    const entry = Object.values(bundle).find((f) => f.type === 'chunk' && f.isEntry);
    if (!entry || entry.type !== 'chunk') this.error('no entry chunk');
    const styles = [...(entry.viteMetadata?.importedCss ?? [])].map((f) => `${base}${f}`);
    const files = renderSite({ ...flags, base, scripts: [`${base}${entry.fileName}`], styles });
    for (const [fileName, source] of files) this.emitFile({ type: 'asset', fileName, source });
  },
});

export default defineConfig({
  base,
  plugins: [sitePages()],
  build: {
    outDir: process.env.OUT_DIR ?? 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: { input: 'src/main.ts' },
  },
  test: {
    // Playwright specs live under e2e/ and are run by the facts/axe CI jobs.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
