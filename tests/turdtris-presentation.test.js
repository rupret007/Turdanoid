import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INPUT_SETTINGS,
  normalizeInputSettings,
  parseInputSettings,
  softDropInterval,
  detectTSpin,
  isPerfectClear,
  classifyGesture,
  hapticDuration,
  RotationBuffer,
  createRunStats,
  recordLock,
  piecesPerSecond
} from '../games/turdtris-presentation.js';

const emptyBoard = () => Array.from({ length: 20 }, () => Array(10).fill(0));

describe('Turdtris spin and perfect-clear detection', () => {
  it('preserves the legacy rotated T plus three occupied corners rule', () => {
    const grid = emptyBoard();
    const piece = { name: 'T', row: 5, col: 3, lastActionRotate: true };
    grid[5][3] = 'I';
    grid[5][5] = 'O';
    expect(detectTSpin({ piece, grid })).toBe(false);
    grid[7][3] = 'G';
    expect(detectTSpin({ piece, grid })).toBe(true);
    expect(detectTSpin({ piece: { ...piece, name: 'J' }, grid })).toBe(false);
    expect(detectTSpin({ piece: { ...piece, lastActionRotate: false }, grid })).toBe(false);
    expect(detectTSpin({ piece, grid, lastAction: 'move' })).toBe(false);
    expect(detectTSpin({ piece: { ...piece, lastActionRotate: false }, grid, lastAction: 'rotate' })).toBe(true);
  });

  it('counts floor, side walls and the invisible ceiling as occupied corners', () => {
    const grid = emptyBoard();
    grid[18][3] = 'G';
    expect(detectTSpin({ piece: { name: 'T', row: 18, col: 3, lastActionRotate: true }, grid })).toBe(true);
    grid[5][1] = 'G';
    expect(detectTSpin({ piece: { name: 'T', row: 5, col: -1, lastActionRotate: true }, grid })).toBe(true);
    grid[1][3] = 'G';
    expect(detectTSpin({ piece: { name: 'T', row: -1, col: 3, lastActionRotate: true }, grid })).toBe(true);
  });

  it('matches the legacy implementation across corner occupancy and border positions', () => {
    for (const row of [-2, -1, 0, 8, 18, 19]) {
      for (const col of [-1, 0, 4, 8, 9]) {
        for (let mask = 0; mask < 16; mask++) {
          const grid = emptyBoard();
          const corners = [[row, col], [row, col + 2], [row + 2, col], [row + 2, col + 2]];
          corners.forEach(([r, c], index) => {
            if (r >= 0 && r < 20 && c >= 0 && c < 10 && (mask & (1 << index))) { grid[r][c] = 'G'; }
          });
          const occupied = corners.filter(([r, c]) => r < 0 || r >= 20 || c < 0 || c >= 10 || grid[r][c]).length;
          const piece = { name: 'T', row, col, lastActionRotate: true };
          expect(detectTSpin({ piece, grid, cols: 10, rows: 20 })).toBe(occupied >= 3);
        }
      }
    }
  });

  it('only celebrates an actual empty board, including checking garbage cells', () => {
    const grid = emptyBoard();
    expect(isPerfectClear(grid)).toBe(true);
    grid[19][2] = 'G';
    expect(isPerfectClear(grid)).toBe(false);
    expect(isPerfectClear([])).toBe(false);
    expect(isPerfectClear(null)).toBe(false);
    expect(isPerfectClear([[]])).toBe(false);
  });
});

describe('Turdtris optional input settings', () => {
  it('uses exactly the legacy DAS, ARR and dynamic soft drop without a new setting', () => {
    expect(parseInputSettings(null)).toEqual({ das: 156, arr: 33, softDrop: 0 });
    for (const gravity of [1000, 850, 525, 310, 140, 35, 20]) {
      expect(softDropInterval(gravity)).toBe(Math.max(20, Math.floor(gravity / 15)));
    }
    expect(softDropInterval(850, { softDrop: 35 })).toBe(35);
  });

  it('recovers from corrupt or partial storage and clamps unsafe repeat rates', () => {
    for (const raw of ['broken', 'null', '[]', 'false', '42', '{}']) {
      expect(parseInputSettings(raw)).toEqual(DEFAULT_INPUT_SETTINGS);
    }
    expect(parseInputSettings('{"das":100}')).toEqual({ das: 100, arr: 33, softDrop: 0 });
    expect(normalizeInputSettings({ das: -5, arr: 0, softDrop: 1 })).toEqual({ das: 60, arr: 16, softDrop: 20 });
    expect(normalizeInputSettings({ das: 900, arr: 999, softDrop: 800 })).toEqual({ das: 300, arr: 120, softDrop: 150 });
    expect(normalizeInputSettings({ das: Infinity, arr: NaN, softDrop: 'nope' })).toEqual(DEFAULT_INPUT_SETTINGS);
    expect(normalizeInputSettings({ das: null, arr: false, softDrop: '' })).toEqual(DEFAULT_INPUT_SETTINGS);
  });

  it('does not alter shared defaults when callers change their settings', () => {
    const settings = parseInputSettings(null);
    settings.das = 120;
    expect(DEFAULT_INPUT_SETTINGS.das).toBe(156);
  });
});

