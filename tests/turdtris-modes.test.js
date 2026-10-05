import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as modes from '../games/turdtris-modes.js';
import * as presentation from '../games/turdtris-presentation.js';

describe('Turdtris optional challenge rules', () => {
  it('defaults unknown modes to Classic and keeps records on three distinct keys', () => {
    expect(modes.modeDefinition('unknown')).toBe(modes.MODES.classic);
    expect(modes.modeDefinition()).toBe(modes.MODES.classic);
    expect(Object.values(modes.MODES).map(mode => mode.bestKey)).toEqual([
      'turdtrisHighScore', 'turdtrisSprint40BestMs_v1', 'turdtrisUltra120Best_v1'
    ]);
  });

  it.each([null, '', '-2', 'NaN', 'Infinity', '12.5', '9007199254740992', '{"score":5}'])(
    'treats malformed or empty challenge best %j as unset', raw => {
      expect(modes.readModeBest({ getItem: () => raw }, 'sprint')).toBe(0);
    }
  );

  it('reads string records and tolerates unavailable storage', () => {
    expect(modes.readModeBest({ getItem: () => '90000' }, 'sprint')).toBe(90000);
    expect(modes.readModeBest({ getItem() { throw new Error('storage blocked'); } }, 'ultra')).toBe(0);
  });

  it.each([
    ['classic', 40, 120000, false], ['sprint', 39, 180000, false],
    ['sprint', 40, 90000, true], ['sprint', 42, 90000, true],
    ['ultra', 40, 119999, false], ['ultra', 0, 120000, true], ['ultra', 0, 120016, true]
  ])('completes %s with %i lines at %i ms: %s', (mode, lines, elapsed, expected) => {
    expect(modes.isModeComplete(mode, lines, elapsed)).toBe(expected);
  });

  it('records only completed, positive Sprint times and retains the fastest', () => {
    expect(modes.challengeRecord('sprint', { elapsedMs: 50000, completed: false })).toBe(0);
    expect(modes.challengeRecord('sprint', { elapsedMs: 0, completed: true })).toBe(0);
    expect(modes.challengeRecord('sprint', { elapsedMs: 61234.2, completed: true })).toBe(61235);
    expect(modes.challengeRecord('sprint', { elapsedMs: 70000, completed: true }, 61235)).toBe(61235);
    expect(modes.challengeRecord('sprint', { elapsedMs: 60000, completed: true }, 61235)).toBe(60000);
    expect(modes.challengeRecord('sprint', { elapsedMs: 40000, completed: false }, 61235)).toBe(61235);
  });

  it('retains the highest Ultra score even when the stack overflows before time', () => {
    expect(modes.challengeRecord('ultra', { score: 500, completed: false }, 400)).toBe(500);
    expect(modes.challengeRecord('ultra', { score: 100, completed: true }, 400)).toBe(400);
  });

  it.each([[0, false, '0:00'], [-1, true, '0:00.0'], [59999, true, '0:59.9'], [120000, false, '2:00']])(
    'formats %i milliseconds with tenths %s as %s', (milliseconds, tenths, expected) => {
      expect(modes.formatRunTime(milliseconds, tenths)).toBe(expected);
    }
  );
});

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'turdtris.html'), 'utf8')
  .replace(/<script type="module">[\s\S]*?<\/script>\s*/g, '');

function canvasContext() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(target, property) {
      if (property === 'createLinearGradient' || property === 'createRadialGradient') {
        return () => gradient;
      }
      return target[property] ?? (() => {});
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    }
  });
}

