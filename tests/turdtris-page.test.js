/**
 * Load the real turdtris.html page script in jsdom and prove the leftover
 * after #19: Hold/Next stay on the thumb dock, used Hold cannot swap,
 * hitch gravity still clamps, and Space still replays after game over.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as TurdtrisPresentation from '../games/turdtris-presentation.js';

const html = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'turdtris.html'),
  'utf8'
).replace(/<script type="module">[\s\S]*?<\/script>\s*/g, '');

function makeCtxStub() {
  const gradient = { addColorStop() {} };
  const target = {};
  return new Proxy(target, {
    get(t, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => gradient;
      }
      if (prop in t) {
        return t[prop];
      }
      return () => {};
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    }
  });
}

function bootPage(storedBest, storedSettings, storedPrefs = {}) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/turdtris.html',
    beforeParse(window) {
      window.TurdtrisPresentation = TurdtrisPresentation;
      window.HTMLCanvasElement.prototype.getContext = () => makeCtxStub();
      window.requestAnimationFrame = () => 1;
      window.cancelAnimationFrame = () => {};
      if (storedBest !== undefined) {
        window.localStorage.setItem('turdtrisHighScore', String(storedBest));
      }
      if (storedSettings !== undefined) {
        window.localStorage.setItem(TurdtrisPresentation.INPUT_SETTINGS_KEY, storedSettings);
      }
      Object.entries(storedPrefs).forEach(([key, value]) => window.localStorage.setItem(key, value));
    }
  });
  const w = dom.window;
  w.turdtrisRuntime.initializePresentation(TurdtrisPresentation, () => ({ name: 'Bathroom' }));
  w.hideWelcomeGuide();
  return w;
}

