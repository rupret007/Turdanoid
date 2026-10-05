/**
 * Capture big-moment screenshots via __turdjackDev scenarios.
 * Usage: node scripts/crapjack-moments-capture.mjs [port]
 */
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { listTurdjackDevScenarios } from '../games/turdjack-dev-scenarios.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2]) || 8153;
const outDir =
  '/Users/jeffstory/Documents/bob-overnight-inject/conductor/reviews/turdanoid-1000x/r4/crapjack-moments';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png'
};

const VIEWPORTS = [
  { id: '390', width: 390, height: 844 },
  { id: '1280', width: 1280, height: 800 }
];

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
        const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
        const filePath = join(repoRoot, safePath === '/' ? 'index.html' : safePath);
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

async function dismissGuide(page) {
  await page.evaluate(() => {
    const g = document.getElementById('welcomeGuide');
    if (g) g.style.display = 'none';
  });
}

async function waitForMoment(page) {
  await page.waitForFunction(() => {
    const b = document.getElementById('momentBanner');
    return b && b.classList.contains('show');
  }, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(350);
}

async function captureScenario(browser, baseUrl, viewport, scenario) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height }
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/turdjack.html`, { waitUntil: 'load' });
  await dismissGuide(page);
  await page.waitForFunction(() => window.__turdjackDev && window.__turdjackDev.playScenario, {
    timeout: 8000
  });
  await page.evaluate((name) => window.__turdjackDev.playScenario(name), scenario);
  await waitForMoment(page);
  const file = join(outDir, `${scenario}-${viewport.id}.png`);
  await page.screenshot({ path: file, fullPage: false });
  await context.close();
  return file;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
    headless: true
  });

  const scenarios = listTurdjackDevScenarios();
  for (const scenario of scenarios) {
    for (const vp of VIEWPORTS) {
      await captureScenario(browser, baseUrl, vp, scenario);
    }
  }

  await browser.close();
  server.close();
  console.log('CRAPJACK MOMENTS CAPTURE OK', outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
