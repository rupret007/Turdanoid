/** Actual page adapters; deterministic terminal fixtures are not natural wins. */
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as modes from '../games/turdtris-modes.js';
import * as presentation from '../games/turdtris-presentation.js';
import * as Core from '../games/turdomania-core.js';

const windows = [];
const shares = [];
const progressCore = readFileSync('games/suite-progress-core.js', 'utf8');
function context() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(target, name) {
      if (name === 'createLinearGradient' || name === 'createRadialGradient') { return () => gradient; }
      return target[name] ?? (() => {});
    },
    set(target, name, value) { target[name] = value; return true; }
  });
}
function boot(game, search = '', recordResult = {}) {
  let sequence = 0;
  let difficulty = 'hard';
  const difficultyListeners = [];
  const record = vi.fn(() => ({ recorded: true, storageAvailable: true, newlyEarned: [], ...recordResult }));
  const newRunId = vi.fn(name => `p1.fixture-progress.${name}.${++sequence}`);
  let html = readFileSync(game + '.html', 'utf8');
  if (game === 'turdomania') {
    html = html.replace("import * as Core from './games/turdomania-core.js';", '')
      .replace('<script type="module" data-game-required>', '<script>');
  } else {
    html = html.replace(/<script type="module"[^>]*>[\s\S]*?<\/script>\s*/g, '');
  }
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: `http://localhost/${game}.html${search}`,
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = context;
      w.requestAnimationFrame = () => 1;
      w.cancelAnimationFrame = () => {};
      w.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
      w.Core = Core;
      w.eval(progressCore);
      w.TurdtrisModes = modes;
      w.TurdtrisPresentation = presentation;
      w.SuiteProgress = { newRunId, record };
      w.Suite = { difficulty: {
        get: () => difficulty,
        set(value) { difficulty = value; difficultyListeners.forEach(listener => listener(value)); },
        onChange(listener) { difficultyListeners.push(listener); }
      } };
      w.SuiteShare = { create: () => {
        const share = { setResult: vi.fn() }; shares.push(share); return share;
      } };
    }
  });
  windows.push(dom.window);
  return { w: dom.window, record, newRunId, share: shares.at(-1) };
}
afterEach(() => { windows.splice(0).forEach(w => w.close()); shares.length = 0; });

function startTurdtris(w, mode) {
  w.document.getElementById('modeSetting').value = mode;
  w.startSelectedMode();
}
function puzzleFixture(w, rows) {
  // Install a tiny legal rules fixture; play/Undo/result handling stay real.
  w.__turdomania.state.board = Core.boardFromRows(rows);
  w.eval('render()');
}

