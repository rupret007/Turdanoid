// @vitest-environment node
/* global URL, rules, window */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hasBrowser = Boolean(process.env.PLAYWRIGHT_CHANNEL) || existsSync(chromium.executablePath());

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

const CRAPEIGHTS_CONTROLS = [
  '#smartBtn',
  '#drawBtn',
  '#playBtn',
  '#passBtn',
  '#playerHand .card-btn'
];

const CRAPJACK_CONTROLS = ['#mobilePit [data-mobile-action]', '#mobilePit .btn'];

const BOSS_CONTROLS = ['#btnPause', '#btnSound', '#hudLives', '#hudScore', '#hudLevel'];

let server;
let baseUrl;
let browser;

beforeAll(async () => {
  if (!hasBrowser) {
    return;
  }
  server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const filePath = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filePath.startsWith(`${root}${sep}`)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
    headless: true
  });
}, 60_000);

afterAll(async () => {
  await browser?.close();
  if (server) {
    await new Promise((done, err) => server.close((e) => (e ? err(e) : done())));
  }
});

async function dismissGuides(page) {
  await page.evaluate(() => {
    localStorage.setItem('turdsuite_guides_seen_v1', '1');
  });
}

async function prepCrapeights(page) {
  await dismissGuides(page);
  await page.getByRole('button', { name: 'Quick Start' }).click();
  await page.waitForTimeout(300);
}

async function prepCrapjack(page) {
  await dismissGuides(page);
  await page.evaluate(() => {
    if (typeof rules !== 'undefined') {
      rules.allowInsurance = false;
    }
  });
  const quick = page.getByRole('button', { name: 'Quick Start' });
  if (await quick.isVisible().catch(() => false)) {
    await quick.click();
  }
  await page.waitForFunction(
    () => document.body.classList.contains('jack-table-first'),
    { timeout: 10_000 }
  );
  await page.evaluate(() => {
    window.SuiteArcadeA11y?.syncArcadeA11yMount?.(document);
  });
  const overlay = page.locator('#jackConfirmOverlay[aria-hidden="false"]');
  if (await overlay.isVisible().catch(() => false)) {
    await page.click('#jackConfirmNo');
    await overlay.waitFor({ state: 'hidden' });
  }
  await page.waitForTimeout(300);
}

async function prepBossFlush(page) {
  await page.evaluate(() => {
    localStorage.setItem('turdanoid_v3_coach_v1', '1');
    localStorage.setItem('turdsuite_guides_seen_v1', '1');
  });
  await page.locator('#btnBoss').click();
  await page.waitForFunction(
    () => window.__turdanoid?.state === 'playing' && window.__turdanoid?.gameMode === 'boss',
    { timeout: 15_000 }
  );
}

async function loadOverlapProbe(page) {
  await page.addScriptTag({
    type: 'module',
    content: `import { measurePlayOverlap } from '${baseUrl}/games/play-mobile-overlap-core.js'; window.__measurePlayOverlap = measurePlayOverlap;`
  });
  await page.waitForFunction(() => typeof window.__measurePlayOverlap === 'function');
}

async function assertNoOverlap(page, controlSelectors) {
  const issues = await page.evaluate((selectors) => {
    return window.__measurePlayOverlap(document, selectors);
  }, controlSelectors);
  expect(issues, JSON.stringify(issues)).toEqual([]);
}

(hasBrowser ? describe : describe.skip)('play mobile overlap (live pages)', () => {
  it('Crappy Eights Smart dock at 320×568 scrolled to bottom', async () => {
    const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
    try {
      await page.goto(`${baseUrl}/crapeights.html`, { waitUntil: 'domcontentloaded' });
      await loadOverlapProbe(page);
      await prepCrapeights(page);
      const maxScroll = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight
      );
      await page.evaluate((y) => window.scrollTo(0, y), maxScroll);
      await page.waitForTimeout(100);
      await assertNoOverlap(page, CRAPEIGHTS_CONTROLS);
    } finally {
      await page.close();
    }
  });

  for (const scrollY of [80, 100, 120]) {
    it(`Crapjack Smart pit at 320×568 scrollY=${scrollY}`, async () => {
      const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
      try {
        await page.goto(`${baseUrl}/turdjack.html`, { waitUntil: 'domcontentloaded' });
        await loadOverlapProbe(page);
        await prepCrapjack(page);
        await page.evaluate((y) => window.scrollTo(0, y), scrollY);
        await page.waitForTimeout(200);
        await assertNoOverlap(page, CRAPJACK_CONTROLS);
      } finally {
        await page.close();
      }
    });
  }

  for (const scrollLabel of ['top', 'bottom']) {
    it(`Boss Flush at 390×844 scrolled to ${scrollLabel}`, async () => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      try {
        await page.goto(`${baseUrl}/TurdAnoid.html`, { waitUntil: 'domcontentloaded' });
        await loadOverlapProbe(page);
        await prepBossFlush(page);
        if (scrollLabel === 'bottom') {
          const maxScroll = await page.evaluate(
            () => document.documentElement.scrollHeight - window.innerHeight
          );
          await page.evaluate((y) => window.scrollTo(0, y), maxScroll);
        } else {
          await page.evaluate(() => window.scrollTo(0, 0));
        }
        await page.waitForTimeout(100);
        await assertNoOverlap(page, BOSS_CONTROLS);
      } finally {
        await page.close();
      }
    });
  }
});
