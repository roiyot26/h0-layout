/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { siteBase } from './src/base';
import { flagsFromEnv, renderSite } from './src/site/pages';

const base = siteBase(process.env.SITE_BASE);
const flags = flagsFromEnv(process.env);

// Build-time feature flags (M2 spec §8). Production reads flags.prod.json, where every
// 3D flag is off; previews pass FLAGS_FILE=flags.preview.json. The file must hold
// exactly these keys, all booleans, or the build stops.
export const FLAG_KEYS = ['ENABLE_3D', 'PHONE_3D', 'DISCOVERIES'] as const;
export type BuildFlags = Record<(typeof FLAG_KEYS)[number], boolean>;

export function parseFlags(text: string, file = 'flags file'): BuildFlags {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${file}: not valid JSON`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`${file}: expected an object`);
  const obj = data as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!(FLAG_KEYS as readonly string[]).includes(key)) throw new Error(`${file}: unknown flag ${key}`);
  }
  for (const key of FLAG_KEYS) {
    if (!(key in obj)) throw new Error(`${file}: missing flag ${key}`);
    if (typeof obj[key] !== 'boolean') throw new Error(`${file}: ${key} must be true or false`);
  }
  return obj as BuildFlags;
}

export function readFlags(file = process.env.FLAGS_FILE ?? 'flags.prod.json'): BuildFlags {
  const path = fileURLToPath(new URL(file, new URL('./', import.meta.url)));
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`${file}: flags file not found`);
  }
  return parseFlags(text, file);
}

const build3d = readFlags();

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
  define: {
    __ENABLE_3D__: JSON.stringify(build3d.ENABLE_3D),
    __PHONE_3D__: JSON.stringify(build3d.PHONE_3D),
    __DISCOVERIES__: JSON.stringify(build3d.DISCOVERIES),
  },
  build: {
    outDir: process.env.OUT_DIR ?? 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: 'src/main.ts',
      // Stable chunk names (M2 spec §5.3), so size-limit, budget and dist-guard can
      // scope by file: the entry is boot-*, three.js is three-*, the 3D app is world-*.
      output: {
        entryFileNames: 'assets/boot-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three';
          if (id.includes('/src/world/')) return 'world';
          return undefined;
        },
      },
    },
  },
  test: {
    // Playwright specs live under e2e/ and are run by the facts/axe CI jobs.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
