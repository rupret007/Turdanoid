// @vitest-environment node
/* eslint-disable no-unused-vars -- browser globals referenced inside page.evaluate */
/* global roundActive, syncPlayLayoutChrome, closeGuide, clearAiTimer, state, render, getComputedStyle */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { PHONE_ROW_BODY_GAP } from '../games/turdspades-phone-hand.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hasBrowser = Boolean(process.env.PLAYWRIGHT_CHANNEL) || existsSync(chromium.executablePath());

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

let server;
let baseUrl;
let browser;

beforeAll(async () => {
  if (!hasBrowser) {
    return;
  }
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

describe.skipIf(!hasBrowser)('integration r2 phone layout', () => {
  it('keeps Crapjack between-hands HUD compact at 320 without crowding the table', async () => {
    const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
    await page.goto(`${baseUrl}/turdjack.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('turdsuite_guides_seen_v1', '1');
    });
    await page.waitForFunction(
      () => {
        if (typeof syncPlayLayoutChrome !== 'function') {
          return false;
        }
        roundActive = false;
        syncPlayLayoutChrome();
        return document.body.classList.contains('jack-phone-compact-hud');
      },
      undefined,
      { timeout: 10_000 }
    );
    const layout = await page.evaluate(() => {
      const mainHud = document.querySelector('.shell > .hud');
      const visibleSession = [...mainHud.querySelectorAll('[data-jack-stat-tier="session"]')].filter((el) => {
        const s = getComputedStyle(el);
        return s.display !== 'none' && el.getBoundingClientRect().height > 0;
      });
      const live = [...mainHud.querySelectorAll('[data-jack-stat-tier="live"]')].filter((el) => {
        const s = getComputedStyle(el);
        return s.display !== 'none' && el.getBoundingClientRect().height > 0;
      });
      const hudBox = mainHud.getBoundingClientRect();
      const tableBox = document.querySelector('.table').getBoundingClientRect();
      return {
        compactClass: document.body.classList.contains('jack-phone-compact-hud'),
        sessionVisible: visibleSession.length,
        liveVisible: live.length,
        hudHeight: hudBox.height,
        tableTop: tableBox.top,
        hudBottom: hudBox.bottom
      };
    });
    expect(layout.compactClass).toBe(true);
    expect(layout.sessionVisible).toBe(0);
    expect(layout.liveVisible).toBe(2);
    expect(layout.hudHeight).toBeLessThan(72);
    expect(layout.tableTop).toBeGreaterThanOrEqual(layout.hudBottom - 2);
    await page.close();
  });

  it('keeps TurdSpades two-row hand bodies separated at 320', async () => {
    const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
    await page.goto(`${baseUrl}/turdspades.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.__tsPhoneHand === 'function');
    await page.evaluate(() => {
      closeGuide();
      clearAiTimer();
      const deck = ['C', 'D', 'H', 'S'].flatMap((suit) =>
        Array.from({ length: 13 }, (_, i) => ({ id: `${suit}-${i + 2}`, suit, rank: i + 2 })));
      const ordered = deck.map((_, i) => deck[(i * 17) % 52]);
      Object.assign(state, {
        round: 4,
        phase: 'play',
        bids: [4, 3, 3, 3],
        tricks: [0, 0, 0, 0],
        trick: [],
        selected: null,
        hands: Array.from({ length: 4 }, (_, p) => ordered.slice(p * 13, (p + 1) * 13)),
        spadesBroken: true,
        currentPlayer: 0,
        msg: 'Your turn.'
      });
      render();
    });
    const layout = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('#youCards .card')];
      const rects = cards.map((c) => c.getBoundingClientRect());
      const row0 = rects.slice(0, 7);
      const row1 = rects.slice(7);
      const rearBottom = Math.max(...row0.map((r) => r.bottom));
      const frontTop = Math.min(...row1.map((r) => r.top));
      const dock = document.querySelector('.dock').getBoundingClientRect();
      const handBottom = Math.max(...rects.map((r) => r.bottom));
      return {
        rowGap: frontTop - rearBottom,
        dockClearance: dock.top - handBottom
      };
    });
    expect(layout.rowGap).toBeGreaterThanOrEqual(PHONE_ROW_BODY_GAP - 0.5);
    expect(layout.dockClearance).toBeGreaterThanOrEqual(0);
    await page.close();
  });
});
