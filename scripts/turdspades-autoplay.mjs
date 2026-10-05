/**
 * TurdSpades UI autoplay harness (Playwright). Not run by vitest.
 *
 * Usage: node scripts/turdspades-autoplay.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = Number(process.argv[2]) || 8156;
const outDir =
  '/Users/jeffstory/Documents/bob-overnight-inject/conductor/reviews/turdanoid-1000x/r3/turdspades-autoplay';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png'
};

const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '320x640', width: 320, height: 640 },
  { name: '1280x800', width: 1280, height: 800 }
];

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
        const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
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

function fingerprint(state) {
  if (!state) return 'null';
  return [
    state.phase,
    state.bidTurn,
    state.currentPlayer,
    state.trickLen,
    state.handLen,
    state.round,
    state.scores,
    state.guideOpen,
    state.receiptOpen
  ].join('|');
}

async function readGameState(page) {
  return page.evaluate(() => {
    const guide = document.getElementById('guide');
    const receipt = document.getElementById('tsReceiptOverlay');
    return {
      phase: state.phase,
      bidTurn: state.bidTurn,
      currentPlayer: state.currentPlayer,
      trickLen: state.trick.length,
      handLen: state.hands[0].length,
      round: state.round,
      scores: state.scores.join(','),
      guideOpen: !!(guide && guide.classList.contains('show')),
      receiptOpen: !!(receipt && receipt.classList.contains('show'))
    };
  });
}

async function hasHorizontalScroll(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
}

async function dismissGuide(page) {
  const guide = page.locator('#guide.show');
  if (await guide.isVisible().catch(() => false)) {
    await page.locator('#quickStart').click({ timeout: 5000 });
    await page.waitForTimeout(200);
  }
}

async function tryStep(page) {
  const s = await readGameState(page);
  if (s.guideOpen) {
    await dismissGuide(page);
    return true;
  }
  if (s.receiptOpen) {
    if (s.phase === 'roundEnd') {
      await page.locator('#nextRoundDock').click().catch(() => {});
    }
    await page.waitForTimeout(200);
    return true;
  }
  if (s.phase === 'matchEnd') {
    await page.locator('#newMatchBtn').click();
    await page.waitForTimeout(300);
    return true;
  }
  if (s.phase === 'roundEnd') {
    await page.locator('#nextRoundDock').click();
    await page.waitForTimeout(350);
    return true;
  }
  if (s.phase === 'bidding' && s.bidTurn === 0) {
    await page.locator('#lockBid').click();
    await page.waitForTimeout(200);
    return true;
  }
  if (s.phase === 'play' && s.currentPlayer === 0) {
    const acted = await page.evaluate(() => {
      const legal = [...document.querySelectorAll('#youCards .card:not([disabled])')];
      if (!legal.length || typeof playSelected !== 'function') return false;
      state.selected = legal[0].dataset.id;
      playSelected();
      return true;
    });
    if (acted) {
      await page.waitForTimeout(120);
      return true;
    }
  }
  await page.waitForTimeout(250);
  return false;
}

async function playSession(page, label, options = {}) {
  const errors = [];
  const findings = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));

  const baseUrl = `http://127.0.0.1:${port}/turdspades.html`;
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  if (options.reducedMotion) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  }
  await dismissGuide(page);

  let turns = 0;
  let shots = 0;
  let lastFp = '';
  let lastChange = Date.now();
  const maxTurns = options.maxTurns ?? 220;
  const shotEvery = options.shotEvery ?? 8;

  while (turns < maxTurns) {
    const s = await readGameState(page);
    const fp = fingerprint(s);
    if (fp !== lastFp) {
      lastFp = fp;
      lastChange = Date.now();
    } else if (Date.now() - lastChange > 10000) {
      findings.push(`stuck: no state change for 10s at ${JSON.stringify(s)}`);
      break;
    }

    if (s.guideOpen) {
      findings.push('guide overlay stayed open');
      await page.screenshot({ path: join(outDir, `${label}-guide-stuck.png`), fullPage: true });
      break;
    }

    if (await hasHorizontalScroll(page)) {
      findings.push(`horizontal scroll at turn ${turns}`);
      await page.screenshot({ path: join(outDir, `${label}-hscroll-turn${turns}.png`), fullPage: true });
    }

    if (turns > 0 && turns % shotEvery === 0) {
      shots += 1;
      await page.screenshot({ path: join(outDir, `${label}-turn${turns}.png`), fullPage: true });
    }

    await tryStep(page);
    turns += 1;

    if (s.phase === 'play' && s.handLen === 0 && s.trickLen === 0) {
      await page.waitForTimeout(200);
    }
  }

  return { errors, findings, turns, shots };
}

async function continueRoundTrip(page, label) {
  const findings = [];
  const baseUrl = `http://127.0.0.1:${port}/turdspades.html`;
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await dismissGuide(page);
  await page.locator('#lockBid').click();
  await page.waitForTimeout(400);

  const before = await page.evaluate(() => ({
    phase: state.phase,
    round: state.round,
    handLen: state.hands[0].length,
    scores: state.scores.slice()
  }));

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(200);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const after = await page.evaluate(() => ({
    phase: state.phase,
    round: state.round,
    handLen: state.hands[0].length,
    scores: state.scores.slice(),
    canPlay: state.phase === 'play' && state.currentPlayer === 0
  }));

  if (after.round !== before.round || after.scores.join() !== before.scores.join()) {
    findings.push(`continue restore mismatch before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }

  if (after.canPlay) {
    await page.evaluate(() => {
      const legal = [...document.querySelectorAll('#youCards .card:not([disabled])')];
      if (legal.length && typeof playSelected === 'function') {
        state.selected = legal[0].dataset.id;
        playSelected();
      }
    });
    await page.waitForTimeout(200);
    const played = await page.evaluate(() => state.hands[0].length);
    if (played >= before.handLen) {
      findings.push('continue restore did not accept a play action');
    }
  }

  await page.screenshot({ path: join(outDir, `${label}-continue.png`), fullPage: true });
  return findings;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const report = { runs: [], consoleErrors: [], findings: [] };

  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      const result = await playSession(page, vp.name);
      report.runs.push({ viewport: vp.name, ...result });
      report.consoleErrors.push(...result.errors.map((e) => `[${vp.name}] ${e}`));
      report.findings.push(...result.findings.map((f) => `[${vp.name}] ${f}`));
      await context.close();
    }

    const rmContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const rmPage = await rmContext.newPage();
    const rmResult = await playSession(rmPage, '390x844-reduced-motion', {
      reducedMotion: true,
      maxTurns: 120
    });
    report.runs.push({ viewport: '390x844-reduced-motion', ...rmResult });
    report.consoleErrors.push(...rmResult.errors.map((e) => `[reduced] ${e}`));
    report.findings.push(...rmResult.findings.map((f) => `[reduced] ${f}`));
    await rmContext.close();

    const contContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const contPage = await contContext.newPage();
    const contFindings = await continueRoundTrip(contPage, '390x844');
    report.findings.push(...contFindings.map((f) => `[continue] ${f}`));
    await contContext.close();
  } finally {
    await browser.close();
    server.close();
  }

  const summary = {
    at: new Date().toISOString(),
    port,
    outDir,
    runs: report.runs,
    consoleErrorCount: report.consoleErrors.length,
    findingCount: report.findings.length,
    findings: report.findings,
    consoleErrors: report.consoleErrors
  };
  await writeFile(join(outDir, 'report.json'), JSON.stringify(summary, null, 2));

  console.log(JSON.stringify({ ok: report.findings.length === 0 && report.consoleErrors.length === 0, summary }, null, 2));
  if (report.findings.length || report.consoleErrors.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