describe('Turdtris touch intent and accessible feedback', () => {
  it.each([
    [3, -2, 120, 'rotate'],
    [-65, 6, 170, 'left'],
    [65, -6, 170, 'right'],
    [4, 80, 400, 'softDrop'],
    [4, 80, 100, 'hardDrop'],
    [4, -80, 100, 'hardDrop'],
    [4, -80, 400, null],
    [4, 20, 120, null],
    [35, 35, 100, null],
    [2, 3, 400, null]
  ])('classifies (%s, %s) over %sms as %s', (dx, dy, elapsedMs, result) => {
    expect(classifyGesture({ dx, dy, elapsedMs })).toBe(result);
  });

  it('rejects invalid gestures and never vibrates when reduced motion is requested', () => {
    expect(classifyGesture({ dx: NaN, dy: 0, elapsedMs: 10 })).toBe(null);
    expect(classifyGesture({ dx: 0, dy: 70, elapsedMs: -1 })).toBe(null);
    for (const kind of ['move', 'rotate', 'softDrop', 'hardDrop', 'drop', 'hold', 'lock', 'clear']) {
      expect(hapticDuration(kind, false)).toBeGreaterThan(0);
      expect(hapticDuration(kind, true)).toBe(0);
      expect(hapticDuration(kind, { matches: true })).toBe(0);
      expect(hapticDuration(kind, false, false)).toBe(0);
    }
    expect(hapticDuration('unknown')).toBe(0);
  });
});

describe('Turdtris rotation buffer', () => {
  it('consumes once within 120ms of the request', () => {
    const buffer = new RotationBuffer();
    expect(buffer.queue(1, 1000)).toBe(true);
    expect(buffer.consume(1120)).toBe(1);
    expect(buffer.consume(1121)).toBe(0);
    buffer.queue(-1, 1200);
    expect(buffer.consume(1321)).toBe(0);
  });

  it('keeps the most recent turn and clears on pause without replaying held input', () => {
    const buffer = new RotationBuffer();
    buffer.queue(1, 1000);
    buffer.queue(-1, 1050);
    expect(buffer.consume(1100)).toBe(-1);
    buffer.queue(1, 1200);
    buffer.clear();
    expect(buffer.consume(1201)).toBe(0);
    expect(buffer.queue(0, 1400)).toBe(false);
    expect(buffer.queue(1, NaN)).toBe(false);
    expect(buffer.consume(1400)).toBe(0);
  });

  it('does not retain requests when the clock moves backwards', () => {
    const buffer = new RotationBuffer();
    buffer.queue(1, 1000);
    expect(buffer.consume(999)).toBe(0);
    expect(buffer.consume(1001)).toBe(0);
  });
});

describe('Turdtris presentation-only run statistics', () => {
  it('defaults absent legacy continuation metadata without changing the snapshot', () => {
    const oldSnapshot = { score: 400, linesCleared: 4, level: 1 };
    expect(createRunStats(oldSnapshot.runStats)).toEqual({
      pieces: 0, elapsedMs: 0, maxCombo: 0, tetrises: 0, tSpins: 0, perfectClears: 0
    });
    expect(oldSnapshot).toEqual({ score: 400, linesCleared: 4, level: 1 });
  });

  it('counts locks and highlights without touching score, and calculates active-time PPS', () => {
    const initial = createRunStats({ elapsedMs: 2000 });
    const first = recordLock(initial, { lines: 4, combo: 3, perfect: true });
    const second = recordLock(first, { lines: 2, combo: 1, tSpin: true });
    expect(initial.pieces).toBe(0);
    expect(second).toEqual({ pieces: 2, elapsedMs: 2000, maxCombo: 3, tetrises: 1, tSpins: 1, perfectClears: 1 });
    expect(piecesPerSecond(second)).toBe(1);
    expect(piecesPerSecond(createRunStats())).toBe(0);
    expect(recordLock(second, { perfect: true }).perfectClears).toBe(1);
  });
});
