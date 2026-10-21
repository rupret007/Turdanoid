// @vitest-environment node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hasBrowser = Boolean(process.env.PLAYWRIGHT_CHANNEL) || existsSync(chromium.executablePath());
let server;
let browser;
let origin;

beforeAll(async () => {
  if (!hasBrowser) { return; }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.m4a': 'audio/mp4' };
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname.replace(/^\/StalemateSite\/play\//, '/');
    const path = resolve(root, `.${decodeURIComponent(pathname)}`);
    if (!path.startsWith(`${root}${sep}`)) { response.writeHead(403).end(); return; }
    try {
      response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' }).end(await readFile(path));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium', headless: true });
});

afterAll(async () => {
  await browser?.close();
  if (server) { await new Promise((done) => server.close(done)); }
});

async function openPage(path, viewport = { width: 390, height: 844 }) {
  const page = await browser.newPage({ viewport });
  await page.clock.install({ time: new Date('2026-10-21T18:00:00Z') });
  await page.goto(origin + path);
  await page.waitForFunction(() => window.__turdomania);
  return page;
}

async function finishDaily(page) {
  return page.evaluate(() => {
    let guard = 0;
    while (!window.__turdomania.state.over && guard++ < 40) {
      const { state, Core } = window.__turdomania;
      let move = null;
      for (let c = 0; c < state.board.length && !move; c++) {
        for (let r = 0; r < state.board[c].length && !move; r++) {
          if (Core.findGroup(state.board, c, r).length >= 2) { move = [c, r]; }
        }
      }
      if (!move) { throw new Error('Expected a legal daily pop'); }
      window.__turdomaniaPop(...move);
    }
    return window.__turdomania.state.over;
  });
}

