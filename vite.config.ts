import { defineConfig, type Plugin } from 'vite';
import { siteBase } from './src/base';

// PR previews are built with NOINDEX=1, so every preview page carries a noindex meta.
const noindex = (): Plugin => ({
  name: 'noindex',
  transformIndexHtml: (html) =>
    process.env.NOINDEX === '1'
      ? html.replace('<head>', '<head>\n    <meta name="robots" content="noindex, nofollow" />')
      : html,
});

export default defineConfig({
  base: siteBase(process.env.SITE_BASE),
  plugins: [noindex()],
  build: {
    outDir: process.env.OUT_DIR ?? 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
});