describe('Turdtris page leftover after the mobile dock', () => {
  let w;

  beforeEach(() => {
    w = bootPage('120');
  });

  afterEach(() => w.close());

  function key(code) {
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { code, cancelable: true }));
  }

  function press(action) {
    w.document.querySelector(`[data-action="${action}"]`).dispatchEvent(
      new w.Event('pointerdown', { bubbles: true, cancelable: true })
    );
  }

  it('resumes at normal gravity after pausing with keyboard soft drop held', () => {
    key('ArrowDown');
    expect(w.eval('softDrop')).toBe(true);
    key('KeyP');
    const row = w.eval('tetromino.row');
    key('KeyP');
    w.eval('dropAccumulator = 0; lastFrameTime = 1000; loop(1033); loop(1066)');
    expect(w.eval('tetromino.row')).toBe(row);
    expect(w.eval('softDrop')).toBe(false);
    key('ArrowDown');
    expect(w.eval('tetromino.row')).toBe(row + 1);
  });

  it.each(['pause', 'guide', 'blur'])('clears a held phone control on %s', (boundary) => {
    press('down');
    expect(w.eval('holdInterval || holdDelayTimeout')).not.toBeNull();
    if (boundary === 'pause') { key('KeyP'); }
    if (boundary === 'guide') { w.showWelcomeGuide(); }
    if (boundary === 'blur') { w.dispatchEvent(new w.Event('blur')); }
    expect(w.eval('paused')).toBe(true);
    expect(w.eval('holdInterval')).toBeNull();
    expect(w.eval('holdDelayTimeout')).toBeNull();
    expect(w.eval('softDrop')).toBe(false);
  });

  it('does not queue phone movement behind pause, but the dock can still resume', () => {
    key('KeyP');
    press('down');
    expect(w.eval('softDrop')).toBe(false);
    expect(w.eval('holdInterval')).toBeNull();
    expect(w.eval('holdDelayTimeout')).toBeNull();
    press('left');
    expect(w.eval('holdInterval')).toBeNull();
    expect(w.eval('holdDelayTimeout')).toBeNull();
    press('pause');
    expect(w.eval('paused')).toBe(false);
    const col = w.eval('tetromino.col');
    press('left');
    expect(w.eval('tetromino.col')).toBe(col - 1);
  });

  it('keeps hold, soft drop, and pause on the live dock', () => {
    const dock = w.document.getElementById('mobileControls');
    const actions = [...dock.querySelectorAll('[data-action]')].map((btn) =>
      btn.getAttribute('data-action')
    );
    expect(actions).toEqual(['left', 'rotate', 'right', 'drop', 'down', 'hold', 'pause']);
    expect(dock.querySelector('details, .mobile-extra')).toBeNull();
    expect(w.document.body.innerHTML).not.toContain('More Controls');
  });

  it('keeps Hold and Next previews on the thumb dock', () => {
    const dock = w.document.getElementById('mobileControls');
    expect(dock.querySelector('#mobileHold')).not.toBeNull();
    expect(dock.querySelector('#mobileNext')).not.toBeNull();
    expect(dock.querySelector('#mobileHoldBox')).not.toBeNull();
    expect(w.document.getElementById('mobileHold').getAttribute('aria-label')).toBe('Held piece');
    expect(w.document.getElementById('mobileNext').getAttribute('aria-label')).toBe('Next piece');
  });

  it('dims Hold after use and refuses a second swap on the same piece', () => {
    const first = w.eval('tetromino.name');
    w.holdCurrentPiece();
    const afterHold = {
      holdName: w.eval('holdName'),
      current: w.eval('tetromino.name'),
      canHold: w.eval('canHold')
    };
    expect(afterHold.holdName).toBe(first);
    expect(afterHold.canHold).toBe(false);

    const holdBtn = w.document.querySelector('#mobileControls [data-action="hold"]');
    expect(holdBtn.classList.contains('is-used')).toBe(true);
    expect(holdBtn.getAttribute('aria-disabled')).toBe('true');
    expect(w.document.getElementById('mobileHoldBox').classList.contains('is-used')).toBe(true);

    const lockedCurrent = afterHold.current;
    w.holdCurrentPiece();
    expect(w.eval('holdName')).toBe(first);
    expect(w.eval('tetromino.name')).toBe(lockedCurrent);
    expect(w.eval('canHold')).toBe(false);
    expect(w.eval('statusText')).toBe('Hold already used this piece.');
  });

  it('rejects a malformed stored best instead of painting NaN', () => {
    w.localStorage.setItem('turdtrisHighScore', '<script>1e999</script>');
    expect(w.readStoredHighScore()).toBe(0);
    w.localStorage.setItem('turdtrisHighScore', '480');
    expect(w.readStoredHighScore()).toBe(480);
  });

  it('clamps a multi-second hitch so gravity cannot slam the piece', () => {
    expect(w.clampFrameDelta(5000)).toBe(33);
    expect(w.clampFrameDelta(-12)).toBe(0);
    const startRow = w.eval('tetromino.row');
    w.eval('lastFrameTime = 1000; loop(6000)');
    expect(w.eval('tetromino.row')).toBe(startRow);
    expect(w.eval('dropAccumulator')).toBeLessThanOrEqual(33);
  });

  it('shows a new-best receipt and Space starts the next run', () => {
    w.eval('score = 260; runBestAtStart = 120; showGameOver(false)');
    expect(w.eval('gameOver')).toBe(true);
    expect(w.document.getElementById('endBestLabel').textContent).toBe('New best');
    expect(w.document.getElementById('endBest').textContent).toBe('260');
    expect(w.document.getElementById('gameOverOverlay').style.display).toBe('grid');

    w.document.dispatchEvent(
      new w.KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true })
    );
    expect(w.eval('gameOver')).toBe(false);
    expect(w.eval('score')).toBe(0);
    expect(w.document.getElementById('gameOverOverlay').style.display).toBe('none');
  });
});