describe('Turdanoid completed-run progress adapter', () => {
  it('does not record a title-screen result, and records a real started Classic loss once', () => {
    const { w, record, share } = boot('TurdAnoid');
    w.__turdanoid.gameOver(false);
    expect(record).not.toHaveBeenCalled();
    w.document.getElementById('btnStart').click();
    w.eval('score = 420; level = 2; runStats.maxCombo = 5;');
    w.__turdanoid.gameOver(false);
    const event = record.mock.calls[0][0];
    expect(event).toMatchObject({ game: 'turdanoid', kind: 'run', mode: 'classic', difficulty: 'hard', outcome: 'loss', score: 420, levelsCleared: 1, maxCombo: 5, completed: false });
    expect(event.id).toBeTruthy();
    expect(event.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(w.SuiteProgressCore.normalizeEvent(event, 123)).not.toBeNull();
    w.__turdanoid.gameOver(false);
    expect(record).toHaveBeenCalledTimes(1);
    expect(share.setResult).toHaveBeenLastCalledWith(event);
    w.document.getElementById('btnRestart').click();
    expect(w.__turdanoid.gameMode).toBe('classic');
    expect(record).toHaveBeenCalledTimes(1);
    w.__turdanoid.gameOver(false);
    expect(record.mock.calls[1][0].id).not.toBe(event.id);
  });

  it('keeps a shared Boss selection behind a native Start and retains an explicit Classic choice', () => {
    const { w, record } = boot('TurdAnoid', '?mode=boss');
    expect(w.__turdanoid.state).toBe('title');
    expect(w.document.getElementById('btnStart').textContent).toBe('BOSS FLUSH');
    expect(w.document.getElementById('btnBoss').textContent).toBe('Classic Flush');
    w.document.getElementById('btnStart').click();
    expect(w.__turdanoid.gameMode).toBe('boss');
    w.__turdanoid.gameOver(true);
    expect(record.mock.calls[0][0]).toMatchObject({ mode: 'boss', outcome: 'win', levelsCleared: 0, completed: true });
    w.document.getElementById('btnRestart').click();
    expect(w.__turdanoid.gameMode).toBe('boss');
    w.__turdanoid.quitToMenu();
    w.document.getElementById('btnBoss').click();
    expect(w.__turdanoid.gameMode).toBe('classic');
  });

  it('defaults an invalid shared mode to Classic and clamps a completed campaign to30 levels', () => {
    const { w, record } = boot('TurdAnoid', '?mode=invalid');
    w.document.getElementById('btnStart').click();
    w.__turdanoid.level = 31;
    w.__turdanoid.gameOver(true);
    expect(record.mock.calls[0][0]).toMatchObject({ mode: 'classic', outcome: 'win', levelsCleared: 30 });
  });

  it('keeps a completed share and replay usable if optional progress did not load', () => {
    const { w, record, share } = boot('TurdAnoid');
    w.SuiteProgress = undefined;
    w.document.getElementById('btnStart').click();
    w.__turdanoid.gameOver(false);
    expect(record).not.toHaveBeenCalled();
    expect(share.setResult.mock.lastCall[0]).toMatchObject({ mode: 'classic', outcome: 'loss', completed: false });
    w.document.getElementById('btnRestart').click();
    expect(w.__turdanoid.state).toBe('playing');
  });
});

describe('Turdtris completed-run progress adapter', () => {
  it('records neither boot/attract results nor abandoning a run', () => {
    const { w, record } = boot('turdtris');
    w.showGameOver(false);
    expect(record).not.toHaveBeenCalled();
    startTurdtris(w, 'classic');
    w.restartGame();
    expect(record).not.toHaveBeenCalled();
  });

  it.each([
    ['classic', false, 10, 24000, 'loss'],
    ['classic', true, 600, 1800000, 'win'],
    ['sprint', false, 12, 32000, 'loss'],
    ['sprint', true, 40, 61000, 'complete'],
    ['ultra', false, 5, 25000, 'loss'],
    ['ultra', true, 20, 120000, 'complete']
  ])('records %s terminal %s with actual mode/metrics, dedupes and replays that mode', (mode, won, lines, elapsed, outcome) => {
    const { w, record, share } = boot('turdtris');
    startTurdtris(w, mode);
    w.eval(`score=900; linesCleared=${lines}; runStats.elapsedMs=${elapsed}; runStats.maxCombo=3;`);
    w.showGameOver(won);
    expect(record).toHaveBeenCalledTimes(1);
    const event = record.mock.calls[0][0];
    expect(event).toMatchObject({ game: 'turdtris', kind: 'run', mode, difficulty: 'hard', outcome, score: 900, lines, elapsedMs: elapsed, completed: won, maxCombo: 3 });
    expect(w.SuiteProgressCore.normalizeEvent(event, 123)).not.toBeNull();
    w.showGameOver(won);
    expect(record).toHaveBeenCalledTimes(1);
    expect(share.setResult).toHaveBeenLastCalledWith(event);
    w.restartGame();
    expect(w.eval('runMode')).toBe(mode);
    expect(record).toHaveBeenCalledTimes(1);
    w.showGameOver(false);
    expect(record.mock.calls[1][0].id).not.toBe(event.id);
  });

  it('preserves a fractional active clock as an accepted integer progress duration', () => {
    const { w, record } = boot('turdtris');
    startTurdtris(w, 'ultra');
    w.eval('runStats.elapsedMs = 3210.875;');
    w.showGameOver(false);
    const event = record.mock.calls[0][0];
    expect(event.elapsedMs).toBe(3210);
    expect(w.SuiteProgressCore.normalizeEvent(event, 123)).not.toBeNull();
    expect(w.eval('runStats.elapsedMs')).toBe(3210.875);
  });
});

describe('Turdomania completed-board progress adapter', () => {
  it('keeps one attempt through redraw/Undo/re-finish and a fresh ID for Again with the same seed', () => {
    const { w, record } = boot('turdomania', '?level=easy&seed=42&reducedMotion=1');
    expect(record).not.toHaveBeenCalled();
    const dimensions = { cols: w.__turdomania.state.cols, rows: w.__turdomania.state.rows };
    puzzleFixture(w, [[1, 2], [0, 0]]);
    w.__turdomaniaPop(0, 0);
    expect(record).toHaveBeenCalledTimes(1);
    const first = record.mock.calls[0][0];
    expect(first).toMatchObject({ game: 'turdomania', mode: 'easy', level: 'easy', difficulty: 'easy', kind: 'run', outcome: 'loss', score: 0, left: 2, cleared: false, ...dimensions });
    expect(first.cols).toBeGreaterThan(2);
    expect(first.rows).toBeGreaterThan(2);
    expect(w.SuiteProgressCore.normalizeEvent(first, 123)).not.toBeNull();
    w.eval('render(); render();');
    expect(record).toHaveBeenCalledTimes(1);
    w.document.getElementById('overUndoBtn').click();
    expect(w.document.getElementById('progressResult').hidden).toBe(true);
    puzzleFixture(w, [[0, 0], [0, 0]]);
    w.__turdomaniaPop(0, 0);
    expect(record).toHaveBeenCalledTimes(2);
    expect(record.mock.calls[1][0]).toMatchObject({ id: first.id, mode: 'easy', outcome: 'win', score: 1004, left: 0, cleared: true });
    w.document.getElementById('againBtn').click();
    expect(w.__turdomania.state.level).toBe('easy');
    expect(w.__turdomania.state.seed).toBe(42);
    expect(record).toHaveBeenCalledTimes(2);
    puzzleFixture(w, [[0, 0]]);
    w.__turdomaniaPop(0, 0);
    expect(record.mock.calls[2][0].id).not.toBe(first.id);
  });

  it('does not turn an initially unplayable board into an earned completion', () => {
    const { w, record } = boot('turdomania', '?level=hard&reducedMotion=1');
    puzzleFixture(w, [[0, 1], [1, 0]]);
    w.__turdomania.state.over = true;
    w.eval('render()');
    expect(record).not.toHaveBeenCalled();
  });
});

for (const game of ['TurdAnoid', 'turdtris', 'turdomania']) {
  it(`${game} keeps earned feedback quiet in results and clears it on replay`, () => {
    const { w, share } = boot(game, '?reducedMotion=1', { newlyEarned: [{ id: 'fixture', title: 'Fixture goal' }], storageAvailable: false, improvement: '100 points above your previous completed best' });
    if (game === 'TurdAnoid') { w.document.getElementById('btnStart').click(); w.__turdanoid.gameOver(false); }
    else if (game === 'turdtris') { startTurdtris(w, 'classic'); w.showGameOver(false); }
    else { puzzleFixture(w, [[0, 0]]); w.__turdomaniaPop(0, 0); }
    const status = w.document.getElementById('progressResult');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain('Fixture goal');
    expect(status.textContent).toContain('could not save progress');
    expect(status.textContent).toContain('100 points above');
    expect(share.setResult.mock.lastCall[0].improvement).toContain('100 points above');
    if (game === 'TurdAnoid') { w.document.getElementById('btnRestart').click(); }
    else if (game === 'turdtris') { w.restartGame(); }
    else { w.document.getElementById('againBtn').click(); }
    expect(status.hidden).toBe(true);
    expect(status.textContent).toBe('');
  });
}

it.each(['TurdAnoid', 'turdtris'])('%s marks real midrun changes as mixed, including paused changes back, but ignores same values', game => {
  const { w, record } = boot(game);
  const start = () => game === 'TurdAnoid' ? w.document.getElementById('btnStart').click() : startTurdtris(w, 'classic');
  const finish = () => game === 'TurdAnoid' ? w.__turdanoid.gameOver(false) : w.showGameOver(false);
  start(); w.Suite.difficulty.set('hard'); finish();
  expect(record.mock.calls[0][0].difficulty).toBe('hard');
  start();
  if (game === 'TurdAnoid') { w.__turdanoid.doPause(); } else { w.togglePause(); }
  w.Suite.difficulty.set('easy'); w.Suite.difficulty.set('hard'); finish();
  expect(record.mock.calls[1][0].difficulty).toBe('mixed');
  start(); finish();
  expect(record.mock.calls[2][0].difficulty).toBe('hard');
});
