// Static server for the built site, shaped like GitHub Pages: the site lives under
// SITE_BASE, a directory without a trailing slash redirects, a directory serves its
// index.html, and anything missing gets 404.html (or a plain 404).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.env.DIST_DIR ?? new URL('../dist', import.meta.url).pathname);
const base = process.env.SITE_BASE ?? '/h0-layout/';
const port = Number(process.env.PORT ?? 4173);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
};

async function isFile(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}
async function isDir(p) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const send = async (code, file) => {
    res.writeHead(code, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  };
  if (!url.pathname.startsWith(base)) {
    res.writeHead(404).end('not found');
    return;
  }
  const rel = normalize(decodeURIComponent(url.pathname.slice(base.length)));
  const path = join(root, rel);
  if (!path.startsWith(root)) {
    res.writeHead(400).end();
    return;
  }
  if (await isDir(path)) {
    if (!url.pathname.endsWith('/')) {
      res.writeHead(301, { location: `${url.pathname}/${url.search}` }).end();
      return;
    }
    if (await isFile(join(path, 'index.html'))) return send(200, join(path, 'index.html'));
  } else if (await isFile(path)) {
    return send(200, path);
  }
  const notFound = join(root, '404.html');
  if (await isFile(notFound)) return send(404, notFound);
  res.writeHead(404).end('not found');
}).listen(port, '127.0.0.1', () => {
  console.log(`serving ${root} at http://127.0.0.1:${port}${base}`);
});
