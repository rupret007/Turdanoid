// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, playMove, snapshot, SAVE_KEY } from '../games/chess-core.js';
import { contrastRatio } from '../games/suite-arcade-a11y.js';
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
  await page.locator(`input[name=mode][value=${mode}]`).check();
  if (mode === 'computer') { await page.selectOption('#side', side); }
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
      await start(page);
      expect(await page.locator('#undo').evaluate(el => globalThis.getComputedStyle(el).fontFamily)).toContain('Source Sans 3');
      await page.locator('[data-square=e2]').focus();
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
      await page.locator('[data-square=b7]').click();
      expect(await page.locator('#status').textContent()).toContain('2 legal destinations marked.');
      await page.locator('[data-square=a8]').click(); expect(await page.locator('#promotion').evaluate(el => el.open)).toBe(true);
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
      expect(await page.locator('.game-card[href="chess.html"]').getAttribute('aria-label')).toContain('Continue — in progress');
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it('keeps Play disabled until the required chess interface is ready', async () => {
    const page = await browser.newPage();
    let release;
    const pending = new Promise(done => { release = done; });
    await page.route('**/games/chess-ui.js', async route => { await pending; await route.continue(); });
    try {
      await page.goto(base + '/chess.html', { waitUntil: 'commit' });
      await page.locator('#new-game button[type=submit]').waitFor();
      expect(await page.locator('#new-game button[type=submit]').isDisabled()).toBe(true);
      release();
      await page.waitForFunction(() => globalThis.SuiteLoading?.state === 'ready');
      expect(await page.locator('#new-game button[type=submit]').isEnabled()).toBe(true);
      await page.locator('#new-game button[type=submit]').click();
      expect(await page.locator('#board').isVisible()).toBe(true);
    } finally { release(); await page.close(); }
  });
  it('keeps one real engine warm across ordinary turns', async () => {
    const page = await pageAt(); const downloads = [];
    page.on('request', request => { if (request.url().endsWith('.wasm')) { downloads.push(request.url()); } });
    try {
      await start(page, 'computer'); await move(page, 'e2e4'); await moves(page, 2);
      await move(page, 'g1f3'); await moves(page, 4);
      expect(downloads).toHaveLength(1); expect(page.workers()).toHaveLength(1);
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
      await page.locator('#game-options > summary').click(); await page.locator('#resign').click();
      await page.locator('#confirm-no').click(); expect(await page.locator('#result').isVisible()).toBe(false);
      await page.locator('#resign').click(); await page.locator('#confirm-yes').click();
      expect(await page.locator('#status').textContent()).toBe('Resignation');
      const download = page.waitForEvent('download'); await page.locator('#export').click();
      expect((await download).suggestedFilename()).toBe('royal-flush-chess.pgn');
    } finally { await page.close(); }
  });
  it.each([{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 568, height: 320 }, { width: 667, height: 375 }])('keeps board cells square at $width × $height', async viewport => {
    const page = await pageAt(viewport);
    try {
      await start(page);
      const geometry = await page.locator('#board').evaluate(el => {
        const board = el.getBoundingClientRect(), cell = el.querySelector('button').getBoundingClientRect();
        return { board: Math.abs(board.width - board.height), cell: Math.abs(cell.width - cell.height), size: cell.width };
      });
      if (viewport.width > viewport.height) {
        for (const lan of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) { await move(page, lan); }
        expect(await page.locator('#turn').textContent()).toBe('Black wins!');
        const boardBox = await page.locator('#board').boundingBox();
        expect(boardBox.y).toBeGreaterThanOrEqual(0);
        expect(boardBox.y + boardBox.height).toBeLessThanOrEqual(viewport.height);
      }
      expect(geometry.board).toBeLessThan(1); expect(geometry.cell).toBeLessThan(1);
      expect(geometry.size).toBeGreaterThanOrEqual(24);
      if (viewport.width === 320) {
        const flip = await page.locator('#flip').boundingBox();
        expect(flip.y + flip.height).toBeLessThanOrEqual(viewport.height);
      }
      await page.locator('#game-options > summary').click();
      await page.locator('#suite-arcade-a11y-toggle').click();
      expect(await page.locator('html').getAttribute('class')).toContain('suite-colorblind');
      expect(await page.locator('#suite-arcade-a11y-toggle').textContent()).toBe('Contrast on');
    } finally { await page.close(); }
  });
  it('cancels a pending search on simulated visibility loss and resumes deliberately', async () => {
    const page = await pageAt();
    let release;
    const pending = new Promise(done => { release = done; });
    let held = false;
    await page.context().route('**/stockfish-19-lite-single.wasm', async route => {
      held = true; await pending; await route.continue().catch(() => {});
    });
    try {
      await start(page, 'computer'); await move(page, 'e2e4');
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('thinking'));
      for (let attempt = 0; attempt < 1000 && !held; attempt++) { await new Promise(done => setTimeout(done, 10)); }
      expect(held).toBe(true);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new globalThis.Event('visibilitychange'));
      });
      release();
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        document.dispatchEvent(new globalThis.Event('visibilitychange'));
      });
      expect(await page.locator('#resume-playing').isVisible()).toBe(true);
      await moves(page, 1);
      await page.context().unroute('**/stockfish-19-lite-single.wasm');
      await page.locator('#resume-playing').click(); await moves(page, 2);
    } finally { release(); await page.close(); }
  });
  it('keeps coordinate text and move dots readable in both board palettes', async () => {
    const page = await pageAt();
    const hex = css => '#' + css.match(/\d+/g).slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('');
    try {
      await start(page); await page.locator('#game-options > summary').click();
      for (const high of [false, true]) {
        if (high) { await page.locator('#suite-arcade-a11y-toggle').click(); }
        await page.locator('[data-square=e2]').click();
        await page.mouse.move(0, 0);
        const colors = await page.evaluate(() => {
          const coord = document.querySelector('[data-square=a3] .coord');
          return {
            text: globalThis.getComputedStyle(coord).color,
            background: globalThis.getComputedStyle(coord.parentElement).backgroundColor,
            dots: [...document.querySelectorAll('.square.legal')].map(button => ({
              foreground: globalThis.getComputedStyle(button, '::after').backgroundColor,
              background: globalThis.getComputedStyle(button).backgroundColor
            }))
          };
        });
        expect(contrastRatio(hex(colors.text), hex(colors.background))).toBeGreaterThanOrEqual(4.5);
        for (const dot of colors.dots) { expect(contrastRatio(hex(dot.foreground), hex(dot.background))).toBeGreaterThanOrEqual(3); }
        await page.keyboard.press('Escape');
      }
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
  it('returns to the saved board when a new game is cancelled', async () => {
    const page = await pageAt();
    try {
      await start(page); await move(page, 'e2e4');
      const saved = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
      await page.locator('#game-options > summary').click(); await page.locator('#new').click();
      await page.locator('#new-game button[type=submit]').click(); await page.locator('#confirm-no').click();
      expect(await page.locator('#game').isVisible()).toBe(true);
      expect(await page.locator('#setup').isVisible()).toBe(false);
      expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(saved);
      await move(page, 'e7e5'); await moves(page, 2);
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it('uses the promoting side for Black promotion artwork', async () => {
    const page = await pageAt(); const game = createGame({ mode: 'local' });
    for (const lan of ['a2a4', 'h7h5', 'a4a5', 'h5h4', 'a5a6', 'h4h3', 'a6b7', 'h3g2', 'b7a8q']) { playMove(game, lan); }
    try {
      await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: SAVE_KEY, value: JSON.stringify(snapshot(game)) });
      await page.reload(); await page.locator('#continue').click(); await move(page, 'g2h1');
      const pawnColor = await page.locator('[data-square=g2] svg g').getAttribute('fill');
      for (const type of ['q', 'r', 'b', 'n']) {
        expect(await page.locator(`[data-promote=${type}] svg g`).getAttribute('fill')).toBe(pawnColor);
      }
      await page.locator('#cancel-promotion').click(); await moves(page, 9);
      expect(await page.locator('[data-square=g2]').getAttribute('aria-label')).toContain('Black pawn');
    } finally { await page.close(); }
  });
  it('cancels promotion safely on simulated backgrounding and leaves resumption reachable', async () => {
    const page = await pageAt(); const game = createGame({ mode: 'local' });
    for (const lan of ['a2a4', 'h7h5', 'a4a5', 'h5h4', 'a5a6', 'h4h3', 'a6b7', 'h3g2']) { playMove(game, lan); }
    try {
      await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: SAVE_KEY, value: JSON.stringify(snapshot(game)) });
      await page.reload(); await page.locator('#continue').click(); await move(page, 'b7a8');
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new globalThis.Event('visibilitychange'));
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new globalThis.Event('visibilitychange'));
      });
      expect(await page.locator('#promotion').evaluate(el => el.open)).toBe(false);
      expect(await page.locator('#resume-playing').isVisible()).toBe(true); await moves(page, 8);
      expect(await page.locator('#status').textContent()).toContain('paused');
      await page.locator('#resume-playing').click(); await move(page, 'b7a8'); await page.locator('[data-promote=n]').click(); await moves(page, 9);
      expect(await page.locator('[data-square=a8]').getAttribute('aria-label')).toContain('White knight');
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it('describes a finished game honestly on its board and during review', async () => {
    const page = await pageAt();
    try {
      await start(page); for (const lan of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) { await move(page, lan); }
      expect(await page.locator('#board').getAttribute('aria-label')).toContain('Black wins');
      expect(await page.locator('#board').getAttribute('aria-label')).not.toContain('to move');
      await page.locator('#previous').click(); expect(await page.locator('#status').textContent()).not.toContain('to play');
      expect(await page.locator('#live').textContent()).toBe('Final board');
      await page.locator('#live').click(); expect(await page.locator('#status').textContent()).toBe('Checkmate');
      expect(await page.locator('#undo').isDisabled()).toBe(true);
    } finally { await page.close(); }
  });
  it('starts local play with White at the bottom regardless of hidden computer settings', async () => {
    const page = await pageAt();
    try {
      await page.selectOption('#side', 'b'); await start(page);
      expect(await page.locator('#board button').first().getAttribute('data-square')).toBe('a8');
      expect(await page.locator('#turn').textContent()).toBe('White to move');
      await page.keyboard.press('Enter'); expect(await page.locator('#status').textContent()).toContain('White pawn');
      await page.keyboard.press('Escape'); await page.locator('#flip').click(); await move(page, 'e2e4'); await moves(page, 1);
    } finally { await page.close(); }
  });
  it('opens long help at its heading rather than scrolling to the last button', async () => {
    const page = await pageAt({ width: 320, height: 568 });
    try {
      await page.locator('#how-to').click();
      expect(await page.locator('#guide').evaluate(el => el.scrollTop)).toBe(0);
      const heading = await page.locator('#guide-title').boundingBox();
      expect(heading.y).toBeGreaterThanOrEqual(0); expect(heading.y + heading.height).toBeLessThan(568);
      await page.locator('#close-guide').click(); await page.locator('#how-to').click();
      expect(await page.locator('#guide').evaluate(el => el.scrollTop)).toBe(0);
    } finally { await page.close(); }
  });
  it('makes two-player selection visible, accessible and independent from computer assets', async () => {
    const page = await pageAt({ width: 320, height: 568 }, true); const engineRequests = [];
    page.on('request', r => { if (/stockfish.*\.(js|wasm)/.test(r.url())) { engineRequests.push(r.url()); } });
    try {
      const local = page.getByRole('radio', { name: /2 players.*Share this device/ });
      expect(await local.isVisible()).toBe(true); await local.check();
      expect(await page.locator('#computer-options').isVisible()).toBe(false);
      await page.getByRole('button', { name: 'Play 2-player chess →' }).click();
      await move(page, 'e2e4', true); await move(page, 'e7e5', true); await moves(page, 2);
      expect(await page.locator('#game-label').textContent()).toContain('PASS & PLAY');
      expect(engineRequests).toEqual([]); expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it('offers an optional illustrated piece reference and useful illegal-move reminders', async () => {
    const page = await pageAt({ width: 320, height: 568 });
    try {
      await page.locator('#how-to').click(); await page.locator('#piece-guide summary').click();
      expect(await page.locator('#piece-reference dt').count()).toBe(6);
      expect(await page.locator('#piece-reference svg').count()).toBe(12);
      expect(await page.locator('#piece-reference').innerText()).toContain('The only piece that can jump');
      await page.getByRole('button', { name: 'Close how to play' }).click();
      await start(page); await move(page, 'e2e5'); await moves(page, 0);
      expect(await page.locator('#status').textContent()).toContain('Pawns move forward');
      await page.keyboard.press('Escape'); await move(page, 'e2e4'); await moves(page, 1);
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it('preserves a real local move and mute through native back navigation', async () => {
    const page = await pageAt();
    try {
      await start(page); await page.locator('#mute').click(); await move(page, 'e2e4');
      await page.locator('.chess-hub').click(); await page.waitForFunction(() => document.body.dataset.arcadeGame === 'hub');
      await page.goBack(); await page.waitForFunction(() => globalThis.SuiteLoading?.state === 'ready');
      if (await page.locator('#continue').isVisible()) { await page.locator('#continue').click(); }
      if (await page.locator('#resume-playing').isVisible()) { await page.locator('#resume-playing').click(); }
      await moves(page, 1); expect(await page.evaluate(() => globalThis.Suite.isMuted())).toBe(true);
      await move(page, 'e7e5'); await moves(page, 2); expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it.each(['computer', 'local'])('keeps the board and both player strips visible in short landscape during %s play', async mode => {
    const page = await pageAt({ width: 390, height: 844 });
    try {
      await start(page, mode); await move(page, 'e2e4');
      if (mode === 'local') { await move(page, 'e7e5'); } else { await moves(page, 2); }
      for (const viewport of [{ width: 568, height: 320 }, { width: 667, height: 375 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(viewport);
        for (const flip of [false, true]) {
          if (flip) { await page.locator('#flip').click(); }
          const box = await page.locator('.chess-table').boundingBox();
          expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        }
      }
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it('retains full captured-piece details without pushing a computer board offscreen (legal layout fixture)', async () => {
    const page = await pageAt({ width: 568, height: 320 }); const game = createGame({ mode: 'computer', side: 'b' });
    for (const lan of ['a2a4', 'h7h5', 'a4a5', 'h5h4', 'a5a6', 'h4h3', 'a6b7', 'h3g2', 'b7a8q']) { playMove(game, lan); }
    try {
      await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: SAVE_KEY, value: JSON.stringify(snapshot(game)) });
      await page.reload(); await page.locator('#continue').click();
      const box = await page.locator('.chess-table').boundingBox(); expect(box.y + box.height).toBeLessThanOrEqual(320);
      expect(await page.locator('#white-captured-review').innerText()).toContain('rook');
      expect(await page.locator('#white-captured-review').innerText()).toContain('pawn');
      expect(await page.locator('#black-captured-review').innerText()).toContain('pawn');
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
});