describe.runIf(hasBrowser)('Daily Dump browser behavior (emulated Chromium)', () => {
  it('keeps the exact board on short phones, desktop and rotation, with visible controls', async () => {
    let expected = null;
    for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 568 }, { width: 667, height: 375 }]) {
      const page = await openPage('/turdomania.html?daily=2026-10-21&reducedMotion=1', viewport);
      const before = await page.evaluate(() => ({
        board: window.__turdomania.state.board, challenge: window.__turdomania.daily.challenge,
        dims: [window.__turdomania.state.cols, window.__turdomania.state.rows]
      }));
      expect(before.dims).toEqual([8, 10]);
      if (expected) { expect(before).toEqual(expected); } else { expected = before; }
      const board = await page.locator('#boardWrap').boundingBox();
      const hud = await page.locator('header.hud').boundingBox();
      expect(board.x).toBeGreaterThanOrEqual(0);
      expect(board.y).toBeGreaterThanOrEqual(0);
      expect(board.x + board.width).toBeLessThanOrEqual(viewport.width);
      expect(board.y + board.height).toBeLessThanOrEqual(viewport.height);
      if (viewport.width > viewport.height && viewport.width <= 980) { expect(board.x + board.width).toBeLessThanOrEqual(hud.x); }
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => window.__turdomania.state.board)).toEqual(before.board);
      await page.close();
    }
  });

  it('resumes refresh, blocks first-run undo/restart, and keeps the first result through practice', async () => {
    const page = await openPage('/turdomania.html?daily=2026-10-21&reducedMotion=1');
    await page.evaluate(() => {
      const { state, Core } = window.__turdomania;
      for (let c = 0; c < state.board.length; c++) {
        for (let r = 0; r < state.board[c].length; r++) {
          if (Core.findGroup(state.board, c, r).length >= 2) { window.__turdomaniaPop(c, r); return; }
        }
      }
    });
    const afterMove = await page.evaluate(() => window.__turdomania.state);
    await page.keyboard.press('u');
    await page.keyboard.press('n');
    expect(await page.evaluate(() => window.__turdomania.state)).toEqual(afterMove);
    await page.reload();
    await page.waitForFunction(() => window.__turdomania);
    expect(await page.evaluate(() => window.__turdomania.state)).toEqual(afterMove);
    expect(await finishDaily(page)).toBe(true);
    const first = await page.evaluate(() => Object.entries(window.localStorage).filter(([key]) => key.startsWith('stalemate_daily_dump_result')));
    expect(first).toHaveLength(1);
    await page.locator('#againBtn').click();
    expect(await page.evaluate(() => window.__turdomania.daily.practice)).toBe(true);
    expect(await finishDaily(page)).toBe(true);
    expect(await page.evaluate(() => Object.entries(window.localStorage).filter(([key]) => key.startsWith('stalemate_daily_dump_result')))).toEqual(first);
    expect(await page.evaluate(() => window.localStorage.getItem('turdomania_best_v1'))).toBeNull();
    await page.close();
  });

  it('shares an actual PNG with the dated project link, handles cancellation and manual copy', async () => {
    const page = await openPage('/StalemateSite/play/turdomania.html?daily=2026-10-21&reducedMotion=1');
    expect(await finishDaily(page)).toBe(true);
    await page.evaluate(() => {
      Object.defineProperty(window.navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(window.navigator, 'share', {
        configurable: true,
        value: async (data) => { window.__dailyShare = { text: data.text, type: data.files?.[0]?.type, size: data.files?.[0]?.size }; }
      });
    });
    await page.locator('#dailyShare').click();
    const shared = await page.evaluate(() => window.__dailyShare);
    expect(shared.type).toBe('image/png');
    expect(shared.size).toBeGreaterThan(1000);
    expect(shared.text).toContain('/StalemateSite/play/turdomania.html?daily=2026-10-21&v=1');
    await page.evaluate(() => {
      Object.defineProperty(window.navigator, 'share', { configurable: true, value: async () => { const error = new Error('canceled'); error.name = 'AbortError'; throw error; } });
    });
    await page.locator('#dailyShare').click();
    await page.waitForFunction(() => document.getElementById('dailyShareStatus').textContent.includes('canceled'));
    expect(await page.locator('#dailyShareFallback').isVisible()).toBe(false);
    await page.evaluate(() => {
      Object.defineProperty(window.navigator, 'clipboard', { configurable: true, value: undefined });
    });
    await page.locator('#dailyCopy').click();
    expect(await page.locator('#dailyShareFallback').isVisible()).toBe(true);
    expect(await page.locator('#dailyShareFallback').inputValue()).toContain('Stalemate Arcade');
    await page.close();
  });

  it('boots both free play and daily when the localStorage property getter is denied', async () => {
    for (const query of ['?seed=42&reducedMotion=1', '?daily=2026-10-21&reducedMotion=1']) {
      const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
      await page.clock.install({ time: new Date('2026-10-21T18:00:00Z') });
      await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('storage property denied'); } });
      });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${origin}/turdomania.html${query}`);
      await page.waitForFunction(() => window.__turdomania);
      expect(await page.locator('.tile').count()).toBeGreaterThan(0);
      expect(errors).toEqual([]);
      if (query.includes('daily=')) { expect(await page.locator('#dailyStorageNote').textContent()).toContain('Saving is unavailable'); }
      await page.close();
    }
  });

  it('cancels an in-flight pop when a new free-play board starts, without duplicate tile identities', async () => {
    const page = await openPage('/turdomania.html?seed=42');
    await page.evaluate(() => {
      const { state, Core } = window.__turdomania;
      let move = null;
      for (let c = 0; c < state.board.length && !move; c++) {
        for (let r = 0; r < state.board[c].length && !move; r++) {
          if (Core.findGroup(state.board, c, r).length >= 2) { move = [c, r]; }
        }
      }
      window.__turdomaniaPop(...move);
      document.getElementById('newBtn').click();
    });
    await page.waitForTimeout(300);
    const counts = await page.evaluate(() => ({
      logical: window.__turdomania.Core.tileCount(window.__turdomania.state.board),
      rendered: document.querySelectorAll('.tile').length,
      unique: new Set([...document.querySelectorAll('.tile')].map((tile) => tile.id)).size,
      moves: window.__turdomania.state.moves
    }));
    expect(counts.rendered).toBe(counts.logical);
    expect(counts.unique).toBe(counts.logical);
    expect(counts.moves).toBe(0);
    await page.close();
  });

  it('shows invalid-link guidance and keeps free-play controls in the viewport', async () => {
    const page = await openPage('/turdomania.html?daily=bad', { width: 320, height: 568 });
    const notice = await page.locator('#dailyInfo').boundingBox();
    expect(notice.y).toBeGreaterThanOrEqual(0);
    expect(await page.locator('#dailyInfo').textContent()).toContain('invalid');
    const newButton = await page.locator('#newBtn').boundingBox();
    expect(newButton.y + newButton.height).toBeLessThanOrEqual(568);
    expect(await page.evaluate(() => window.__turdomania.daily)).toBeNull();
    await page.close();
  });
});
