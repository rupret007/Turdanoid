/**
 * Phone HUD before/after shots at 360 / 390 / 430.
 * Usage: node scripts/turdanoid-hud-phone-capture.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2]) || 8167;
const outDir = join(root, 'docs/turdanoid-hud-fix');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

const WIDTHS = [360, 390, 430];

/**
 * Decode a request path, resolve it against the repo root, and reject
 * anything that lands outside (including encoded /..%2f..%2f traversal).
 */
export function resolveSafeFilePath(urlPath, repoRoot = root) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const requested = decoded === '/' || decoded === '' ? 'index.html' : decoded.replace(/^[/\\]+/, '');
  const resolvedRoot = resolve(repoRoot);
  const filePath = resolve(resolvedRoot, requested);
  const rel = relative(resolvedRoot, filePath);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return null;
  }
  return filePath;
}

function requestPath(req) {
  const raw = req.url || '/';
  const cut = raw.split('?')[0].split('#')[0];
  return cut || '/';
}

export function startServer(listenPort = port) {
  return new Promise((ready) => {
    const server = createServer(async (req, res) => {
      try {
        const filePath = resolveSafeFilePath(requestPath(req));
        if (!filePath) {
          res.writeHead(403);
          res.end('forbidden');
          return;
        }
        const body = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(listenPort, '127.0.0.1', () => ready(server));
  });
}

async function openPlay(browser, width, injectBeforeCss = false) {
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2
  });
  await page.addInitScript(() => {
    localStorage.setItem('turdanoid_v3_coach_v1', '1');
  });
  await page.goto(`http://127.0.0.1:${port}/TurdAnoid.html`, { waitUntil: 'domcontentloaded' });
  if (injectBeforeCss) {
    await page.addStyleTag({
      content: `
        @media (max-width:420px){
          .hud .right{margin-right:100px}
        }
        @media (max-width:360px){
          .hud .right{margin-right:96px}
        }
      `
    });
  }
  await page.waitForSelector('#titleScreen.overlay', { timeout: 15000 });
  await page.evaluate(() => document.getElementById('btnStart').click());
  await page.waitForFunction(() => window.__turdanoid && window.__turdanoid.state === 'playing', {
    timeout: 15000
  });
  await page.waitForTimeout(240);
  return page;
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  const written = [];
  try {
    await mkdir(outDir, { recursive: true });
    for (const width of WIDTHS) {
      const before = await openPlay(browser, width, true);
      const beforePath = join(outDir, `before-hud-${width}.png`);
      await before.locator('.hud').screenshot({ path: beforePath });
      written.push(beforePath);
      await before.close();

      const after = await openPlay(browser, width, false);
      const afterPath = join(outDir, `after-hud-${width}.png`);
      await after.locator('.hud').screenshot({ path: afterPath });
      written.push(afterPath);
      const playPath = join(outDir, `after-play-${width}.png`);
      await after.screenshot({ path: playPath, fullPage: false });
      written.push(playPath);
      await after.close();
    }
    console.log(JSON.stringify({ written }, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
}

const launchedDirectly =
  Boolean(process.argv[1]) &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (launchedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
