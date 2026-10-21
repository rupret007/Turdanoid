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

async function openPage(path, viewport = { width: 390, height: 844 }, setup) {
  const page = await browser.newPage({ viewport });
  if (setup) { await page.addInitScript(setup); }
  await page.goto(origin + path);
  await page.waitForFunction(() => window.__turdomania);
  return page;
}

async function popFirst(page) {
  const move = await page.evaluate(() => {
    const { state, Core } = window.__turdomania;
    for (let c = 0; c < state.board.length; c++) {
      for (let r = 0; r < state.board[c].length; r++) {
        if (Core.findGroup(state.board, c, r).length >= 2) { return [c, r]; }
      }
    }
    return null;
  });
  expect(move).not.toBeNull();
  await page.locator(`.tile[data-col="${move[0]}"][data-row="${move[1]}"]`).click();
  await page.waitForFunction(() => window.__turdomania.state.moves === 1);
}

describe.runIf(hasBrowser)('Turdomania browser behavior (emulated Chromium)', () => {
  it('preserves free-play 8×12 boards with 32px tiles on a short phone and keeps Aim clear of controls', async () => {
    for (const level of ['normal', 'hard']) {
      const page = await openPage(`/turdomania.html?seed=11&level=${level}`, { width: 320, height: 568 });
      await page.evaluate(() => document.fonts.ready);
      const report = await page.evaluate(() => {
        const tile = document.querySelector('.tile').getBoundingClientRect();
        const newButton = document.getElementById('newBtn').getBoundingClientRect();
        return { dims: [window.__turdomania.state.cols, window.__turdomania.state.rows], tile: tile.width, newBottom: newButton.bottom, hudHeight: document.querySelector('header.hud').offsetHeight, dockHeight: document.querySelector('.dock').offsetHeight, dockTop: document.querySelector('.dock').getBoundingClientRect().top };
      });
      expect(report.dims).toEqual([8, 12]);
      expect(report.tile, JSON.stringify(report)).toBeGreaterThanOrEqual(32);
      expect(report.newBottom).toBeLessThanOrEqual(568);
      await page.close();
    }
    const page = await openPage('/turdomania.html', { width: 360, height: 640 });
    await page.locator('.tm-aim summary').click();
    const controls = await page.evaluate(() => ['#newBtn', '#undoBtn', '[data-board-key="ArrowLeft"]', '[data-board-key="ArrowRight"]', '[data-board-key="ArrowUp"]', '[data-board-key="ArrowDown"]', '[data-board-key="Enter"]'].map((selector) => {
      const button = document.querySelector(selector);
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return { selector, visible: hit === button || button.contains(hit), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }));
    for (const control of controls) {
      expect(control.visible, control.selector).toBe(true);
      expect(control.left).toBeGreaterThanOrEqual(0);
      expect(control.right).toBeLessThanOrEqual(360);
      expect(control.top).toBeGreaterThanOrEqual(0);
      expect(control.bottom).toBeLessThanOrEqual(640);
    }
    await page.close();
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

  it.each(['daily=today', 'daily=2026-10-21&v=1', 'daily=bad&v=999'])(
    'opens an old challenge link as ordinary free play with working undo/new/difficulty: %s',
    async (query) => {
      const page = await openPage(`/turdomania.html?seed=42&reducedMotion=1&${query}`, undefined, () => {
        window.localStorage.setItem('turdomania_best_v1', JSON.stringify({ v: 1, best: { easy: 1, normal: 9999, hard: 3 } }));
        window.localStorage.setItem('turdomania_prefs_v1', JSON.stringify({ v: 1, level: 'normal' }));
        window.localStorage.setItem('stalemate_daily_dump_active_v1', 'legacy challenge data');
      });
      const before = await page.evaluate(() => ({
        state: window.__turdomania.state,
        expected: window.__turdomania.Core.newGame('normal', 42, window.__turdomania.state).board
      }));
      expect(before.state.board).toEqual(before.expected);
      expect(await page.locator('h1').textContent()).toContain('Turdomania');
      expect(await page.locator('#levelSel').isEnabled()).toBe(true);
      expect(await page.locator('#newBtn').isEnabled()).toBe(true);
      expect(await page.locator('#best').textContent()).toBe('9999');
      expect(await page.locator('#dailyInfo, #dailyIdentity, #dailyShare, .daily-feature').count()).toBe(0);
      await popFirst(page);
      expect(await page.locator('#undoBtn').isEnabled()).toBe(true);
      await page.locator('#undoBtn').click();
      expect(await page.evaluate(() => window.__turdomania.state.board)).toEqual(before.state.board);
      await page.locator('.suite-difficulty-btn[data-level="hard"]').click();
      expect(await page.evaluate(() => window.__turdomania.state.level)).toBe('hard');
      await page.locator('#newBtn').click();
      expect(await page.evaluate(() => window.__turdomania.state.moves)).toBe(0);
      const saved = await page.evaluate(() => ({
        best: JSON.parse(window.localStorage.getItem('turdomania_best_v1')),
        legacy: window.localStorage.getItem('stalemate_daily_dump_active_v1')
      }));
      expect(saved.best.best.normal).toBe(9999);
      expect(saved.legacy).toBe('legacy challenge data');
      await page.close();
    }
  );

  it('plays and undoes when the localStorage property getter is denied', async () => {
    const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('storage property denied'); } });
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${origin}/turdomania.html?seed=42&reducedMotion=1`);
    await page.waitForFunction(() => window.__turdomania);
    const original = await page.evaluate(() => window.__turdomania.state.board);
    await popFirst(page);
    await page.locator('#undoBtn').click();
    expect(await page.evaluate(() => window.__turdomania.state.board)).toEqual(original);
    expect(errors).toEqual([]);
    await page.close();
  });

  it('keeps the hub focused on all seven games and existing local records', async () => {
    const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
    await page.goto(`${origin}/index.html`);
    expect(await page.locator('.game-card').count()).toBe(7);
    expect(await page.locator('title').textContent()).toBe('Stalemate Arcade — Seven Free Games');
    expect(await page.locator('.daily-feature, #daily-hub-play, #daily-hub-status').count()).toBe(0);
    const hrefs = await page.locator('.game-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('href')));
    expect(hrefs).toContain('turdomania.html');
    expect(hrefs).toContain('TurdAnoid.html');
    expect(hrefs).toContain('turdspades.html');
    await page.close();
  });
});
