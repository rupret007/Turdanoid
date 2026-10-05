/**
 * Power-up / boss / tally QA screenshots (localhost only).
 * Usage: node scripts/turdanoid-qa-capture.mjs [port] [outDir]
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2]) || 8151;
const outDir =
  process.argv[3] ||
  join(root, 'conductor/reviews/turdanoid-1000x/r5/breakout-qa');

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

async function prepPlaying(page) {
  await page.goto(`http://127.0.0.1:${port}/TurdAnoid.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('turdanoid_v3_coach_v1', '1');
    document.getElementById('btnStart').click();
  });
  await page.waitForFunction(() => window.__turdanoid && window.__turdanoid.state === 'playing', {
    timeout: 15000
  });
  await page.evaluate(() => {
    const g = window.__turdanoid;
    g.qaResetPowers();
    if (g.waitingLaunch) g.launch();
  });
}

async function shot(page, subdir, name) {
  const dir = join(outDir, subdir);
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}.png`) });
}

async function capturePowers(browser, width, height, tag) {
  const page = await browser.newPage({ viewport: { width, height } });
  await prepPlaying(page);
  const types = await page.evaluate(() => window.__turdanoid.powerTypes);
  const timed = await page.evaluate(() => window.__turdanoid.timedPowerTypes);

  for (const type of types) {
    await page.evaluate((t) => {
      const g = window.__turdanoid;
      g.qaSpawnCapsule(t);
    }, type);
    await page.waitForTimeout(120);
    await shot(page, `${tag}/capsules`, `capsule-${type}`);
    if (timed.includes(type)) {
      await page.evaluate((t) => {
        const g = window.__turdanoid;
        g.powerups = [];
        g.qaActivatePower(t);
      }, type);
      await page.waitForTimeout(80);
      await shot(page, `${tag}/active`, `active-${type}`);
    }
  }
  await page.close();
}

async function captureBoss(browser, width, height, tag) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`http://127.0.0.1:${port}/TurdAnoid.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('turdanoid_v3_coach_v1', '1');
    document.getElementById('btnBoss').click();
  });
  await page.waitForFunction(() => window.__turdanoid && window.__turdanoid.state === 'playing', {
    timeout: 15000
  });

  for (const phase of [1, 2, 3]) {
    await page.evaluate((p) => window.__turdanoid.qaBossSetPhase(p), phase);
    await page.evaluate(() => {
      const g = window.__turdanoid;
      if (g.waitingLaunch) g.launch();
    });
    await page.waitForTimeout(200);
    await shot(page, `${tag}/boss`, `boss-phase-${phase}`);
  }

  await page.evaluate(() => {
    const g = window.__turdanoid;
    if (g.boss) g.boss.hp = 0;
    g.gameOver(true);
  });
  await page.waitForTimeout(150);
  await shot(page, `${tag}/boss`, 'boss-victory');

  await page.close();
}

async function captureOverlays(browser, width, height, tag) {
  const page = await browser.newPage({ viewport: { width, height } });
  await prepPlaying(page);
  await page.evaluate(() => window.__turdanoid.qaBeginClearTally());
  await page.waitForTimeout(300);
  await shot(page, `${tag}/flow`, 'level-clear-tally');
  await page.evaluate(() => window.__turdanoid.qaShowGameOver(false));
  await page.waitForTimeout(150);
  await shot(page, `${tag}/flow`, 'game-over');
  await page.close();
}

const server = await startServer();
await mkdir(outDir, { recursive: true });
const channel = process.env.PLAYWRIGHT_CHANNEL || 'chromium';
let browser;
try {
  browser = await chromium.launch({ channel, headless: true });
} catch {
  browser = await chromium.launch({ headless: true });
}

await capturePowers(browser, 390, 844, '390');
await capturePowers(browser, 1280, 800, '1280');
await captureBoss(browser, 390, 844, '390');
await captureBoss(browser, 1280, 800, '1280');
await captureOverlays(browser, 390, 844, '390');
await captureOverlays(browser, 1280, 800, '1280');

await browser.close();
server.close();
console.log(`QA captures written to ${outDir}`);
