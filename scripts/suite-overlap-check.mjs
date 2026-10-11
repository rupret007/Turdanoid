/**
 * Asserts the suite back pill does not overlap visible chrome on hub + all games.
 * Usage: node scripts/suite-overlap-check.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2]) || 8159;
const outDir =
  process.argv[3] ||
  join('/Users/jeffstory/Documents/bob-overnight-inject/conductor/reviews/turdanoid-1000x/xfix');

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '320', width: 320, height: 640 },
  { name: '1280', width: 1280, height: 800 }
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

const PAGES = [
  { path: 'index.html', slug: 'hub', prep: prepHub },
  { path: 'TurdAnoid.html', slug: 'turdanoid', prep: prepTurdanoid },
  { path: 'turdtris.html', slug: 'turdtris', prep: prepTurdtris },
  { path: 'turdjack.html', slug: 'turdjack', prep: prepTurdjack },
  { path: 'crapeights.html', slug: 'crapeights', prep: prepCrapeights },
  { path: 'turdrummy.html', slug: 'turdrummy', prep: prepTurdrummy },
  { path: 'turdspades.html', slug: 'turdspades', prep: prepTurdspades }
];

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

async function dismissCommonOverlays(page) {
  await page.evaluate(() => {
    localStorage.setItem('turdsuite_guides_seen_v1', '1');
  });
  for (const sel of ['#coachOverlay.show', '.coach:not([hidden])', '.welcome-guide.is-open', '#guide.show', '.guide.show']) {
    const loc = page.locator(sel);
    if ((await loc.count()) > 0 && (await loc.first().isVisible().catch(() => false))) {
      const btn = page.getByRole('button', { name: /^(Next|Got it|Review Then|Quick Start|Close|Back to table)/i }).first();
      if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
    }
  }
}

async function prepHub(page) {
  await dismissCommonOverlays(page);
}

async function prepTurdanoid(page) {
  await page.evaluate(() => {
    localStorage.setItem('turdanoid_v3_coach_v1', '1');
    localStorage.setItem('turdsuite_guides_seen_v1', '1');
  });
  await page.locator('#btnStart').click();
  await page.waitForFunction(() => window.__turdanoid?.state === 'playing', { timeout: 15000 });
}

async function prepTurdtris(page) {
  await dismissCommonOverlays(page);
  const closeGuide = page.getByRole('button', { name: 'Close Guide' });
  if (await closeGuide.isVisible().catch(() => false)) await closeGuide.click();
  await page.waitForSelector('#game', { state: 'visible', timeout: 10000 });
}

async function prepTurdjack(page) {
  await dismissCommonOverlays(page);
  const quick = page.getByRole('button', { name: 'Quick Start' });
  if (await quick.isVisible().catch(() => false)) await quick.click();
  await page.waitForTimeout(200);
}

async function prepCrapeights(page) {
  await dismissCommonOverlays(page);
  await page.getByRole('button', { name: 'Quick Start' }).click();
  await page.waitForTimeout(250);
}

async function prepTurdrummy(page) {
  await dismissCommonOverlays(page);
  await page.locator('#startRoundBtn').click();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.querySelector('.coach')?.remove();
  });
}

async function prepTurdspades(page) {
  await page.evaluate(() => {
    localStorage.setItem('turdsuite_guides_seen_v1', '1');
    const guide = document.getElementById('guide');
    if (guide) guide.classList.remove('show');
    if (window.Suite?.guide) Suite.guide.mark('turdspades.html');
  });
  await page.waitForTimeout(200);
}

function findPillOverlaps(page) {
  return page.evaluate(() => {
    function boxesIntersect(a, b) {
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }
    function isFullViewportBackdrop(rect, vw, vh) {
      return rect.width >= vw * 0.94 && rect.height >= vh * 0.94;
    }
    function isTarget(el, text, isHudChip) {
      if (isHudChip) return true;
      const trimmed = String(text || '').replace(/\s+/g, ' ').trim();
      if (trimmed.length > 0) return true;
      const tag = el.tagName.toLowerCase();
      const role = (el.getAttribute('role') || '').toLowerCase();
      if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea') return true;
      if (role === 'button' || role === 'link' || role === 'tab') return true;
      return false;
    }

    const pill = document.querySelector('a.suite-back-pill[aria-label="Back to game hub"]');
    if (!pill) return { hasPill: false, overlaps: [] };
    const pillStyle = getComputedStyle(pill);
    if (pillStyle.display === 'none' || pillStyle.visibility === 'hidden') {
      return { hasPill: false, overlaps: [] };
    }
    const pillRect = pill.getBoundingClientRect();
    if (pillRect.width < 1 || pillRect.height < 1) return { hasPill: false, overlaps: [] };

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const overlaps = [];
    const pillBox = { left: pillRect.left, top: pillRect.top, right: pillRect.right, bottom: pillRect.bottom };

    for (const el of document.querySelectorAll('body *')) {
      if (!(el instanceof Element)) continue;
      if (el === pill || pill.contains(el) || el.contains(pill)) continue;

      const inCanvasHud = el.matches('#playShell .hud .col, #playShell .hud .col *');
      if (el.closest('[aria-hidden="true"]') && !inCanvasHud) continue;

      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      if (isFullViewportBackdrop(rect, vw, vh)) continue;
      if (el.tagName === 'CANVAS') continue;

      const text = el.innerText || el.textContent || '';
      const isHudChip = el.matches('#playShell .hud .col');
      const tag = el.tagName.toLowerCase();
      const isInteractive =
        tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea';
      if (!isHudChip && !isInteractive && el.children.length > 0) continue;
      if (!isTarget(el, text, isHudChip)) continue;

      const box = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      if (!boxesIntersect(pillBox, box)) continue;

      overlaps.push({
        tag: el.tagName.toLowerCase(),
        label: String(text).replace(/\s+/g, ' ').trim().slice(0, 48) || el.tagName.toLowerCase(),
        role: el.getAttribute('role') || ''
      });
    }

    return { hasPill: true, overlaps };
  });
}

async function run() {
  await mkdir(outDir, { recursive: true });
  const server = await startServer();
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  let failed = false;

  try {
    for (const vp of VIEWPORTS) {
      for (const spec of PAGES) {
        const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
        page.on('console', (msg) => {
          if (msg.type() === 'error') consoleErrors.push(`${spec.slug}@${vp.name}: ${msg.text()}`);
        });
        page.on('pageerror', (err) => {
          consoleErrors.push(`${spec.slug}@${vp.name}: ${err.message}`);
        });

        await page.goto(`${base}/${spec.path}`, { waitUntil: 'domcontentloaded' });
        await spec.prep(page);
        await page.waitForTimeout(150);

        const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientW = await page.evaluate(() => document.documentElement.clientWidth);
        if (scrollW > clientW + 1) {
          failed = true;
          console.error(`FAIL horizontal scroll ${spec.slug} @${vp.name}: ${scrollW} > ${clientW}`);
        }

        const overlap = await findPillOverlaps(page);
        if (overlap.hasPill && overlap.overlaps.length) {
          failed = true;
          console.error(
            `FAIL back-pill overlap ${spec.slug} @${vp.name}:`,
            overlap.overlaps.slice(0, 6)
          );
        }

        const shotPath = join(outDir, `${spec.slug}-${vp.name}-play.png`);
        await page.screenshot({ path: shotPath, fullPage: false });
        await page.close();
        console.log(`OK ${spec.slug} @${vp.name}`);
      }
    }

    if (consoleErrors.length) {
      failed = true;
      console.error('FAIL console errors:', consoleErrors.slice(0, 20));
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failed) process.exit(1);
  console.log('suite-overlap-check PASS');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
