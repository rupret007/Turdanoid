/**
 * TurdAnoid self-playtest harness (not run by vitest).
 * Usage: node scripts/turdanoid-autoplay.mjs [port] [outDir]
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2]) || 8152;
const outDir =
  process.argv[3] ||
  '/Users/jeffstory/Documents/bob-overnight-inject/conductor/reviews/turdanoid-1000x/r3/breakout-autoplay';

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

async function runSession(browser, label, width, height, mode, durationMs) {
  const page = await browser.newPage({ viewport: { width, height } });
  const consoleErrors = [];
  page.on('pageerror', (err) => consoleErrors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(`http://127.0.0.1:${port}/TurdAnoid.html`, { waitUntil: 'domcontentloaded' });

  await page.evaluate((playMode) => {
    localStorage.setItem('turdanoid_v3_coach_v1', '1');
    if (playMode === 'boss') {
      document.getElementById('btnBoss').click();
    } else {
      document.getElementById('btnStart').click();
    }
  }, mode);

  await page.waitForFunction(() => window.__turdanoid && window.__turdanoid.state === 'playing', {
    timeout: 15000
  });

  await page.evaluate(() => {
    const g = window.__turdanoid;
    if (g.waitingLaunch) g.launch();
  });

  const metrics = await page.evaluate(
    async ({ ms, shotEvery }) => {
      const g = window.__turdanoid;
      const deltas = [];
      let last = performance.now();
      let frames = 0;
      let stuckEvents = 0;
      let horizontalLoops = 0;
      const ballTrail = [];

      function trackBall() {
        const balls = g.balls || [];
        if (!balls.length) return;
        const b = balls[0];
        ballTrail.push({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, t: performance.now() });
        if (ballTrail.length > 90) ballTrail.shift();
        if (ballTrail.length >= 45) {
          const a = ballTrail[0];
          const z = ballTrail[ballTrail.length - 1];
          if (Math.abs(z.y - a.y) < 2 && Math.abs(z.x - a.x) > 40) stuckEvents++;
          const sp = Math.hypot(b.vx, b.vy);
          if (sp > 0.5 && Math.abs(b.vy) / sp < 0.08 && Math.abs(b.vx) > 3) horizontalLoops++;
        }
      }

      return new Promise((resolve) => {
        const start = performance.now();
        let nextShot = start + shotEvery;

        function frame(now) {
          const balls = g.balls || [];
          if (balls.length) {
            const b = balls[0];
            const paddle = g.paddle;
            if (paddle) {
              const target = Math.max(paddle.w / 2, Math.min(g.W - paddle.w / 2, b.x));
              paddle.x += (target - paddle.x) * 0.22;
              if (paddle.aimX != null) paddle.aimX = paddle.x;
            }
            if (g.waitingLaunch && typeof g.launch === 'function') g.launch();
          }
          trackBall();
          const dt = now - last;
          last = now;
          if (dt > 0 && dt < 200) deltas.push(dt);
          frames++;
          if (now >= nextShot) {
            nextShot += shotEvery;
            window.__autoplayShot = { t: Math.round((now - start) / 1000) };
          }
          if (now - start >= ms) {
            const sorted = [...deltas].sort((a, b) => a - b);
            const avg = deltas.reduce((s, d) => s + d, 0) / Math.max(1, deltas.length);
            const min = sorted[0] || 0;
            const avgFps = avg > 0 ? 1000 / avg : 0;
            const minFps = min > 0 ? 1000 / min : 0;
            resolve({
              frames,
              avgFps,
              minFps,
              stuckEvents,
              horizontalLoops,
              state: g.state,
              level: g.level,
              score: g.score
            });
            return;
          }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
    },
    { ms: durationMs, shotEvery: 10000 }
  );

  const sessionDir = join(outDir, label);
  await mkdir(sessionDir, { recursive: true });

  for (let t = 0; t <= durationMs; t += 10000) {
    await page.waitForTimeout(t === 0 ? 0 : 10000);
    await page.screenshot({ path: join(sessionDir, `t-${String(Math.round(t / 1000)).padStart(2, '0')}s.png`) });
  }

  const report = { label, viewport: { width, height }, mode, consoleErrors, ...metrics };
  await writeFile(join(sessionDir, 'report.json'), JSON.stringify(report, null, 2));
  await page.close();
  return report;
}

const server = await startServer();
const channel = process.env.PLAYWRIGHT_CHANNEL || 'chromium';
let browser;
try {
  browser = await chromium.launch({ channel, headless: true });
} catch {
  browser = await chromium.launch({ headless: true });
}

await mkdir(outDir, { recursive: true });

const reports = [];
reports.push(await runSession(browser, 'classic-390x844', 390, 844, 'classic', 75000));
reports.push(await runSession(browser, 'classic-1280x800', 1280, 800, 'classic', 75000));
reports.push(await runSession(browser, 'boss-390x844', 390, 844, 'boss', 60000));

await browser.close();
server.close();

const summary = {
  at: new Date().toISOString(),
  port,
  reports
};
await writeFile(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
