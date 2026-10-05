/**
 * Crapjack playtest harness — drives the real UI via Playwright.
 * Usage: node scripts/crapjack-autoplay.mjs [port]
 */
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2]) || 8153;
const outDir =
  '/Users/jeffstory/Documents/bob-overnight-inject/conductor/reviews/turdanoid-1000x/r3/crapjack-autoplay';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png'
};

const VIEWPORTS = [
  { id: '390x844', width: 390, height: 844 },
  { id: '320x640', width: 320, height: 640 },
  { id: '1280x800', width: 1280, height: 800 }
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

function stateFingerprint(state) {
  return JSON.stringify(state);
}

async function readGameState(page) {
  return page.evaluate(() => ({
    roundActive: typeof roundActive === 'boolean' ? roundActive : null,
    currentBet: typeof currentBet === 'number' ? currentBet : null,
    bankroll: typeof bankroll === 'number' ? bankroll : null,
    playerCards: Array.isArray(playerHand) ? playerHand.length : null,
    dealerCards: Array.isArray(dealerHand) ? dealerHand.length : null,
    holeHidden: typeof dealerHoleHidden === 'boolean' ? dealerHoleHidden : null,
    status: document.getElementById('statusText')?.textContent || ''
  }));
}

async function guideOpen(page) {
  return page.evaluate(() => {
    const g = document.getElementById('welcomeGuide');
    return g && g.style.display !== 'none';
  });
}

async function dismissGuide(page) {
  if (await guideOpen(page)) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
  }
}

async function hasHorizontalScroll(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
}

async function tapLegalAction(page, viewportId) {
  const mobile = viewportId !== '1280x800';
  const state = await readGameState(page);
  if (!state.roundActive) {
    if ((state.currentBet || 0) < 10) {
      if (mobile) {
        const chip = page.locator('#mobileFeltChipRack [data-chip="10"], #mobilePit [data-chip="10"]').first();
        await chip.click({ timeout: 5000 }).catch(async () => {
          await page.evaluate(() => {
            if (typeof addBet === 'function') addBet(10);
          });
        });
      } else {
        await page.locator('.table-pit-rail [data-chip="10"], .chip-rack [data-chip="10"]').first().click();
      }
    }
    if (mobile) await page.locator('#mobilePit [data-mobile-action="deal"]').click();
    else await page.locator('#dealBtn').click();
    return 'deal';
  }
  if (mobile) {
    await page.locator('#mobilePit [data-mobile-action="smart"]').click();
  } else {
    await page.keyboard.press('Enter');
  }
  return 'smart';
}

async function runScenario(browser, baseUrl, viewport, reducedMotion) {
  const tag = `${viewport.id}${reducedMotion ? '-reduce' : ''}`;
  const dir = join(outDir, tag);
  await mkdir(dir, { recursive: true });
  const issues = [];
  const consoleErrors = [];

  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference'
  });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto(`${baseUrl}/turdjack.html`, { waitUntil: 'load' });
  if (reducedMotion) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  }
  await dismissGuide(page);

  let lastFp = '';
  let lastChange = Date.now();
  let turn = 0;
  const maxTurns = 14;

  while (turn < maxTurns) {
    if (await guideOpen(page)) {
      issues.push('welcome guide blocked play');
      await dismissGuide(page);
    }
    if (await hasHorizontalScroll(page)) {
      issues.push(`horizontal scroll at turn ${turn}`);
    }
    const fp = stateFingerprint(await readGameState(page));
    if (fp !== lastFp) {
      lastFp = fp;
      lastChange = Date.now();
    } else if (Date.now() - lastChange > 10000) {
      issues.push(`stuck state >10s at turn ${turn}: ${fp}`);
      break;
    }

    if (turn % 3 === 0) {
      await page.screenshot({ path: join(dir, `turn-${String(turn).padStart(2, '0')}.png`), fullPage: true });
    }

    try {
      await tapLegalAction(page, viewport.id);
    } catch (err) {
      issues.push(`action failed turn ${turn}: ${err.message}`);
      break;
    }
    await page.waitForTimeout(reducedMotion ? 120 : 650);
    turn += 1;
  }

  // Continue restore mid-hand
  const mid = await readGameState(page);
  if (mid.roundActive) {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'load' });
    await page.goto(`${baseUrl}/turdjack.html`, { waitUntil: 'load' });
    await dismissGuide(page);
    const restored = await readGameState(page);
    if (!restored.roundActive) {
      issues.push('continue failed to restore live hand');
    } else if (restored.playerCards !== mid.playerCards) {
      issues.push(`continue card count changed ${JSON.stringify({ mid, restored })}`);
    } else {
      try {
        if (viewport.id === '1280x800') await page.keyboard.press('Enter');
        else await page.locator('#mobilePit [data-mobile-action="smart"]').click();
        await page.waitForTimeout(400);
        const after = await readGameState(page);
        if (JSON.stringify(after) === JSON.stringify(restored)) {
          issues.push('no state change after continue action');
        }
      } catch (err) {
        issues.push(`continue action failed: ${err.message}`);
      }
    }
    await page.screenshot({ path: join(dir, 'continue-restore.png'), fullPage: true });
  }

  await page.screenshot({ path: join(dir, 'final.png'), fullPage: true });
  await context.close();

  const report = {
    tag,
    viewport,
    reducedMotion,
    turns: turn,
    issues,
    consoleErrors
  };
  await writeFile(join(dir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
    headless: true
  });

  const reports = [];
  for (const vp of VIEWPORTS) {
    reports.push(await runScenario(browser, baseUrl, vp, false));
    reports.push(await runScenario(browser, baseUrl, vp, true));
  }

  await browser.close();
  server.close();

  const summary = {
    at: new Date().toISOString(),
    port,
    reports: reports.map((r) => ({
      tag: r.tag,
      issues: r.issues,
      consoleErrorCount: r.consoleErrors.length,
      consoleErrors: r.consoleErrors.slice(0, 20)
    }))
  };
  await writeFile(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  const failed = reports.some((r) => r.issues.length > 0 || r.consoleErrors.length > 0);
  if (failed) {
    console.error('CRAPJACK AUTOPLAY FAIL', JSON.stringify(summary, null, 2));
    process.exit(1);
  }
  console.log('CRAPJACK AUTOPLAY PASS', JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
