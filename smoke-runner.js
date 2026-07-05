/**
 * Cross-platform browser smoke runner.
 *
 * Serves the repository root over a local HTTP server, then executes
 * browser-smoke.js against it. Works on Linux/macOS/Windows; on Windows the
 * legacy browser-smoke.ps1 wrapper remains available.
 *
 * Usage: node smoke-runner.js [port]
 * Env:   PLAYWRIGHT_CHANNEL - browser channel (default msedge, falls back to
 *        Playwright's bundled Chromium when the channel is unavailable).
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2]) || 8123;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
    const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    const filePath = join(root, safePath === '/' ? 'hub.html' : safePath);
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  const child = spawn(
    process.execPath,
    [join(root, 'browser-smoke.js'), `http://127.0.0.1:${port}`],
    { stdio: 'inherit' }
  );
  child.on('exit', (code) => {
    server.close();
    process.exit(code ?? 1);
  });
});
