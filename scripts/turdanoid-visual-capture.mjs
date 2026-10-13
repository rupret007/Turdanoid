/**
 * Before/after screenshots for the TurdAnoid visual overhaul.
 * Usage: node scripts/turdanoid-visual-capture.mjs [port] [tag]
 * tag defaults to "before". Writes docs/visual-overhaul/screenshots/<tag>-*.png
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2]) || 8161;
const tag = String(process.argv[3] || 'before').replace(/[^a-z0-9-]/gi, '') || 'before';
const outDir = join(root, 'docs/visual-overhaul/screenshots');

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

async function shot(page, name) {
  await mkdir(outDir, { recursive: true });
  const path = join(outDir, `${tag}-${name}.png`);
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function openGame(browser, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await page.addInitScript(() => {
    localStorage.setItem('turdanoid_v3_coach_v1', '1');
  });
  await page.goto(`http://127.0.0.1:${port}/TurdAnoid.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#titleScreen.overlay', { timeout: 15000 });
  await page.waitForTimeout(560);
  return page;
}

async function startPlaying(page) {
  await page.evaluate(() => {
    document.getElementById('btnStart').click();
  });
  await page.waitForFunction(() => window.__turdanoid && window.__turdanoid.state === 'playing', {
    timeout: 15000
  });
  await page.evaluate(() => {
    const g = window.__turdanoid;
    if (g.waitingLaunch) {
      g.launch();
    }
  });
  await page.waitForTimeout(360);
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  const written = [];
  try {
    const phone = await openGame(browser, 390, 844);
    written.push(await shot(phone, 'title-390'));
    await startPlaying(phone);
    written.push(await shot(phone, 'play-390'));
    await phone.evaluate(() => {
      const g = window.__turdanoid;
      if (g.qaSpawnCapsule) {
        g.qaSpawnCapsule('laser', 0.42, 0.28);
        g.qaSpawnCapsule('fire', 0.48, 0.5);
        g.qaSpawnCapsule('multi', 0.4, 0.72);
      }
    });
    await phone.waitForTimeout(220);
    written.push(await shot(phone, 'powers-390'));
    await phone.evaluate(() => window.__turdanoid.doPause());
    await phone.waitForTimeout(180);
    written.push(await shot(phone, 'pause-390'));
    await phone.evaluate(() => window.__turdanoid.doResume());
    await phone.evaluate(() => window.__turdanoid.qaShowGameOver(false));
    await phone.waitForTimeout(280);
    written.push(await shot(phone, 'end-390'));
    await phone.evaluate(() => window.__turdanoid.qaShowGameOver(true));
    await phone.waitForTimeout(280);
    written.push(await shot(phone, 'win-390'));
    await phone.evaluate(() => {
      const g = window.__turdanoid;
      g.qaBeginClearTally();
      if (g.clearTally) {
        g.clearTally.lineDur = 99999;
        g.clearTally.lineIdx = Math.min(3, Math.max(0, g.clearTally.lines.length - 2));
      }
    });
    await phone.waitForTimeout(220);
    written.push(await shot(phone, 'tally-390'));
    await phone.evaluate(() => window.__turdanoid.qaBossSetPhase(2));
    await phone.waitForFunction(() => window.__turdanoid && window.__turdanoid.boss, { timeout: 15000 });
    await phone.waitForTimeout(360);
    written.push(await shot(phone, 'boss-390'));
    await phone.close();

    const how = await openGame(browser, 390, 844);
    await how.evaluate(() => document.getElementById('btnHowTo').click());
    await how.waitForSelector('#howScreen.show', { timeout: 8000 });
    await how.waitForTimeout(280);
    written.push(await shot(how, 'how-390'));
    await how.close();

    const desktop = await openGame(browser, 1280, 800);
    written.push(await shot(desktop, 'title-1280'));
    await startPlaying(desktop);
    written.push(await shot(desktop, 'play-1280'));
    await desktop.close();

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
