/**
 * Before/after campaign wall screenshots at the phone playfield.
 * Usage: node scripts/turdanoid-level-capture.mjs [port] [tag]
 * tag defaults to "before". Writes docs/turdanoid-levels/<tag>-lXX-390.png
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2]) || 8171;
const tag = String(process.argv[3] || 'before').replace(/[^a-z0-9-]/gi, '') || 'before';
const outDir = join(root, 'docs/turdanoid-levels');
const LEVELS = [1, 6, 12, 18, 24, 30];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
        const safePath = urlPath.replace(/^(\.\.[/\\])+/, '');
        const filePath = join(root, safePath === '/' ? 'index.html' : safePath);
        const body = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function jumpToLevel(page, target) {
  await page.evaluate((n) => {
    const g = window.__turdanoid;
    if (typeof g.qaJumpToLevel === 'function') {
      g.qaJumpToLevel(n);
    } else {
      let guard = 0;
      while (g.level < n && guard < 80) {
        guard += 1;
        g.bricks = [];
        g.step(1000 / 60);
        if (g.clearTally) {
          g.skipClearTally();
        }
      }
    }
    const tally = document.getElementById('clearTally');
    if (tally) {
      tally.classList.remove('show');
    }
    const hype = document.getElementById('hype');
    if (hype) {
      hype.classList.remove('show');
    }
  }, target);
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  const written = [];
  try {
    await mkdir(outDir, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await page.addInitScript(() => {
      localStorage.setItem('turdanoid_v3_coach_v1', '1');
    });
    await page.goto(`http://127.0.0.1:${port}/TurdAnoid.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#titleScreen.overlay', { timeout: 15000 });
    await page.evaluate(() => document.getElementById('btnStart').click());
    await page.waitForFunction(() => window.__turdanoid && window.__turdanoid.state === 'playing', {
      timeout: 15000
    });

    for (const level of LEVELS) {
      await jumpToLevel(page, level);
      await page.waitForFunction((n) => window.__turdanoid && window.__turdanoid.level === n, level, {
        timeout: 15000
      });
      await page.waitForTimeout(280);
      const name = `${tag}-l${String(level).padStart(2, '0')}-390.png`;
      const path = join(outDir, name);
      await page.screenshot({ path, fullPage: false });
      written.push(path);
    }
    console.log(JSON.stringify({ tag, written }, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
