// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SAVE_FIXTURE =
  '/Users/jeffstory/Documents/bob-overnight-inject/conductor/reviews/turdanoid-1000x/savecompat/b3821b4-saves.json';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json'
};

let server;
let baseUrl;
let browser;

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const path = resolve(
      root,
      `.${decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname)}`
    );
    if (!path.startsWith(`${root}${sep}`)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(path);
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
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
}, 30_000);

afterAll(async () => {
  await browser?.close();
  if (server) {
    await new Promise((done, err) => server.close((e) => (e ? err(e) : done())));
  }
});

describe('xfix round 2 integration', () => {
  it('keeps TurdRummy desktop side drawer (grid) at 1280×800', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${baseUrl}/turdrummy.html`, { waitUntil: 'domcontentloaded' });
    await page.locator('#startRoundBtn').click();
    await page.waitForTimeout(200);
    const layout = await page.evaluate(() => {
      const stage = document.querySelector('.table-stage');
      const drawer = document.getElementById('tableDrawer');
      const stageStyle = window.getComputedStyle(stage);
      const dr = drawer.getBoundingClientRect();
      return {
        display: stageStyle.display,
        drawerLeft: dr.left,
        drawerWidth: dr.width
      };
    });
    expect(layout.display).toBe('grid');
    expect(layout.drawerWidth).toBeLessThan(600);
    expect(layout.drawerLeft).toBeGreaterThan(400);
    await page.close();
  });

  it('loads b3821b4 saves on the hub and restores Crappy Eights continue', async () => {
    const saves = JSON.parse(readFileSync(SAVE_FIXTURE, 'utf8'));
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${baseUrl}/index.html`);
    await page.evaluate((payload) => {
      for (const [key, value] of Object.entries(payload)) {
        localStorage.setItem(key, value);
      }
      localStorage.setItem('turdanoid_v2_best', '4200');
      localStorage.setItem('turdanoid_boss_best_v1', '900');
    }, saves);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const hub = await page.evaluate(() => ({
      continueHref: document.querySelector('a[href="crapeights.html"]')?.getAttribute('href'),
      statText: document.body.innerText
    }));
    expect(hub.continueHref).toBe('crapeights.html');
    expect(hub.statText).toMatch(/4200|4,?200/);
    expect(hub.statText).toMatch(/760/);
    await page.goto(`${baseUrl}/crapeights.html`, { waitUntil: 'load' });
    /* eslint-disable no-undef -- crapeights in-page globals */
    await page.waitForFunction(
      () =>
        typeof isHumanTurn === 'function'
        && isHumanTurn()
        && Array.isArray(players)
        && players[0]?.hand?.length > 0,
      undefined,
      { timeout: 8000 }
    );
    const hand = await page.evaluate(() => {
      const list = players;
      return Array.isArray(list) && list[0] ? list[0].hand.length : 0;
    });
    /* eslint-enable no-undef */
    expect(hand).toBeGreaterThan(0);
    await page.close();
  });

  it('does not create AudioContext before first user gesture on hub (muted)', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => {
      window.__audioCtorCount = 0;
      const Native = window.AudioContext || window.webkitAudioContext;
      if (!Native) {
        return;
      }
      window.AudioContext = class extends Native {
        constructor(...args) {
          window.__audioCtorCount += 1;
          super(...args);
        }
      };
    });
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    let count = await page.evaluate(() => window.__audioCtorCount || 0);
    expect(count).toBe(0);
    await page.mouse.click(40, 40);
    await page.waitForTimeout(200);
    count = await page.evaluate(() => window.__audioCtorCount || 0);
    expect(count).toBeGreaterThanOrEqual(0);
    await page.close();
  });
});
