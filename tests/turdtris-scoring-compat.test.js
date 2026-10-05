/**
 * Classic scoring contract, checked against turdtris.html at b3821b4.
 * Execute the shipping page: the older standalone engine uses different combo
 * and level rules and cannot protect the scores stored as turdtrisHighScore.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as presentation from '../games/turdtris-presentation.js';

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

describe('Classic scoring compatibility with b3821b4', () => {
  let w;

  beforeEach(() => {
    const dom = new JSDOM(html, {
      runScripts: 'dangerously',
      url: 'http://localhost/turdtris.html',
      beforeParse(window) {
        window.TurdtrisPresentation = presentation;
        window.HTMLCanvasElement.prototype.getContext = canvasContext;
        window.requestAnimationFrame = () => 1;
        window.cancelAnimationFrame = () => {};
      }
    });
    w = dom.window;
    w.turdtrisRuntime.initializePresentation(presentation, () => ({ name: 'Bathroom' }));
    w.hideWelcomeGuide();
  });

  afterEach(() => w.close());

  function prepareClear(lines, { perfect = false, clutch = false } = {}) {
    const fixtures = {
      0: { name: 'O', matrix: [[1, 1], [1, 1]], bottomOffset: 2, col: 4 },
      1: { name: 'I', matrix: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], bottomOffset: 2, col: 3 },
      2: { name: 'O', matrix: [[1, 1], [1, 1]], bottomOffset: 2, col: 4 },
      3: { name: 'T', matrix: [[0, 1, 0], [0, 1, 1], [0, 1, 0]], bottomOffset: 3, col: 3 },
      4: { name: 'I', matrix: [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]], bottomOffset: 4, col: 2 }
    };
    w.fixture = fixtures[lines];
    w.eval(`
      for (const row of playfield) row.fill(0);
      for (let row = rows - ${lines}; row < rows; row++) playfield[row].fill('G');
      tetromino = {
        ...fixture, row: rows - fixture.bottomOffset,
        rotation: 0, lastActionRotate: false, lastKick: false
      };
      tetromino.matrix.forEach((row, ri) => row.forEach((cell, ci) => {
        if (cell) playfield[tetromino.row + ri][tetromino.col + ci] = 0;
      }));
    `);
    // A survivor prevents perfect-clear awards. The high survivor leaves an
    // exactly 14-row stack after the clear, exercising the legacy clutch cutoff.
    if (!perfect) {
      w.eval(`playfield[${clutch ? `rows - 14 - ${lines}` : 'rows - 8'}][0] = 'G'`);
    }
  }

  function lock(lines, options) {
    prepareClear(lines, options);
    const before = w.eval('score');
    w.lockPiece();
    return w.eval('score') - before;
  }

  it.each([
    [1, 1, 100], [2, 1, 300], [3, 1, 500], [4, 1, 800],
    [1, 7, 700], [2, 7, 2100], [3, 7, 3500], [4, 7, 5600]
  ])('awards %i lines at level %i exactly %i points', (lines, level, points) => {
    w.eval(`level = ${level}; levelGoal = getLinesGoalForLevel(level)`);
    expect(lock(lines)).toBe(points);
    expect(w.eval('linesCleared')).toBe(lines);
  });

  it('adds 100 on the second combo, 150 on the third, and resets on an empty lock', () => {
    expect(lock(1)).toBe(100);
    expect(lock(1)).toBe(200);
    expect(lock(1)).toBe(250);
    expect(w.eval('combo')).toBe(3);
    expect(lock(0)).toBe(0);
    expect(w.eval('combo')).toBe(0);
    expect(lock(1)).toBe(100);
    expect(w.eval('score')).toBe(650);
  });

  it('multiplies the combo bonus by the current level', () => {
    w.eval('level = 3');
    expect(lock(2)).toBe(900);
    expect(lock(1)).toBe(600);
    expect(lock(1)).toBe(750);
  });

  it('applies B2B to the clear base before adding the combo bonus', () => {
    expect(lock(4)).toBe(800);
    expect(lock(4)).toBe(1300); // 800 * 1.5 + 2 * 50; still level 1.
    expect(w.eval('b2b')).toBe(2);
    expect(w.eval('level')).toBe(2);
    expect(w.eval('score')).toBe(2100);
  });

  it('preserves B2B across an empty lock, but a normal clear breaks it', () => {
    expect(lock(4)).toBe(800);
    expect(lock(0)).toBe(0);
    expect(w.eval('combo')).toBe(0);
    expect(w.eval('b2b')).toBe(1);
    expect(lock(4)).toBe(1200);
    expect(w.eval('b2b')).toBe(2);
    expect(lock(1)).toBe(400); // Level 2: 100 * 2 + 2 * 50 * 2.
    expect(w.eval('b2b')).toBe(0);
    expect(lock(4)).toBe(1900); // Level 2: 800 * 2 + 3 * 50 * 2.
    expect(w.eval('b2b')).toBe(1);
  });

  it.each([[1, 1300], [2, 1500], [3, 1700], [4, 2000]])(
    'retains the 1200-point perfect-clear bonus on %i lines', (lines, points) => {
      expect(lock(lines, { perfect: true })).toBe(points);
    }
  );

  it('adds the legacy 20 percent clutch bonus after the combo bonus', () => {
    expect(lock(1, { clutch: true })).toBe(120);
    expect(w.getStackHeight()).toBe(14);
    expect(lock(1, { clutch: true })).toBe(240);
  });

  it('keeps the legacy no-line T-spin award without extending the combo', () => {
    w.eval(`
      level = 3; combo = 4; b2b = 2;
      for (const row of playfield) row.fill(0);
      playfield[16][3] = 'G'; playfield[16][5] = 'G'; playfield[18][3] = 'G';
      tetromino = {
        name: 'T', matrix: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
        row: 16, col: 3, rotation: 0, lastActionRotate: true, lastKick: false
      };
      lockPiece();
    `);
    expect(w.eval('score')).toBe(300);
    expect(w.eval('linesCleared')).toBe(0);
    expect(w.eval('combo')).toBe(0);
    expect(w.eval('b2b')).toBe(2);
  });

  function prepareDrop(row) {
    w.eval(`
      for (const cells of playfield) cells.fill(0);
      tetromino = {
        name: 'O', matrix: [[1, 1], [1, 1]], row: ${row}, col: 4,
        rotation: 0, lastActionRotate: false, lastKick: false
      };
    `);
  }

  it.each([1, 7, 30])('awards one point per manual soft-drop cell at level %i', level => {
    w.eval(`level = ${level}`);
    prepareDrop(18);
    w.softDropStep();
    w.softDropStep();
    expect(w.eval('tetromino.row')).toBe(20);
    expect(w.eval('score')).toBe(2);
    w.softDropStep(); // Grounded: lock without awarding another cell.
    expect(w.eval('score')).toBe(2);
  });

  it.each([[2, 36], [10, 20], [20, 0]])(
    'awards two points per hard-drop cell from row %i', (row, points) => {
      w.eval('level = 7');
      prepareDrop(row);
      w.hardDrop();
      expect(w.eval('score')).toBe(points);
    }
  );

  it('does not award extra points for automatic or held soft-drop gravity', () => {
    prepareDrop(2);
    w.eval('lastFrameTime = 1000; dropAccumulator = 990; loop(1016)');
    expect(w.eval('tetromino.row')).toBe(3);
    expect(w.eval('score')).toBe(0);
    w.eval('softDrop = true; dropAccumulator = 60; loop(1032)');
    expect(w.eval('tetromino.row')).toBe(4);
    expect(w.eval('score')).toBe(0);
  });

  it('pins the actual page gravity curve in milliseconds, through the level-69 finish', () => {
    const expected = [
      1000, 793, 618, 473, 355, 262, 190, 135, 94, 64,
      43, 28, 18, 11, 7, 5, 4, 3, 2, 1
    ];
    expected.forEach((milliseconds, index) => {
      w.eval(`level = ${index + 1}`);
      expect(w.getGravityMs()).toBe(milliseconds);
    });
    for (let level = 21; level <= 69; level++) {
      w.eval(`level = ${level}`);
      expect(w.getGravityMs()).toBe(1);
    }
    expect(w.eval('MAX_LEVEL')).toBe(69);
    expect(w.eval('lockDelayMs')).toBe(500);
    expect(w.eval('maxMoveResets')).toBe(12);
  });

  it.each([
    [1, 8], [5, 8], [6, 10], [15, 10], [16, 12], [30, 12],
    [31, 14], [45, 14], [46, 16], [60, 16], [61, 18], [80, 18], [81, 20]
  ])('requires %i level to use a %i-line goal', (level, goal) => {
    expect(w.getLinesGoalForLevel(level)).toBe(goal);
  });

  it.each([[5, 8, 6, 10], [15, 10, 16, 12], [30, 12, 31, 14], [45, 14, 46, 16], [60, 16, 61, 18]])(
    'carries surplus lines from level %i into the next goal', (level, goal, nextLevel, nextGoal) => {
      w.eval(`level = ${level}; levelGoal = ${goal}; levelLines = ${goal - 1}`);
      expect(lock(2)).toBe(300 * level); // Award uses the level before promotion.
      expect(w.eval('level')).toBe(nextLevel);
      expect(w.eval('levelLines')).toBe(1);
      expect(w.eval('levelGoal')).toBe(nextGoal);
    }
  );
});