describe('Turdtris presentation integration preserves classic play', () => {
  let w;

  beforeEach(() => {
    w = bootPage('120');
  });

  afterEach(() => w.close());

  function prepareClear(lines, perfect = false) {
    const fixtures = {
      1: { name: 'I', matrix: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], row: 18, col: 3 },
      2: { name: 'O', matrix: [[1, 1], [1, 1]], row: 18, col: 4 },
      3: { name: 'T', matrix: [[0, 1, 0], [0, 1, 1], [0, 1, 0]], row: 17, col: 3 },
      4: { name: 'I', matrix: [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]], row: 16, col: 2 }
    };
    w.clearFixture = { ...fixtures[lines], rotation: 0, lastActionRotate: false, lastKick: false };
    w.eval(`
      for (const row of playfield) row.fill(0);
      for (let row = rows - ${lines}; row < rows; row++) playfield[row].fill('G');
      tetromino = { ...clearFixture, row: clearFixture.row + rows - 20 };
      tetromino.matrix.forEach((row, ri) => row.forEach((cell, ci) => {
        if (cell) playfield[tetromino.row + ri][tetromino.col + ci] = 0;
      }));
    `);
    if (!perfect) { w.eval("playfield[14][0] = 'G'"); }
  }

  it.each([[1, 100], [2, 300], [3, 500], [4, 800]])(
    'retains the classic %s-line score of %s with real presentation helpers',
    (lines, expectedScore) => {
      prepareClear(lines);
      w.lockPiece();
      expect(w.eval('score')).toBe(expectedScore);
      expect(w.eval('linesCleared')).toBe(lines);
      expect(w.eval('runStats.pieces')).toBe(1);
      expect(w.eval('runStats.maxCombo')).toBe(1);
      expect(w.eval('runStats.tetrises')).toBe(lines === 4 ? 1 : 0);
      expect(w.eval('runStats.perfectClears')).toBe(0);
    }
  );

  it.each([[1, 1300], [2, 1500], [3, 1700], [4, 2000]])(
    'retains the existing perfect-clear bonus for a %s-line clear',
    (lines, expectedScore) => {
      prepareClear(lines, true);
      w.lockPiece();
      expect(w.eval('score')).toBe(expectedScore);
      expect(w.eval('playfield.every(row => row.every(cell => !cell))')).toBe(true);
      expect(w.eval('runStats.perfectClears')).toBe(1);
      expect(w.eval('takeover.text')).toBe('PERFECT CLEAR');
    }
  );

  it('retains the 100-point no-line T-spin and counts its new presentation statistic', () => {
    w.eval(`
      playfield[16][3] = 'G'; playfield[16][5] = 'G'; playfield[18][3] = 'G';
      tetromino = {
        name: 'T', matrix: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
        row: 16, col: 3, rotation: 0, lastActionRotate: true, lastKick: false
      };
      lockPiece();
    `);
    expect(w.eval('score')).toBe(100);
    expect(w.eval('linesCleared')).toBe(0);
    expect(w.eval('runStats.tSpins')).toBe(1);
    expect(w.eval('runStats.pieces')).toBe(1);
    expect(w.eval('combo')).toBe(0);
  });

  it('loads the legacy string best and keeps classic input defaults without writing settings', () => {
    expect(w.eval('highScore')).toBe(120);
    expect(w.document.getElementById('highScore').textContent).toBe('120');
    expect(w.localStorage.getItem('turdtrisHighScore')).toBe('120');
    expect(w.localStorage.getItem(TurdtrisPresentation.INPUT_SETTINGS_KEY)).toBeNull();
    expect(w.eval('inputSettings')).toEqual({ das: 156, arr: 33, softDrop: 0 });
    expect(w.document.getElementById('dasSetting').value).toBe('156');
    expect(w.document.getElementById('arrSetting').value).toBe('33');
    expect(w.document.getElementById('softSetting').value).toBe('0');
    expect(w.eval('TurdtrisPresentation.softDropInterval(getGravityMs(), inputSettings)'))
      .toBe(w.eval('Math.max(20, Math.floor(getGravityMs() / 15))'));
  });

  it('persists menu field changes only to the additive input setting key', () => {
    w.localStorage.setItem('turdtrisSoundOn_v1', '0');
    w.localStorage.setItem('turdsuite_muted', '1');
    const before = Object.fromEntries(Object.keys(w.localStorage).map((key) => [key, w.localStorage.getItem(key)]));
    w.document.getElementById('dasSetting').value = '100';
    w.document.getElementById('arrSetting').value = '16';
    const soft = w.document.getElementById('softSetting');
    soft.value = '20';
    soft.dispatchEvent(new w.Event('change', { bubbles: true }));
    expect(w.eval('inputSettings')).toEqual({ das: 100, arr: 16, softDrop: 20 });
    expect(JSON.parse(w.localStorage.getItem(TurdtrisPresentation.INPUT_SETTINGS_KEY)))
      .toEqual({ das: 100, arr: 16, softDrop: 20 });
    for (const [key, value] of Object.entries(before)) {
      expect(w.localStorage.getItem(key)).toBe(value);
    }
    expect(Object.keys(w.localStorage).filter((key) => !(key in before)))
      .toEqual([TurdtrisPresentation.INPUT_SETTINGS_KEY]);
    w.turdtrisRuntime.initializePresentation(TurdtrisPresentation, () => ({ name: 'Bathroom' }));
    expect(w.eval('inputSettings')).toEqual({ das: 100, arr: 16, softDrop: 20 });
  });

  it.each(['pause', 'blur', 'restart'])('clears buffered rotation across %s', (boundary) => {
    w.eval('rotationBuffer.queue(1, performance.now())');
    expect(w.eval('rotationBuffer.pending')).not.toBeNull();
    if (boundary === 'pause') { w.togglePause(); }
    if (boundary === 'blur') { w.dispatchEvent(new w.Event('blur')); }
    if (boundary === 'restart') { w.restartGame(); }
    expect(w.eval('rotationBuffer.pending')).toBeNull();
    expect(w.eval('rotationBuffer.consume(performance.now())')).toBe(0);
  });

  it('buffers a blocked rotation for the next spawn and consumes it exactly once', () => {
    w.performance.now = () => 1000;
    w.eval(`
      for (let row = 14; row < rows; row++) playfield[row].fill('G');
      tetromino = {
        name: 'T', matrix: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
        row: 16, col: 3, rotation: 0, lastActionRotate: false, lastKick: false
      };
      playfield[16][4] = 0;
      playfield[17][3] = 0; playfield[17][4] = 0; playfield[17][5] = 0;
      tryRotate(-1);
    `);
    expect(w.eval('tetromino.rotation')).toBe(0);
    expect(w.eval('rotationBuffer.pending.direction')).toBe(-1);
    w.eval("tetrominoSequence.push('T'); nextTetromino = getNextTetromino(); spawnNextPiece()");
    expect(w.eval('tetromino.name')).toBe('T');
    expect(w.eval('tetromino.rotation')).toBe(3);
    expect(w.eval('rotationBuffer.pending')).toBeNull();
    w.spawnNextPiece();
    expect(w.eval('tetromino.rotation')).toBe(0);
  });

  it('receipts actual locks, combo, tetrises, active time and PPS without counting paused time', () => {
    prepareClear(4);
    w.lockPiece();
    prepareClear(1);
    w.lockPiece();
    w.eval('lastFrameTime = 1000; loop(31000)');
    expect(w.eval('runStats.elapsedMs')).toBe(30000);
    w.togglePause();
    w.eval('loop(61000)');
    expect(w.eval('runStats.elapsedMs')).toBe(30000);
    w.showGameOver(false);
    expect(w.document.getElementById('finalScore').textContent).toBe('1000');
    expect(w.document.getElementById('finalLines').textContent).toBe('5');
    expect(w.document.getElementById('finalCombo').textContent).toBe('2');
    expect(w.document.getElementById('finalTetrises').textContent).toBe('1');
    expect(w.document.getElementById('finalPace').textContent).toBe('0:30 / 0.07');
    expect(w.document.getElementById('endOverlayCard').classList.contains('is-record')).toBe(true);
    expect(w.localStorage.getItem('turdtrisHighScore')).toBe('1000');
    w.restartGame();
    expect(w.eval('runStats')).toEqual(TurdtrisPresentation.createRunStats());
    expect(w.localStorage.getItem('turdtrisHighScore')).toBe('1000');
  });
});

