// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, playMove, snapshot, SAVE_KEY } from '../games/chess-core.js';
let browser, server, base;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm' };
beforeAll(async () => {
  server = createServer(async (req, res) => {
    const pathname = new globalThis.URL(req.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    try { res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }); res.end(await readFile(file)); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => { await browser?.close(); await new Promise(done => server?.close(done)); });
async function pageAt(viewport = { width: 1280, height: 900 }, touch = false) {
  const page = await browser.newPage({ viewport, hasTouch: touch, reducedMotion: 'reduce' });
  page.chessErrors = []; page.on('pageerror', error => page.chessErrors.push(error.message));
  await page.goto(base + '/chess.html'); await page.waitForFunction(() => globalThis.SuiteLoading?.state === 'ready');
  return page;
}
async function start(page, mode = 'local', side = 'w') {
  if (mode === 'computer') { await page.selectOption('#side', side); }
  await page.selectOption('#mode', mode);
  await page.locator('#new-game button[type=submit]').click();
}
async function move(page, text, touch = false) {
  for (const square of [text.slice(0, 2), text.slice(2, 4)]) {
    const button = page.locator(`[data-square=${square}]`);
    if (touch) { await button.tap(); } else { await button.click(); }
  }
}
async function moves(page, count) { await page.waitForFunction(n => document.querySelectorAll('#moves button').length === n, count); }

describe('native chess interface', () => {
  it('plays keyboard moves with retained focus, rejects an illegal move and reviews history', async () => {
    const page = await pageAt();
    try {
      await start(page); await page.locator('[data-square=e2]').focus();
      await page.keyboard.press('Enter'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
      await moves(page, 1);
      expect(await page.locator('[data-square=e4]').evaluate(el => el === document.activeElement)).toBe(true);
      await move(page, 'e7e4'); await moves(page, 1);
      expect(await page.locator('#status').textContent()).toContain('not legal');
      await page.keyboard.press('Escape');
      await move(page, 'e7e5'); await moves(page, 2);
      await page.locator('#previous').click(); expect(await page.locator('#turn').textContent()).toContain('Reviewing');
      expect(await page.locator('[data-square=e7]').getAttribute('aria-label')).toContain('Black pawn');
      await page.locator('#live').click(); await page.locator('#undo').click(); await moves(page, 1);
      await page.locator('#flip').click(); expect(await page.locator('#board button').first().getAttribute('data-square')).toBe('h1');
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it('plays a touch checkmate, records once across reload and offers a fresh rematch', async () => {
    const page = await pageAt({ width: 320, height: 640 }, true);
    try {
      await start(page);
      for (const text of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) { await move(page, text, true); }
      expect(await page.locator('#turn').textContent()).toBe('Black wins!');
      expect(await page.locator('#status').textContent()).toBe('Checkmate');
      expect(await page.locator('#undo').isDisabled()).toBe(true);
      await page.reload();
      const results = await page.evaluate(() => JSON.parse(localStorage.getItem('arcade_chess_results_v1')));
      expect(results.local).toBe(1);
      // A finished game remains reviewable without an unfinished hub badge.
      expect(await page.locator('#saved-description').textContent()).toContain('Checkmate');
      await page.locator('#continue').click();
      expect(await page.locator('#turn').textContent()).toBe('Black wins!');
      await page.locator('#rematch').click();
      expect(await page.locator('#turn').textContent()).toBe('White to move');
      expect(await page.locator('#moves button').count()).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= globalThis.innerWidth)).toBe(true);
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it.each(['q', 'r', 'b', 'n'])('uses the native promotion dialog for %s (legal regression setup)', async promotion => {
    const game = createGame({ mode: 'local' });
    for (const text of ['a2a4', 'h7h5', 'a4a5', 'h5h4', 'a5a6', 'h4h3', 'a6b7', 'h3g2']) { playMove(game, text); }
    const page = await pageAt();
    try {
      await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: SAVE_KEY, value: JSON.stringify(snapshot(game)) });
      await page.reload(); await page.locator('#continue').click();
      await move(page, 'b7a8'); expect(await page.locator('#promotion').evaluate(el => el.open)).toBe(true);
      await page.locator(`[data-promote=${promotion}]`).click();
      const name = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[promotion];
      expect(await page.locator('[data-square=a8]').getAttribute('aria-label')).toContain('White ' + name);
      expect(await page.locator('#moves button').last().textContent()).toContain('=' + promotion.toUpperCase());
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it('uses a real engine, hints and full-turn undo; cancels a pending reply and continues from the hub', async () => {
    const page = await pageAt();
    try {
      await start(page, 'computer'); await move(page, 'e2e4'); await moves(page, 2);
      await page.locator('#hint').click(); await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Try '));
      await page.locator('#undo').click(); await moves(page, 0);
      await move(page, 'd2d4'); await page.locator('#undo').click();
      await page.waitForTimeout(1200); await moves(page, 0);
      await move(page, 'e2e4'); await moves(page, 2);
      await page.reload(); await page.locator('#continue').click(); await moves(page, 2);
      await page.goto(base + '/'); await page.waitForFunction(() => document.querySelector('a[href="chess.html"] .play').textContent.includes('Continue'));
      expect(await page.locator('.game-card').count()).toBe(8);
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it('recovers deliberately from a blocked engine without silently changing modes', async () => {
    const page = await pageAt();
    try {
      await page.route('**/stockfish-19-lite-single.js', route => route.abort());
      await start(page, 'computer', 'b');
      await page.locator('#engine-recovery').waitFor({ state: 'visible' });
      expect(await page.locator('#game-label').textContent()).toContain('COMPUTER');
      await page.unroute('**/stockfish-19-lite-single.js');
      await page.locator('#retry').click(); await moves(page, 1);
      expect(await page.locator('#engine-recovery').isVisible()).toBe(false);
      await page.locator('details').last().locator('summary').click(); await page.locator('#resign').click();
      await page.locator('#confirm-no').click(); expect(await page.locator('#result').isVisible()).toBe(false);
      await page.locator('#resign').click(); await page.locator('#confirm-yes').click();
      expect(await page.locator('#status').textContent()).toBe('Resignation');
      const download = page.waitForEvent('download'); await page.locator('#export').click();
      expect((await download).suggestedFilename()).toBe('royal-flush-chess.pgn');
    } finally { await page.close(); }
  });
  it.each([{ width: 320, height: 568 }, { width: 844, height: 390 }])('keeps board cells square at $width × $height', async viewport => {
    const page = await pageAt(viewport);
    try {
      await start(page);
      const geometry = await page.locator('#board').evaluate(el => {
        const board = el.getBoundingClientRect(), cell = el.querySelector('button').getBoundingClientRect();
        return { board: Math.abs(board.width - board.height), cell: Math.abs(cell.width - cell.height), size: cell.width };
      });
      expect(geometry.board).toBeLessThan(1); expect(geometry.cell).toBeLessThan(1);
      expect(geometry.size).toBeGreaterThanOrEqual(24);
      if (viewport.width === 320) {
        const flip = await page.locator('#flip').boundingBox();
        expect(flip.y + flip.height).toBeLessThanOrEqual(viewport.height);
      }
      await page.locator('details').last().locator('summary').click();
      await page.locator('#suite-arcade-a11y-toggle').click();
      expect(await page.locator('html').getAttribute('class')).toContain('suite-colorblind');
      expect(await page.locator('#suite-arcade-a11y-toggle').textContent()).toBe('Contrast on');
    } finally { await page.close(); }
  });
  it('plays when storage is denied without modifying legacy saves', async () => {
    const page = await browser.newPage();
    try {
      await page.addInitScript(() => { Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('denied'); } }); });
      await page.goto(base + '/chess.html'); await start(page); await move(page, 'e2e4'); await moves(page, 1);
      expect(await page.locator('#save-status').textContent()).toContain('Storage is unavailable');
    } finally { await page.close(); }
  });
});
