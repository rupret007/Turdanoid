// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, playMove, snapshot, SAVE_KEY } from '../games/chess-core.js';
import { contrastRatio } from '../games/suite-arcade-a11y.js';
let browser, server, base;
let wasmContentType = 'application/wasm';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.m4a': 'audio/mp4' };
async function progressCapture(page, name) {
  if (!process.env.ARCADE_PROGRESS_SCREENSHOTS) { return; }
  await mkdir(process.env.ARCADE_PROGRESS_SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: resolve(process.env.ARCADE_PROGRESS_SCREENSHOTS, name + '.png'), fullPage: true });
}
beforeAll(async () => {
  server = createServer(async (req, res) => {
    const pathname = new globalThis.URL(req.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    try {
      const contentType = extname(file) === '.wasm' ? wasmContentType : mime[extname(file)] || 'application/octet-stream';
      res.writeHead(200, contentType === null ? {} : { 'Content-Type': contentType }); res.end(await readFile(file));
    }
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
    // Chessground queues its public input callbacks; observe the resulting UI
    // after a browser frame instead of assuming click() commits synchronously.
    await page.evaluate(() => new Promise(done => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(done))));
  }
}
async function moves(page, count) { await page.waitForFunction(n => document.querySelectorAll('#moves button').length === n, count); }
async function drag(page, from, to) {
  const a = await page.locator(`[data-square=${from}]`).boundingBox();
  const b = typeof to === 'string' ? await page.locator(`[data-square=${to}]`).boundingBox() : to;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + (b.width || 0) / 2, b.y + (b.height || 0) / 2, { steps: 8 });
  // The library samples a dragged piece on animation frames, as on Lichess.
  await page.evaluate(() => new Promise(done => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(done))));
  await page.mouse.up();
}
async function artAt(page, square, role, color) {
  await page.waitForFunction(({ square, role, color }) => [...document.querySelectorAll('cg-board > piece')]
    .some(p => p.cgKey === square && p.classList.contains(role) && p.classList.contains(color)), { square, role, color }, { timeout: 3000 });
}
async function musicState(page) {
  // Resolve the real player once before synchronous native-browser polling.
  return page.evaluate(async () => {
    globalThis.__chessMusicReview = await globalThis.Suite.music();
    const player = globalThis.__chessMusicReview;
    return { armed: player.armed, paused: player.audioElement.paused, time: player.audioElement.currentTime };
  });
}
async function musicPlaying(page, title = 'Manic') {
  await page.waitForFunction(expected => {
    const player = globalThis.__chessMusicReview;
    return player.trackTitle === expected && !player.audioElement.paused && player.audioElement.currentTime > 0.2
      && document.querySelector('.suite-music-title').textContent === `Now playing: ${expected}`;
  }, title, { timeout: 5000 });
  const before = await page.evaluate(() => globalThis.__chessMusicReview.audioElement.currentTime);
  await page.waitForFunction(time => globalThis.__chessMusicReview.audioElement.currentTime > time + 0.1, before, { timeout: 5000 });
}
async function musicPaused(page) {
  await page.waitForFunction(() => globalThis.__chessMusicReview.audioElement.paused
    && !document.querySelector('.suite-music-title').textContent.startsWith('Now playing:'));
}

