import { describe, it, expect } from 'vitest';
import { rotate, isValidMove, calculateScore, TETROMINOS } from '../games/turdtris_logic';

describe('Turdtris Core Logic', () => {
  it('rotates a matrix correctly clockwise', () => {
    const T = TETROMINOS.T;
    const rotated = rotate(T, 1);
    // T-piece center is at [1,1].
    // Original: [[0,1,0],[1,1,1],[0,0,0]]
    // Rotated CW: [[0,1,0],[0,1,1],[0,1,0]]
    expect(rotated[1][2]).toBe(1);
    expect(rotated[2][1]).toBe(1);
    expect(rotated[0][1]).toBe(1);
  });

  it('detects collisions with walls', () => {
    const playfield = Array(20).fill(0).map(() => Array(10).fill(0));
    const I = TETROMINOS.I;
    // Moving I-piece off left edge
    expect(isValidMove(I, 0, -2, playfield)).toBe(false);
    // Moving I-piece off right edge
    expect(isValidMove(I, 0, 8, playfield)).toBe(false);
    // valid position
    expect(isValidMove(I, 0, 3, playfield)).toBe(true);
  });

  it('calculates score with level and B2B multipliers', () => {
    // Single line at level 1
    expect(calculateScore(1, 1)).toBe(100);
    // Tetris (4 lines) at level 2
    expect(calculateScore(4, 2)).toBe(1600);
    // B2B Tetris at level 1
    expect(calculateScore(4, 1, false, true)).toBe(1200);
  });
});
