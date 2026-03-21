import { describe, it, expect } from 'vitest';
import { TurdtrisEngine } from '../games/turdtris-engine.js';

describe('TurdtrisEngine', () => {
  it('should initialize with a clean grid', () => {
    const game = new TurdtrisEngine(10, 20);
    expect(game.grid.length).toBe(20);
    expect(game.grid[0].length).toBe(10);
    expect(game.grid[0][0]).toBe(0);
  });

  it('7-Bag: should return a shuffled bag of all 7 pieces', () => {
    const game = new TurdtrisEngine();
    const sequence = [];
    for (let i = 0; i < 7; i++) {
      sequence.push(game.getNextPieceType());
    }
    
    // Check that all 7 pieces are present exactly once in the first 7 draws
    const expected = ["I", "J", "L", "O", "S", "Z", "T"];
    sequence.sort();
    expected.sort();
    expect(sequence).toEqual(expected);
  });

  it('Line Clear: should clear a full line and shift everything down', () => {
    const game = new TurdtrisEngine(10, 4);
    // Fill the bottom line
    game.grid[3] = new Array(10).fill(1);
    // Put a blocker in the second line
    game.grid[2][0] = 2;
    
    const cleared = game.clearLines();
    expect(cleared).toBe(1);
    expect(game.lines).toBe(1);
    // Block moved to bottom
    expect(game.grid[3][0]).toBe(2);
    // Top line is new (clean)
    expect(game.grid[0].every(c => c === 0)).toBe(true);
  });

  it('Collision: should detect wall collisions correctly', () => {
    const game = new TurdtrisEngine(10, 20);
    const piece = [[1, 1], [1, 1]]; // 2x2 Square (O-piece)
    
    // Valid move
    expect(game.isValidMove(piece, 0, 0)).toBe(true);
    
    // Wall (Left)
    expect(game.isValidMove(piece, 0, -1)).toBe(false);
    
    // Wall (Right)
    expect(game.isValidMove(piece, 0, 9)).toBe(false);
    
    // Floor
    expect(game.isValidMove(piece, 19, 0)).toBe(false);
  });

  it('Collision: should detect block collisions correctly', () => {
    const game = new TurdtrisEngine(10, 20);
    const piece = [[1, 1], [1, 1]];
    
    // Place a block in the grid
    game.grid[5][5] = 1;
    
    // Should collide if we move the 2x2 piece over (5,5)
    // Piece top-left at (4,4) covers cells: (4,4), (4,5), (5,4), (5,5)
    expect(game.isValidMove(piece, 4, 4)).toBe(false);
    
    // Should not collide if we move it next to it
    expect(game.isValidMove(piece, 4, 3)).toBe(true);
  });

  it('Score: should award points for line clears', () => {
    const game = new TurdtrisEngine();
    game.updateScore(1);
    expect(game.score).toBe(100);
    
    game.updateScore(4); // Tetris
    expect(game.score).toBe(100 + 800);
  });
});