describe('native chess interface', () => {
  it('starts real decoded music from native Play and preserves separate sound/music preferences through Continue', async () => {
    const page = await pageAt();
    try {
      expect(await musicState(page)).toEqual({ armed: false, paused: true, time: 0 });
      await start(page);
      await musicPlaying(page);
      await page.getByRole('button', { name: 'Next song', exact: true }).click();
      await musicPlaying(page, 'Andrea');
      await page.locator('#mute').click();
      expect(await page.evaluate(() => globalThis.Suite.isMuted())).toBe(true);
      expect(await page.evaluate(() => globalThis.Suite.isMusicEnabled())).toBe(true);
      await musicPlaying(page, 'Andrea');
      await page.locator('#suite-music-toggle').click();
      await musicPaused(page);
      await move(page, 'e2e4'); await moves(page, 1);
      await page.reload();
      await musicState(page);
      expect(await page.evaluate(() => globalThis.Suite.isMuted())).toBe(true);
      expect(await page.evaluate(() => globalThis.Suite.isMusicEnabled())).toBe(false);
      await page.locator('#continue').click(); await moves(page, 1);
      await musicPaused(page);
      await page.locator('#suite-music-toggle').click();
      await musicPlaying(page, 'Andrea');
      expect(await page.evaluate(() => globalThis.Suite.isMuted())).toBe(true);
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  }, 15000);
  it('resynchronizes real music around native help, draw, setup, result and simulated visibility gates', async () => {
    const page = await pageAt();
    try {
      await musicState(page); await start(page); await musicPlaying(page);
      await page.locator('#game-options > summary').click(); await page.locator('#help').click();
      await musicPaused(page);
      await page.getByRole('button', { name: 'Close how to play' }).click(); await musicPlaying(page);
      await page.locator('#claim').click(); await musicPaused(page);
      await page.locator('#draw-cancel').click(); await musicPlaying(page);
      await page.locator('#new').click(); await musicPaused(page);
      await page.locator('#new-game button[type=submit]').click(); await musicPlaying(page);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new globalThis.Event('visibilitychange'));
      });
      await musicPaused(page);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        document.dispatchEvent(new globalThis.Event('visibilitychange'));
      });
      await musicPaused(page);
      await page.locator('#resume-playing').click(); await musicPlaying(page);
      for (const lan of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) { await move(page, lan); }
      await moves(page, 4);
      expect(await page.locator('#status').textContent()).toBe('Checkmate');
      await musicPaused(page);
      await page.locator('#rematch').click(); await musicPlaying(page);
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  }, 15000);
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
      await page.waitForFunction(() => document.getElementById('status').textContent.includes('2 legal destinations marked.'));
      expect(await page.locator('#status').textContent()).toContain('2 legal destinations marked.');
      await page.locator('[data-square=a8]').click();
      await page.waitForFunction(() => document.getElementById('promotion').open);
      expect(await page.locator('#promotion').evaluate(el => el.open)).toBe(true);
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
      expect(await page.locator('.game-card').count()).toBe(9);
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
  it.each([null, 'application/octet-stream'])('plays two real computer replies and reuses one binary when HTTP WASM metadata is %s', async contentType => {
    const page = await pageAt(), downloads = [], responses = [];
    page.on('request', request => { if (request.url().endsWith('stockfish-19-lite-single.wasm')) { downloads.push(request.url()); } });
    page.on('response', response => { if (response.url().endsWith('stockfish-19-lite-single.wasm')) { responses.push(response); } });
    try {
      // Serve an actually absent header for null, rather than substituting an
      // empty fulfilled response. Native WebAssembly compilation still runs.
      wasmContentType = contentType;
      await start(page, 'computer'); await move(page, 'e2e4'); await moves(page, 2);
      const worker = page.workers()[0];
      await move(page, 'g1f3'); await moves(page, 4);
      expect(downloads).toHaveLength(1); expect(responses).toHaveLength(1);
      expect(responses[0].headers()['content-type']).toBe(contentType ?? undefined);
      expect(page.workers()).toHaveLength(1); expect(page.workers()[0]).toBe(worker);
      expect(await page.locator('#engine-recovery').isVisible()).toBe(false);
      expect(page.chessErrors).toEqual([]);
    } finally { wasmContentType = 'application/wasm'; await page.close(); }
  });
  it('recovers deliberately from a blocked engine without silently changing modes', async () => {
    const page = await pageAt();
    try {
      await page.route('**/stockfish-loader.js', route => route.abort());
      await start(page, 'computer', 'b');
      await page.locator('#engine-recovery').waitFor({ state: 'visible' });
      expect(await page.locator('#game-label').textContent()).toContain('COMPUTER');
      await page.unroute('**/stockfish-loader.js');
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
            background: globalThis.getComputedStyle(document.body).getPropertyValue(coord.parentElement.classList.contains('dark') ? '--board-dark' : '--board-light').trim(),
            dots: [...document.querySelectorAll('cg-board square.move-dest')].map(square => ({
              foreground: globalThis.getComputedStyle(square, '::after').backgroundColor,
              background: globalThis.getComputedStyle(document.body).getPropertyValue(
                (square.cgKey.charCodeAt(0) + Number(square.cgKey[1])) % 2 ? '--board-light' : '--board-dark').trim()
            }))
          };
        });
        expect(contrastRatio(hex(colors.text), colors.background)).toBeGreaterThanOrEqual(4.5);
        expect(colors.dots.length).toBeGreaterThan(0);
        for (const dot of colors.dots) { expect(contrastRatio(hex(dot.foreground), dot.background)).toBeGreaterThanOrEqual(3); }
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
      for (const type of ['q', 'r', 'b', 'n']) {
        expect(await page.locator(`[data-promote=${type}] svg`).getAttribute('data-color')).toBe('b');
        expect(await page.locator(`[data-promote=${type}] svg image`).getAttribute('href')).toContain(`spatial-b${type}.svg`);
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
      await page.locator('.chess-hub').click(); await page.waitForFunction(() => document.body?.dataset.arcadeGame === 'hub');
      await page.goBack(); await page.waitForFunction(() => globalThis.SuiteLoading?.state === 'ready');
      if (await page.locator('#continue').isVisible()) { await page.locator('#continue').click(); }
      if (await page.locator('#resume-playing').isVisible()) { await page.locator('#resume-playing').click(); }
      await moves(page, 1); expect(await page.evaluate(() => globalThis.Suite.isMuted())).toBe(true);
      await move(page, 'e7e5'); await moves(page, 2); expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it.each([{ width: 634, height: 567 }, { width: 740, height: 600 }, { width: 600, height: 540 }])('fits the complete board at narrow zoom-sized $width × $height without losing play or focus', async viewport => {
    const page = await pageAt();
    try {
      await start(page);
      await move(page, 'e2e4'); await moves(page, 1);
      const saved = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
      await page.locator('[data-square=g1]').focus();
      await page.setViewportSize(viewport);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => new Promise(done => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(done))));
      const layout = await page.evaluate(() => ({
        board: document.getElementById('board').getBoundingClientRect().toJSON(),
        bottom: document.getElementById('bottom-player').parentElement.getBoundingClientRect().bottom,
        focus: document.activeElement?.dataset.square,
        scrollWidth: document.documentElement.scrollWidth
      }));
      expect(layout.board.width).toBeGreaterThanOrEqual(216);
      expect(layout.board.width).toBeCloseTo(layout.board.height, 0);
      expect(layout.board.y).toBeGreaterThanOrEqual(0);
      expect(layout.bottom).toBeLessThanOrEqual(viewport.height);
      expect(layout.scrollWidth).toBeLessThanOrEqual(viewport.width);
      expect(layout.focus).toBe('g1');
      expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(saved);
      await move(page, 'e7e5'); await moves(page, 2);
      await drag(page, 'g1', 'f3'); await moves(page, 3);
      await artAt(page, 'f3', 'knight', 'white');
      expect(page.chessErrors).toEqual([]);
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
  it.each(['pieces/spatial-wn.svg', 'chess-board.css', 'chessground.js'])('keeps saved play safe and offers deliberate recovery if %s fails', async asset => {
    const page = await pageAt();
    try {
      await start(page); await move(page, 'e2e4'); await moves(page, 1); await page.locator('#mute').click();
      const saved = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY);
      await page.context().route(`**/assets/chess/${asset}`, route => route.abort()); await page.reload();
      await page.locator('#suite-load-state').waitFor({ state: 'visible' });
      expect(await page.locator('#new-game button[type=submit]').isDisabled()).toBe(true);
      expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(saved);
      await page.context().unroute(`**/assets/chess/${asset}`); await page.getByRole('button', { name: 'Try again', exact: true }).click();
      await page.waitForFunction(() => globalThis.SuiteLoading?.state === 'ready'); await page.locator('#continue').click();
      await moves(page, 1); expect(await page.evaluate(() => globalThis.Suite.isMuted())).toBe(true);
      await move(page, 'e7e5'); await moves(page, 2);
    } finally { await page.close(); }
  });
  it('accepts the next move immediately after help closes during a game', async () => {
    const page = await pageAt({ width: 320, height: 568 });
    try {
      await start(page); await move(page, 'e2e4'); await page.locator('#game-options > summary').click(); await page.locator('#help').click();
      await page.locator('#piece-guide > summary').click(); await page.getByRole('button', { name: 'Close how to play' }).click();
      await move(page, 'e7e5'); await moves(page, 2); expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it('uses the real renderer for native legal, illegal and outside drags', async () => {
    const page = await pageAt();
    try {
      await start(page); expect(await page.locator('#board').getAttribute('data-renderer')).toBe('chessground');
      await drag(page, 'e2', 'e4'); await moves(page, 1); await artAt(page, 'e4', 'pawn', 'white');
      await drag(page, 'e7', 'e3'); await page.waitForFunction(() => document.getElementById('status').textContent.includes('cancelled'));
      await moves(page, 1); await artAt(page, 'e7', 'pawn', 'black');
      await drag(page, 'b8', { x: 0, y: 0 }); await artAt(page, 'b8', 'knight', 'black'); await moves(page, 1);
      await drag(page, 'e7', 'e5'); await moves(page, 2); await artAt(page, 'e5', 'pawn', 'black');
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it('plays native castling for both colors and moves both pieces', async () => {
    const page = await pageAt();
    try {
      await start(page);
      for (const lan of ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6']) { await move(page, lan); }
      await drag(page, 'e1', 'g1'); await moves(page, 7); await artAt(page, 'g1', 'king', 'white'); await artAt(page, 'f1', 'rook', 'white');
      await move(page, 'f8c5'); await move(page, 'a2a3'); await drag(page, 'e8', 'g8'); await moves(page, 10);
      await artAt(page, 'g8', 'king', 'black'); await artAt(page, 'f8', 'rook', 'black'); expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it('removes the correct pawn during native en passant and restores it on undo', async () => {
    const page = await pageAt();
    try {
      await start(page); for (const lan of ['e2e4', 'a7a6', 'e4e5', 'd7d5']) { await move(page, lan); }
      await drag(page, 'e5', 'd6'); await moves(page, 5); await artAt(page, 'd6', 'pawn', 'white');
      expect(await page.locator('[data-square=d5]').getAttribute('aria-label')).toContain('empty');
      expect(await page.locator('#bottom-captured').innerText()).toContain('pawn');
      await page.locator('#undo').click(); await moves(page, 4); await artAt(page, 'd5', 'pawn', 'black'); await artAt(page, 'e5', 'pawn', 'white');
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it('restores a dragged promotion until a choice is made and supports cancellation (legal fixture)', async () => {
    const page = await pageAt(); const game = createGame({ mode: 'local' });
    for (const lan of ['a2a4', 'h7h5', 'a4a5', 'h5h4', 'a5a6', 'h4h3', 'a6b7', 'h3g2']) { playMove(game, lan); }
    try {
      await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: SAVE_KEY, value: JSON.stringify(snapshot(game)) });
      await page.reload(); await page.locator('#continue').click(); await drag(page, 'b7', 'a8');
      await page.waitForFunction(() => document.getElementById('promotion').open); await moves(page, 8); await artAt(page, 'b7', 'pawn', 'white');
      await page.locator('#cancel-promotion').click(); await artAt(page, 'a8', 'rook', 'black');
      await drag(page, 'b7', 'a8'); await page.locator('[data-promote=n]').click(); await moves(page, 9); await artAt(page, 'a8', 'knight', 'white');
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it('cancels an active drag with Escape and does not commit its later mouseup', async () => {
    const page = await pageAt();
    try {
      await start(page); const a = await page.locator('[data-square=e2]').boundingBox(), b = await page.locator('[data-square=e4]').boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
      await page.keyboard.press('Escape'); await page.mouse.up(); await page.evaluate(() => new Promise(globalThis.requestAnimationFrame));
      await moves(page, 0); await artAt(page, 'e2', 'pawn', 'white');
      await drag(page, 'e2', 'e4'); await moves(page, 1); expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it('retains every move under rapid native clicks without duplicate callbacks', async () => {
    const page = await pageAt();
    try {
      await start(page);
      for (const square of ['e2', 'e4', 'e7', 'e5', 'g1', 'f3', 'b8', 'c6']) {
        const b = await page.locator(`[data-square=${square}]`).boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      }
      await moves(page, 4); expect(await page.locator('#moves').innerText()).toContain('Nc6');
      await artAt(page, 'c6', 'knight', 'black'); expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });
  it('plays a trusted browser touch drag and cancels an interrupted touch', async () => {
    const page = await pageAt({ width: 390, height: 844 }, true);
    try {
      await start(page); const session = await page.context().newCDPSession(page);
      const points = async (from, to, cancel = false) => {
        const a = await page.locator(`[data-square=${from}]`).boundingBox(), b = await page.locator(`[data-square=${to}]`).boundingBox();
        const x = a.x + a.width / 2, y = a.y + a.height / 2;
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 8; i++) { await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (b.x + b.width / 2 - x) * i / 8, y: y + (b.y + b.height / 2 - y) * i / 8 }] }); }
        await page.evaluate(() => new Promise(done => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(done))));
        await session.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
      };
      await points('e2', 'e4'); await moves(page, 1); await artAt(page, 'e4', 'pawn', 'white');
      await points('e7', 'e5', true); await page.evaluate(() => new Promise(globalThis.requestAnimationFrame)); await moves(page, 1); await artAt(page, 'e7', 'pawn', 'black');
      await points('e7', 'e5'); await moves(page, 2); expect(page.chessErrors).toEqual([]);
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

describe('personal chess progress', () => {
  it('chooses a hub goal, completes a native phone mate, downloads its real result image and retains one result after reload/replay', async () => {
    const page = await pageAt({ width: 390, height: 844 }, true);
    try {
      await page.goto(base + '/');
      await page.locator('.suite-progress-open').click();
      await page.locator('#progress-goal-chess-finish').click();
      await page.locator('.suite-progress-close').click();
      await page.locator('a.game-card[href="chess.html"]').click();
      await page.waitForFunction(() => globalThis.SuiteLoading?.state === 'ready');
      await start(page, 'local');
      for (const lan of ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6', 'h5f7']) { await move(page, lan, true); }
      await page.locator('#result').waitFor({ state: 'visible' });
      expect(await page.locator('#progress-result').innerText()).toContain('Final move');
      const first = await page.evaluate(() => globalThis.SuiteProgress.snapshot());
      expect(first.history.chess).toHaveLength(1);
      expect(first.history.chess[0]).toMatchObject({ mode: 'local', local: true, assisted: false, moves: 7, outcome: 'complete' });
      expect(first.earned['chess-finish'].source).toBe('event');
      await progressCapture(page, 'chess-phone-native-result');
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('link', { name: 'Save image', exact: true }).click();
      const download = await downloadPromise;
      const image = await readFile(await download.path());
      expect([...image.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      await page.reload();
      await page.locator('#continue').click();
      await page.locator('#flip').click();
      expect(await page.evaluate(() => globalThis.SuiteProgress.snapshot().history.chess.length)).toBe(1);
      await page.locator('#rematch').click();
      await move(page, 'e2e4', true);
      expect(await page.locator('#result').isHidden()).toBe(true);
      expect(await page.locator('.suite-result-share').isHidden()).toBe(true);
      await page.locator('.chess-hub').click();
      await page.locator('.suite-progress-open').click();
      await page.getByRole('button', { name: 'Recent results', exact: true }).click();
      const historyText = await page.locator('.suite-progress-view').innerText();
      expect(historyText).toContain('Local two-player');
      expect(historyText).toContain('White wins');
      expect(historyText).toContain('7 half-moves');
      await progressCapture(page, 'chess-phone-native-history');
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  }, 30000);

  it('records native computer practice with assistance labels and retains its chosen level for replay', async () => {
    const page = await pageAt();
    try {
      await start(page, 'computer');
      await move(page, 'e2e4');
      await page.waitForFunction(() => document.querySelectorAll('#moves button').length >= 2);
      await page.locator('#hint').click();
      await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Try '));
      await page.locator('#game-options > summary').click();
      await page.locator('#resign').click(); await page.locator('#confirm-yes').click();
      const state = await page.evaluate(() => globalThis.SuiteProgress.snapshot());
      expect(state.history.chess).toHaveLength(1);
      expect(state.history.chess[0]).toMatchObject({ mode: 'computer', difficulty: 'friendly', local: false, assisted: true, hints: 1, outcome: 'loss' });
      await progressCapture(page, 'chess-computer-assisted-result');
      await page.locator('#rematch').click();
      await page.waitForFunction(() => document.querySelector('#game-label').textContent.includes('Friendly'));
      expect(await page.evaluate(() => globalThis.SuiteProgress.snapshot().history.chess.length)).toBe(1);
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  }, 30000);

  it('reviews a valid legacy completed-game fixture without manufacturing history or goals', async () => {
    const page = await pageAt({ width: 320, height: 667 });
    const game = createGame({ mode: 'local' });
    for (const lan of ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6', 'h5f7']) { playMove(game, lan); }
    try {
      await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: SAVE_KEY, value: JSON.stringify(snapshot(game)) });
      await page.reload(); await page.locator('#continue').click();
      expect(await page.locator('#result').isVisible()).toBe(true);
      expect(await page.locator('.suite-result-share').isVisible()).toBe(true);
      const state = await page.evaluate(() => globalThis.SuiteProgress.snapshot());
      expect(state.history.chess || []).toHaveLength(0);
      expect(state.earned['chess-finish']).toBeUndefined();
      expect(page.chessErrors).toEqual([]);
    } finally { await page.close(); }
  });

  it('keeps denied-storage play and sharing usable, and only reads allowlisted setup links', async () => {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' });
    await page.addInitScript(() => Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('Storage denied by test fixture'); } }));
    try {
      await page.goto(base + '/chess.html?mode=local&level=sharp&fen=untrusted&save=untrusted');
      await page.waitForFunction(() => globalThis.SuiteLoading?.state === 'ready');
      expect(await page.locator('input[name=mode][value=local]').isChecked()).toBe(true);
      await page.locator('#new-game button[type=submit]').click();
      await move(page, 'e2e4');
      await page.locator('#game-options > summary').click();
      await page.locator('#resign').click(); await page.locator('#confirm-yes').click();
      expect(await page.locator('#progress-result').innerText()).toContain('cannot be saved');
      expect(await page.locator('.suite-result-share').isVisible()).toBe(true);
      await progressCapture(page, 'chess-landscape-denied-storage');
      await page.locator('#rematch').click();
      expect(await page.locator('#result').isHidden()).toBe(true);
    } finally { await page.close(); }
  }, 30000);
});