describe('Turdtris challenge page integration', () => {
  let w;
  let clock;

  beforeEach(() => {
    clock = 1000;
    const dom = new JSDOM(html, {
      runScripts: 'dangerously',
      url: 'http://localhost/turdtris.html',
      beforeParse(window) {
        window.performance.now = () => clock;
        window.TurdtrisModes = modes;
        window.TurdtrisPresentation = presentation;
        window.HTMLCanvasElement.prototype.getContext = canvasContext;
        window.requestAnimationFrame = () => 1;
        window.cancelAnimationFrame = () => {};
        window.localStorage.setItem('turdtrisHighScore', '120');
        window.localStorage.setItem('turdtrisSprint40BestMs_v1', '90000');
        window.localStorage.setItem('turdtrisUltra120Best_v1', '500');
      }
    });
    w = dom.window;
    w.turdtrisRuntime.initializePresentation(presentation, () => ({ name: 'Bathroom' }));
    w.hideWelcomeGuide();
  });

  afterEach(() => w.close());

  function start(mode) {
    w.document.getElementById('modeSetting').value = mode;
    w.startSelectedMode();
  }

  function prepareSingle() {
    w.eval(`
      for (const row of playfield) row.fill(0);
      playfield[rows - 1].fill('G');
      playfield[rows - 8][0] = 'G';
      for (let col = 3; col <= 6; col++) playfield[rows - 1][col] = 0;
      tetromino = {
        name: 'I', matrix: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
        row: rows - 2, col: 3, rotation: 0, lastActionRotate: false, lastKick: false
      };
    `);
  }

  it('loads Classic by default even when both challenge records exist', () => {
    expect(w.eval('runMode')).toBe('classic');
    expect(w.document.getElementById('modeSetting').value).toBe('classic');
    expect(w.document.getElementById('highScore').textContent).toBe('120');
    w.eval('score = 200; updateScore()');
    expect(w.localStorage.getItem('turdtrisHighScore')).toBe('200');
    expect(w.localStorage.getItem('turdtrisSprint40BestMs_v1')).toBe('90000');
    expect(w.localStorage.getItem('turdtrisUltra120Best_v1')).toBe('500');
  });

  it('leaves an incomplete Sprint unrecorded and protects all other best keys', () => {
    w.localStorage.removeItem('turdtrisSprint40BestMs_v1');
    start('sprint');
    w.eval('score = 9999; linesCleared = 39; runStats.elapsedMs = 50000; showGameOver(false)');
    expect(w.localStorage.getItem('turdtrisSprint40BestMs_v1')).toBeNull();
    expect(w.localStorage.getItem('turdtrisHighScore')).toBe('120');
    expect(w.localStorage.getItem('turdtrisUltra120Best_v1')).toBe('500');
    expect(w.document.getElementById('endTitle').textContent).toBe('Sprint stopped');
    expect(w.document.getElementById('endBest').textContent).toBe('—');
  });

  it('finishes Sprint on line 40 after crediting the last clear, then records its time', () => {
    start('sprint');
    w.eval('score = 1000; linesCleared = 39; runStats.elapsedMs = 61234.2');
    prepareSingle();
    w.lockPiece();
    expect(w.eval('gameOver')).toBe(true);
    expect(w.eval('score')).toBe(1100);
    expect(w.eval('linesCleared')).toBe(40);
    expect(w.localStorage.getItem('turdtrisSprint40BestMs_v1')).toBe('61235');
    expect(w.localStorage.getItem('turdtrisHighScore')).toBe('120');
    expect(w.localStorage.getItem('turdtrisUltra120Best_v1')).toBe('500');
    expect(w.document.getElementById('endTitle').textContent).toBe('40 lines. Flushed!');
    expect(w.document.getElementById('finalScore').textContent).toBe('1100');
    expect(w.document.getElementById('endBestLabel').textContent).toBe('New best time');
    expect(w.document.getElementById('endBest').textContent).toBe('1:01.2');
    expect(w.document.getElementById('gameOverOverlay').style.display).toBe('grid');
  });

  it('ends Ultra exactly at two active minutes before gravity can lock or award points', () => {
    start('ultra');
    prepareSingle();
    clock = 1033;
    w.eval(`
      score = 600; runStats.elapsedMs = 119990;
      lockAccumulator = 499; lastFrameTime = 1000; challengeClockTime = 1000; loop(1033);
    `);
    expect(w.eval('gameOver')).toBe(true);
    expect(w.eval('runStats.elapsedMs')).toBe(120000);
    expect(w.eval('score')).toBe(600);
    expect(w.eval('linesCleared')).toBe(0);
    w.softDropStep();
    w.hardDrop();
    w.loop(2000);
    expect(w.eval('score')).toBe(600);
    expect(w.eval('linesCleared')).toBe(0);
    expect(w.localStorage.getItem('turdtrisUltra120Best_v1')).toBe('600');
    expect(w.localStorage.getItem('turdtrisHighScore')).toBe('120');
    expect(w.localStorage.getItem('turdtrisSprint40BestMs_v1')).toBe('90000');
    expect(w.document.getElementById('endTitle').textContent).toBe('Time’s up!');
    expect(w.document.getElementById('level').textContent).toBe('0:00');
  });

  it.each(['sprint', 'ultra'])('excludes pause time from the %s clock, including the first resumed frame', mode => {
    start(mode);
    clock = 1033;
    w.eval('lastFrameTime = 1000; challengeClockTime = 1000; loop(1033)');
    expect(w.eval('runStats.elapsedMs')).toBe(33);
    w.togglePause();
    clock = 31033;
    w.loop(31033);
    expect(w.eval('runStats.elapsedMs')).toBe(33);
    w.togglePause();
    clock = 31066;
    w.loop(31066);
    expect(w.eval('runStats.elapsedMs')).toBe(66);
  });

  it.each(['hardDrop', 'softDropStep'])(
    'rejects %s arriving after the Ultra deadline but before the next animation frame', action => {
      start('ultra');
      prepareSingle();
      w.eval('score = 600; runStats.elapsedMs = 119990; lastFrameTime = 1000; challengeClockTime = 1000');
      clock = 1015;
      w[action]();
      expect(w.eval('gameOver')).toBe(true);
      expect(w.eval('runStats.elapsedMs')).toBe(120000);
      expect(w.eval('score')).toBe(600);
      expect(w.eval('linesCleared')).toBe(0);
      expect(w.eval('runStats.pieces')).toBe(0);
      expect(w.localStorage.getItem('turdtrisUltra120Best_v1')).toBe('600');
      expect(w.document.getElementById('endTitle').textContent).toBe('Time’s up!');
    }
  );

  it('counts the final partial frame once when a hard drop completes Sprint', () => {
    start('sprint');
    prepareSingle();
    w.eval(`
      score = 1000; linesCleared = 39; runStats.elapsedMs = 61200;
      lastFrameTime = 62200; challengeClockTime = 62200;
    `);
    clock = 62237.25;
    w.hardDrop();
    expect(w.eval('gameOver')).toBe(true);
    expect(w.eval('linesCleared')).toBe(40);
    expect(w.eval('score')).toBe(1100);
    expect(w.eval('runStats.elapsedMs')).toBe(61237.25);
    expect(w.localStorage.getItem('turdtrisSprint40BestMs_v1')).toBe('61238');
  });

  it.each(['pause', 'blur', 'guide'])(
    'counts the partial frame before %s and excludes the entire paused interval', boundary => {
      start('ultra');
      clock = 1033;
      w.loop(clock);
      expect(w.eval('runStats.elapsedMs')).toBe(33);
      clock = 1049;
      if (boundary === 'pause') { w.togglePause(); }
      if (boundary === 'blur') { w.dispatchEvent(new w.Event('blur')); }
      if (boundary === 'guide') { w.showWelcomeGuide(); }
      expect(w.eval('paused')).toBe(true);
      expect(w.eval('runStats.elapsedMs')).toBe(49);
      clock = 31049;
      w.loop(clock);
      expect(w.eval('runStats.elapsedMs')).toBe(49);
      if (boundary === 'guide') { w.hideWelcomeGuide(); }
      else { w.togglePause(); }
      clock = 31066;
      w.loop(clock);
      expect(w.eval('runStats.elapsedMs')).toBe(66);
      expect(w.eval('gameOver')).toBe(false);
    }
  );

  it.each(['sprint', 'ultra'])('increases %s speed without adding Classic garbage', mode => {
    start(mode);
    prepareSingle();
    w.eval('level = 5; levelLines = 7; levelGoal = 8; lockPiece()');
    expect(w.eval('level')).toBe(6);
    expect(w.eval('activeMutator')).toBe('Warmup Flow');
    expect(w.eval('playfield.reduce((sum, row) => sum + row.filter(Boolean).length, 0)')).toBe(1);
  });

  it('restarts the chosen mode and switching back restores the Classic score HUD', () => {
    start('sprint');
    w.eval('runStats.elapsedMs = 40000; score = 999; showGameOver(false)');
    w.restartGame();
    expect(w.eval('runMode')).toBe('sprint');
    expect(w.eval('runStats.elapsedMs')).toBe(0);
    expect(w.document.getElementById('highScore').textContent).toBe('1:30.0');
    expect(w.document.getElementById('level').textContent).toBe('0:00.0');
    start('classic');
    expect(w.eval('runMode')).toBe('classic');
    expect(w.document.getElementById('highScore').textContent).toBe('120');
    expect(w.document.getElementById('level').textContent).toBe('1');
    expect(w.document.getElementById('levelLabel').textContent).toBe('Level');
    expect(w.document.getElementById('gameOverOverlay').style.display).toBe('none');
  });
});