describe('Turdtris page audio integration', () => {
  let w;
  let player;

  beforeEach(() => {
    w = bootPage('120');
    player = { arm: vi.fn(), stop: vi.fn(), play: vi.fn(), update: vi.fn() };
    w.__turdtrisAudio = player;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    w.close();
  });

  it('rejects synthetic pointer and keyboard events without arming or creating audio', () => {
    const createAudio = vi.fn();
    w.AudioContext = createAudio;
    w.document.dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'ArrowLeft', bubbles: true }));
    w.playSfx('drop');
    expect(w.turdtrisRuntime.audioArmed()).toBe(false);
    expect(player.arm).not.toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
    expect(createAudio).not.toHaveBeenCalled();
  });

  it('restores music opt-out and toggles only its additive key', () => {
    w.close();
    w = bootPage('120', undefined, {
      turdtrisMusic_v1: '0', turdtrisSoundOn_v1: '0', turdsuite_muted: '1'
    });
    w.__turdtrisAudio = player;
    expect(w.turdtrisRuntime.musicEnabled()).toBe(false);
    expect(w.turdtrisRuntime.soundEnabled()).toBe(false);
    expect(w.document.getElementById('musicToggle').getAttribute('aria-pressed')).toBe('false');
    const before = Object.fromEntries(Object.keys(w.localStorage).map(key => [key, w.localStorage.getItem(key)]));
    w.toggleMusic();
    expect(w.turdtrisRuntime.musicEnabled()).toBe(true);
    expect(w.localStorage.getItem('turdtrisMusic_v1')).toBe('1');
    expect(w.document.getElementById('musicToggle').getAttribute('aria-pressed')).toBe('true');
    expect(player.update).toHaveBeenCalledOnce();
    for (const [key, value] of Object.entries(before)) {
      if (key !== 'turdtrisMusic_v1') {expect(w.localStorage.getItem(key)).toBe(value);}
    }
    w.toggleMusic();
    expect(w.localStorage.getItem('turdtrisMusic_v1')).toBe('0');
    expect(w.turdtrisRuntime.soundEnabled()).toBe(false);
  });

  it('defaults music on without writing any existing preference', () => {
    expect(w.turdtrisRuntime.musicEnabled()).toBe(true);
    expect(w.localStorage.getItem('turdtrisMusic_v1')).toBeNull();
    expect(w.localStorage.getItem('turdtrisSoundOn_v1')).toBeNull();
    w.toggleMusic();
    expect(w.localStorage.getItem('turdtrisMusic_v1')).toBe('0');
    expect(w.localStorage.getItem('turdtrisSoundOn_v1')).toBeNull();
    expect(w.localStorage.getItem('turdtrisHighScore')).toBe('120');
  });

  it.each(['pause', 'guide', 'blur', 'gameover', 'victory'])('immediately stops music at the %s boundary', boundary => {
    if (boundary === 'pause') {w.togglePause();}
    if (boundary === 'guide') {w.showWelcomeGuide();}
    if (boundary === 'blur') {w.dispatchEvent(new w.Event('blur'));}
    if (boundary === 'gameover') {w.showGameOver(false);}
    if (boundary === 'victory') {w.showGameOver(true);}
    expect(player.stop).toHaveBeenCalled();
    w.updateMusic();
    expect(player.update).toHaveBeenLastCalledWith(expect.objectContaining({ active: false }));
  });

  it.each(['game', 'suite'])('gates SFX with the restored %s mute setting', muteSource => {
    w.close();
    const storedPrefs = muteSource === 'game' ? { turdtrisSoundOn_v1: '0' } : { turdsuite_muted: '1' };
    w = bootPage('120', undefined, storedPrefs);
    w.__turdtrisAudio = player;
    w.eval('audioArmed = true');
    w.playSfx('clear', { linesCleared: 4 });
    w.showGameOver(true);
    expect(player.play).not.toHaveBeenCalled();
    expect(w.eval('audioCtx')).toBeNull();
  });

  it('consults the suite mute state even when browser storage is blocked', () => {
    const isMuted = vi.fn(() => true);
    w.Suite = { isMuted };
    vi.spyOn(w.Storage.prototype, 'getItem').mockImplementation(() => {
      throw new w.DOMException('Storage blocked', 'SecurityError');
    });
    w.eval('audioArmed = true');
    expect(w.suiteMuted()).toBe(true);
    w.playSfx('drop');
    expect(isMuted).toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
    expect(w.eval('audioCtx')).toBeNull();
  });
});
