import { describe, it, expect } from 'vitest';
import { peekUpcomingPieceNames, normalizePieceName } from '../games/turdtris-queue.js';

describe('turdtris-queue', () => {
  it('normalizes known piece letters', () => {
    expect(normalizePieceName('t')).toBe('T');
    expect(normalizePieceName(' bad ')).toBe(null);
  });

  it('lists immediate next then bag stack tail-first', () => {
    const sequence = ['Z', 'S', 'I'];
    expect(peekUpcomingPieceNames(sequence, 'O', 4)).toEqual(['O', 'I', 'S', 'Z']);
  });

  it('caps at five and tolerates missing next', () => {
    expect(peekUpcomingPieceNames(['J', 'L'], null, 5)).toEqual(['L', 'J']);
    expect(peekUpcomingPieceNames([], 'T', 9)).toEqual(['T']);
  });
});
