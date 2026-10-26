// @vitest-environment node
// Real pages and SDK. Explicit terminal/board fixtures do not claim natural wins.
/* global level:writable, score:writable, linesCleared:writable, tetromino:writable, runStats, showGameOver, runMode, playfield, rows */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const available = existsSync(chromium.executablePath());
let server, browser, origin;
beforeAll(async () => {
  if (!available) { return; }
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.m4a': 'audio/mp4' };
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname.replace(/^\/StalemateSite\/play\//, '/');
    const file = resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root.replace(/\/$/, '') + sep)) { response.writeHead(403).end(); return; }
    try { response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(await readFile(file)); }
    catch { response.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  if (server) { await new Promise(done => server.close(done)); }
});
async function open(path, width = 390, denied = false) {
  const page = await browser.newPage({ viewport: { width, height: width <= 390 ? (width === 320 ? 568 : 844) : 900 }, isMobile: width <= 390, hasTouch: width <= 390 });
  page.progressErrors = [];
  page.on('pageerror', error => page.progressErrors.push(error.message));
  if (denied) {
    await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new window.DOMException('Denied', 'SecurityError'); } }));
  }
  await page.goto(origin + path);
  await page.waitForFunction(() => !!window.SuiteProgress && !!window.SuiteShare);
  return page;
}
const snapshot = page => page.evaluate(() => window.SuiteProgress.snapshot());
async function startTT(page, mode) {
  await page.waitForFunction(() => !document.getElementById('attractPlay').disabled);
  await page.locator('#attractModeSetting').selectOption(mode);
  await page.locator('#attractPlay').click();
}
async function maniaFixture(page, rows) {
  await page.evaluate(rows => {
    const { state, Core } = window.__turdomania;
    // A late-game pile can be tiny; the game's original board dimensions stay fixed.
    state.board = Core.boardFromRows(rows);
    window.dispatchEvent(new window.Event('resize'));
  }, rows);
  await page.waitForFunction(n => document.querySelectorAll('#board .tile').length === n, rows.flat().filter(value => value !== null).length);
}
async function firstMove(page) {
  return page.evaluate(() => {
    const { state, Core } = window.__turdomania;
    for (let c = 0; c < state.board.length; c++) {
      for (let r = 0; r < state.board[c].length; r++) {
        if (Core.findGroup(state.board, c, r).length >= 2) { return [c, r]; }
      }
    }
    return null;
  });
}
async function pop(page, move) {
  await page.locator(`.tile[data-col="${move[0]}"][data-row="${move[1]}"]`).tap();
}

