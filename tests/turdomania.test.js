import { describe, expect, it } from 'vitest';

import * as Core from '../games/turdomania-core.js';

const _ = null;

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    data
  };
}

describe('Turdomania seeded boards', () => {
  it('builds the same board for the same seed and a different one for another seed', () => {
    const a = Core.createBoard(10, 12, 4, 42);
    const b = Core.createBoard(10, 12, 4, 42);
    const c = Core.createBoard(10, 12, 4, 43);
    expect(Core.boardToRows(a, 12)).toEqual(Core.boardToRows(b, 12));
    expect(Core.boardToRows(a, 12)).not.toEqual(Core.boardToRows(c, 12));
  });

  it('only uses the requested number of kinds and fills every cell', () => {
    const board = Core.createBoard(12, 14, 5, 7);
    expect(board).toHaveLength(12);
    expect(Core.tileCount(board)).toBe(12 * 14);
    const kinds = new Set(board.flat().map((t) => t.kind));
    for (const k of kinds) {expect(k).toBeGreaterThanOrEqual(0);}
    for (const k of kinds) {expect(k).toBeLessThan(5);}
  });

  it('newGame records the level shape and falls back to normal on junk', () => {
    const g = Core.newGame('hard', 1);
    expect([g.cols, g.rows]).toEqual([12, 14]);
    expect(Core.newGame('nope', 1).level).toBe('normal');
  });
});

describe('Turdomania groups and scoring', () => {
  it('finds 4-neighbour groups only (no diagonals)', () => {
    const board = Core.boardFromRows([
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 1]
    ]);
    // Bottom-left tile is kind 1, alone.
    expect(Core.findGroup(board, 0, 0)).toHaveLength(1);
    // The 0s: (0,2),(0,1),(1,1),(1,0) connected; (2,2) is diagonal only.
    expect(Core.findGroup(board, 1, 1)).toHaveLength(4);
    expect(Core.findGroup(board, 2, 2)).toHaveLength(1);
  });

  it('scores (n - 2)^2', () => {
    expect([1, 2, 3, 4, 5, 10].map(Core.scoreForGroup)).toEqual([0, 0, 1, 4, 9, 64]);
  });

  it('refuses lone tiles and empty cells', () => {
    const board = Core.boardFromRows([
      [0, 1],
      [1, 0]
    ]);
    expect(Core.popGroup(board, 0, 0)).toBeNull();
    expect(Core.popGroup(board, 5, 5)).toBeNull();
    expect(Core.hasMoves(board)).toBe(false);
  });
});

describe('Turdomania gravity and column shift', () => {
  it('drops tiles above a popped group straight down', () => {
    const board = Core.boardFromRows([
      [2, 1],
      [0, 1],
      [0, 3]
    ]);
    const res = Core.popGroup(board, 0, 0);
    expect(res.removed).toHaveLength(2);
    expect(Core.boardToRows(res.board, 3)).toEqual([
      [_, 1],
      [_, 1],
      [2, 3]
    ]);
  });

  it('keeps tile identity while falling (needed for slide animations)', () => {
    const board = Core.boardFromRows([[2], [0], [0]]);
    const topId = board[0][2].id;
    const res = Core.popGroup(board, 0, 0);
    expect(res.board[0][0].id).toBe(topId);
  });

  it('slides columns on the right into an emptied column', () => {
    const board = Core.boardFromRows([
      [0, 1, 2],
      [0, 1, 3]
    ]);
    const res = Core.popGroup(board, 0, 0);
    expect(res.board).toHaveLength(2);
    expect(Core.boardToRows(res.board, 2)).toEqual([
      [1, 2],
      [1, 3]
    ]);
  });

  it('applyGravity and shiftColumns do not mutate their input', () => {
    const board = [
      [null, { id: 1, kind: 0 }],
      [null, null]
    ];
    const g = Core.applyGravity(board);
    const s = Core.shiftColumns(g);
    expect(board[0][0]).toBeNull();
    expect(board).toHaveLength(2);
    expect(g[0]).toEqual([{ id: 1, kind: 0 }]);
    expect(s).toHaveLength(1);
  });
});

describe('Turdomania game flow', () => {
  it('awards the clear bonus and ends the game when the board is flushed', () => {
    const state = {
      ...Core.newGame('easy', 1),
      board: Core.boardFromRows([[0, 0, 0, 0]]),
      rows: 1,
      cols: 4
    };
    const res = Core.play(state, 0, 0);
    expect(res.points).toBe(4);
    expect(res.state.cleared).toBe(true);
    expect(res.state.over).toBe(true);
    expect(res.state.score).toBe(4 + Core.CLEAR_BONUS);
    expect(Core.play(res.state, 0, 0)).toBeNull();
  });

  it('ends without a bonus when tiles are left but no pairs remain', () => {
    const state = {
      ...Core.newGame('easy', 1),
      board: Core.boardFromRows([
        [1, 2],
        [0, 0]
      ])
    };
    const res = Core.play(state, 0, 0);
    expect(res.state.over).toBe(true);
    expect(res.state.cleared).toBe(false);
    expect(res.state.score).toBe(0);
  });

  it('undo restores board, score and moves, and can be repeated to the start', () => {
    const start = Core.newGame('normal', 2026);
    let s = start;
    for (let i = 0; i < 3; i++) {
      let moved = false;
      for (let c = 0; c < s.board.length && !moved; c++) {
        for (let r = 0; r < s.board[c].length && !moved; r++) {
          const res = Core.play(s, c, r);
          if (res) {
            s = res.state;
            moved = true;
          }
        }
      }
    }
    expect(s.moves).toBe(3);
    s = Core.undo(Core.undo(Core.undo(s)));
    expect(s.moves).toBe(0);
    expect(s.score).toBe(0);
    expect(Core.boardToRows(s.board, s.rows)).toEqual(Core.boardToRows(start.board, start.rows));
    expect(Core.undo(s)).toBeNull();
  });
});

describe('Turdomania best score storage', () => {
  it('records only improvements per level', () => {
    const st = memoryStorage();
    expect(Core.recordBest(st, 'easy', 50)).toBe(true);
    expect(Core.recordBest(st, 'easy', 40)).toBe(false);
    expect(Core.readBest(st)).toEqual({ easy: 50, normal: 0, hard: 0 });
  });

  it('ignores corrupt or hostile stores', () => {
    expect(Core.readBest(memoryStorage({ [Core.BEST_KEY]: '{oops' }))).toEqual({
      easy: 0,
      normal: 0,
      hard: 0
    });
    const hostile = memoryStorage({
      [Core.BEST_KEY]: JSON.stringify({ v: 1, best: { easy: -5, normal: 'x', hard: 9 } })
    });
    expect(Core.readBest(hostile)).toEqual({ easy: 0, normal: 0, hard: 9 });
    expect(Core.recordBest(memoryStorage(), 'bogus', 10)).toBe(false);
  });
});