describe.skipIf(!available)('action progress with real native pages and SDK', () => {
  it('Turdanoid records a qualified Classic fixture once, shares it, then replays with a new ID', async () => {
    const page = await open('/TurdAnoid.html');
    try {
      await page.locator('#btnStart').click();
      const staged = await page.evaluate(() => { level = 2; runStats.maxCombo = 5; score = 1234; window.__turdanoid.gameOver(false); return { level, score }; });
      expect(staged).toEqual({ level: 2, score: 1234 });
      let state = await snapshot(page);
      expect(state.history.turdanoid).toHaveLength(1);
      expect(state.history.turdanoid[0]).toMatchObject({ mode: 'classic', outcome: 'loss', score: 1234, levelsCleared: 1, maxCombo: 5 });
      expect(Object.keys(state.earned).sort()).toEqual(['ta-combo', 'ta-stage']);
      await expect.poll(() => page.locator('#progressResult').innerText()).toContain('Wall breaker');
      expect(await page.locator('#progressResult').innerText()).toContain('Five in a row');
      const id = state.history.turdanoid[0].id;
      await page.evaluate(() => window.__turdanoid.gameOver(false));
      expect((await snapshot(page)).history.turdanoid).toHaveLength(1);
      await page.getByRole('button', { name: 'Share score', exact: true }).click();
      await expect.poll(() => page.locator('.suite-result-share-status').innerText()).toMatch(/copied|Select and copy/);
      await page.locator('#btnRestart').click();
      expect(await page.evaluate(() => window.__turdanoid.gameMode)).toBe('classic');
      expect(await page.locator('#progressResult').isVisible()).toBe(false);
      await page.evaluate(() => { score = 2000; window.__turdanoid.gameOver(false); });
      state = await snapshot(page);
      expect(state.history.turdanoid).toHaveLength(2);
      expect(state.history.turdanoid[1].id).not.toBe(id);
      expect(state.history.turdanoid[1].improvement).toContain('766 points above');
      await expect.poll(() => page.locator('#progressResult').innerText()).toContain('766 points above');
      expect(page.progressErrors).toEqual([]);
    } finally { await page.close(); }
  });

  it('Turdanoid Boss replay links retain user choice and reload never invents a finish at320px', async () => {
    const page = await open('/TurdAnoid.html?mode=boss', 320);
    try {
      expect(await page.locator('#btnStart').innerText()).toBe('BOSS FLUSH');
      expect(await page.locator('#btnBoss').innerText()).toBe('CLASSIC FLUSH');
      expect(await page.evaluate(() => window.__turdanoid.state)).toBe('title');
      await page.locator('#btnStart').click();
      await page.evaluate(() => window.__turdanoid.gameOver(false));
      const before = await snapshot(page);
      expect(before.history.turdanoid[0]).toMatchObject({ mode: 'boss', outcome: 'loss', levelsCleared: 0 });
      const link = await page.evaluate(() => window.SuiteShare.describe('turdanoid', window.SuiteProgress.snapshot().history.turdanoid[0], window.location.href).url);
      expect(link).toBe(origin + '/TurdAnoid.html?mode=boss');
      await page.locator('#btnRestart').click();
      expect(await page.evaluate(() => window.__turdanoid.gameMode)).toBe('boss');
      await page.reload();
      expect((await snapshot(page)).history.turdanoid).toEqual(before.history.turdanoid);
      expect(await page.locator('#btnStart').innerText()).toBe('BOSS FLUSH');
      expect(page.progressErrors).toEqual([]);
    } finally { await page.close(); }
  });

  it('Turdanoid320 result scrolls with actual touch so goal feedback and Share remain reachable', async () => {
    const page = await open('/TurdAnoid.html', 320);
    try {
      await page.locator('#btnStart').click();
      await page.evaluate(() => { level = 2; runStats.maxCombo = 5; window.__turdanoid.gameOver(false); });
      const panel = page.locator('#endScreen');
      await panel.waitFor({ state: 'visible' });
      await page.waitForTimeout(950);
      expect(await panel.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
      const client = await page.context().newCDPSession(page);
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y: 430 }] });
      for (const y of [390, 350, 310, 270, 230]) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 300, y }] });
        await page.waitForTimeout(20);
      }
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await client.detach();
      await expect.poll(() => panel.evaluate(el => el.scrollTop)).toBeGreaterThan(20);
      const share = page.getByRole('button', { name: 'Share score', exact: true });
      const point = await share.boundingBox();
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y + point.height).toBeLessThanOrEqual(518);
      await share.tap();
      await expect.poll(() => page.locator('.suite-result-share-status').innerText()).toMatch(/copied|Select and copy/);
      expect((await snapshot(page)).history.turdanoid).toHaveLength(1);
      expect(page.progressErrors).toEqual([]);
    } finally { await page.close(); }
  });

  it('Turdtris Classic records10 lines and a fractional clock without altering gameplay timing', async () => {
    const page = await open('/turdtris.html');
    try {
      expect((await snapshot(page)).history.turdtris).toBeUndefined();
      await startTT(page, 'classic');
      const staged = await page.evaluate(() => { linesCleared = 10; score = 800; runStats.elapsedMs = 8765.875; showGameOver(false); return { lines: linesCleared, score }; });
      expect(staged).toEqual({ lines: 10, score: 800 });
      const state = await snapshot(page);
      expect(state.history.turdtris).toHaveLength(1);
      expect(state.history.turdtris[0]).toMatchObject({ mode: 'classic', lines: 10, score: 800, elapsedMs: 8765, completed: false });
      expect(state.earned['tt-lines']).toBeTruthy();
      expect(await page.evaluate(() => runStats.elapsedMs)).toBe(8765.875);
      expect(await page.locator('#progressResult').innerText()).toContain('Line maker');
      await page.evaluate(() => showGameOver(false));
      expect((await snapshot(page)).history.turdtris).toHaveLength(1);
      await page.getByRole('button', { name: 'Play Again', exact: true }).click();
      expect(await page.evaluate(() => runMode)).toBe('classic');
      expect(page.progressErrors).toEqual([]);
    } finally { await page.close(); }
  });

  it('Turdtris native hard-drop finishes a legal39→40line Sprint fixture and retains its replay mode', async () => {
    const page = await open('/turdtris.html?mode=sprint', 1280);
    try {
      await startTT(page, 'sprint');
      const piece = await page.evaluate(() => {
        for (const row of playfield) { row.fill(0); }
        playfield[rows - 1].fill('G'); playfield[rows - 8][0] = 'G';
        for (let col = 3; col <= 6; col++) { playfield[rows - 1][col] = 0; }
        tetromino = { name: 'I', matrix: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], row: rows - 2, col: 3, rotation: 0, lastActionRotate: false, lastKick: false };
        linesCleared = 39; runStats.elapsedMs = 61000;
        return tetromino.name;
      });
      expect(piece).toBe('I');
      await page.keyboard.press('Space');
      await page.locator('#gameOverOverlay').waitFor({ state: 'visible' });
      const state = await snapshot(page);
      expect(state.history.turdtris).toHaveLength(1);
      expect(state.history.turdtris[0]).toMatchObject({ mode: 'sprint', lines: 40, outcome: 'complete', completed: true });
      expect(state.earned['tt-sprint']).toBeTruthy();
      expect(await page.locator('#progressResult').innerText()).toContain('Sprint finisher');
      await page.getByRole('button', { name: 'Play Again', exact: true }).click();
      expect(await page.evaluate(() => runMode)).toBe('sprint');
      expect(page.progressErrors).toEqual([]);
    } finally { await page.close(); }
  });

  it('Turdomania natural seeded finish/resize/Undo/re-finish keep one history entry, Again/reload do not add results', async () => {
    const page = await open('/StalemateSite/play/turdomania.html?level=easy&seed=42&reducedMotion=1');
    try {
      await page.waitForFunction(() => !!window.__turdomania);
      let last;
      for (let moves = 0; moves < 50 && !await page.evaluate(() => window.__turdomania.state.over); moves++) {
        last = await firstMove(page); expect(last).not.toBeNull(); await pop(page, last);
      }
      expect(await page.evaluate(() => window.__turdomania.state.over)).toBe(true);
      const before = await snapshot(page);
      expect(before.history.turdomania).toHaveLength(1);
      expect(before.history.turdomania[0].mode).toBe('easy');
      expect(before.history.turdomania[0]).toMatchObject({ cols: 8, rows: 10 });
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(100);
      expect((await snapshot(page)).history.turdomania).toHaveLength(1);
      await page.locator('#overUndoBtn').click();
      expect(await page.locator('.suite-result-share').isVisible()).toBe(false);
      await pop(page, last);
      const after = await snapshot(page);
      expect(after.history.turdomania).toHaveLength(1);
      expect(after.history.turdomania[0].id).toBe(before.history.turdomania[0].id);
      await page.locator('#againBtn').click();
      expect(await page.evaluate(() => window.__turdomania.state.level)).toBe('easy');
      await page.reload();
      await page.waitForFunction(() => !!window.__turdomania);
      expect((await snapshot(page)).history.turdomania).toHaveLength(1);
      expect(page.progressErrors).toEqual([]);
    } finally { await page.close(); }
  }, 30000);

  it('Turdomania actual Undo upgrades the same loss fixture to a clear and earns its badge once', async () => {
    const page = await open('/turdomania.html?level=hard&reducedMotion=1', 320);
    try {
      await page.waitForFunction(() => !!window.__turdomania);
      await maniaFixture(page, [[1, 2], [0, 0]]); await pop(page, [0, 0]);
      const first = await snapshot(page);
      expect(first.history.turdomania).toHaveLength(1);
      expect(first.history.turdomania[0].cleared).toBe(false);
      await page.locator('#overUndoBtn').click();
      await maniaFixture(page, [[0, 0], [0, 0]]); await pop(page, [0, 0]);
      const after = await snapshot(page);
      expect(after.history.turdomania).toHaveLength(1);
      expect(after.history.turdomania[0]).toMatchObject({ id: first.history.turdomania[0].id, mode: 'hard', cleared: true, score: 1004 });
      expect(after.earned['mania-clear']).toBeTruthy();
      const feedback = await page.locator('#progressResult').evaluate(el => ({ text: el.textContent, hidden: el.hidden, display: window.getComputedStyle(el).display, over: window.__turdomania.state.over, moves: window.__turdomania.state.moves }));
      expect(await page.locator('#progressResult').innerText(), JSON.stringify(feedback)).toContain('Clean sweep');
      expect(page.progressErrors).toEqual([]);
    } finally { await page.close(); }
  });

  it('denied device storage preserves completed results and native replay in all3 games for this visit', async () => {
    for (const game of ['TurdAnoid', 'turdtris', 'turdomania']) {
      const page = await open('/' + game + '.html?reducedMotion=1', 390, true);
      try {
        if (game === 'TurdAnoid') { await page.locator('#btnStart').click(); await page.evaluate(() => window.__turdanoid.gameOver(false)); }
        else if (game === 'turdtris') { await startTT(page, 'ultra'); await page.evaluate(() => showGameOver(false)); }
        else { await page.waitForFunction(() => !!window.__turdomania); await maniaFixture(page, [[0, 0]]); await pop(page, [0, 0]); }
        expect((await snapshot(page)).history[game.toLowerCase()]).toHaveLength(1);
        const feedback = await page.locator('#progressResult').evaluate(el => ({ text: el.textContent, hidden: el.hidden, display: window.getComputedStyle(el).display }));
        await expect.poll(() => page.locator('#progressResult').innerText(), { message: game + JSON.stringify(feedback) }).toContain('could not save progress');
        if (game === 'TurdAnoid') { await page.locator('#btnRestart').click(); }
        else if (game === 'turdtris') { await page.getByRole('button', { name: 'Play Again', exact: true }).click(); }
        else { await page.locator('#againBtn').click(); }
        expect(await page.locator('#progressResult').isVisible()).toBe(false);
        expect(page.progressErrors).toEqual([]);
      } finally { await page.close(); }
    }
  }, 30000);

  it('TA/TT paused difficulty changes remain mixed after changing back; a new run compares only matching fixed difficulty', async () => {
    for (const game of ['TurdAnoid', 'turdtris']) {
      const page = await open('/' + game + '.html', 1280);
      const key = game.toLowerCase();
      const finish = value => page.evaluate(({ game, value }) => {
        score = value;
        if (game === 'TurdAnoid') { window.__turdanoid.gameOver(false); } else { showGameOver(false); }
      }, { game, value });
      const replay = () => game === 'TurdAnoid' ? page.locator('#btnRestart').click() : page.getByRole('button', { name: 'Play Again', exact: true }).click();
      try {
        if (game === 'TurdAnoid') { await page.locator('#btnStart').click(); } else { await startTT(page, 'classic'); }
        await page.evaluate(() => window.Suite.difficulty.set('normal'));
        await finish(1000);
        expect((await snapshot(page)).history[key][0].difficulty).toBe('normal');
        await replay();
        if (game === 'TurdAnoid') { await page.locator('#btnPause').click(); }
        else { await page.getByRole('button', { name: /Pause \/ Resume/ }).click(); }
        // The real Suite setting API controls tuning; its notifications must persist mixed metadata.
        await page.evaluate(() => { window.Suite.difficulty.set('easy'); window.Suite.difficulty.set('normal'); });
        await finish(2000);
        const mixed = (await snapshot(page)).history[key][1];
        expect(mixed.difficulty).toBe('mixed');
        expect(mixed.improvement).toBeUndefined();
        await replay(); await finish(3000);
        const fixed = (await snapshot(page)).history[key][2];
        expect(fixed.difficulty).toBe('normal');
        expect(fixed.improvement).toContain('2,000 points above');
        expect(page.progressErrors).toEqual([]);
      } finally { await page.close(); }
    }
  }, 30000);
});
