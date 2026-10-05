import { describe, it, expect } from 'vitest';
import { computeDiscardSafety, SAFETY_WEIGHTS } from '../games/turdrummy-ai.js';

const card = (suit, rank, id) => ({ suit, rank, id: id || `${suit}${rank}` });

describe('computeDiscardSafety', () => {
  it('is 0 with no discard history', () => {
    expect(computeDiscardSafety([], card('H', 7))).toBe(0);
    expect(computeDiscardSafety(null, card('H', 7))).toBe(0);
  });

  it('rewards cards whose rank is already dead in the pile', () => {
    const history = [card('C', 7), card('D', 7)];
    const safety = computeDiscardSafety(history, card('H', 7));
    expect(safety).toBe(2 * SAFETY_WEIGHTS.deadRank);
  });

  it('rewards cards whose same-suit run neighbors are already dead', () => {
    const history = [card('H', 5), card('H', 9)];
    // H7: H5 is two away (dead neighbor), H9 is two away (dead neighbor)
    const safety = computeDiscardSafety(history, card('H', 7));
    expect(safety).toBe(2 * SAFETY_WEIGHTS.deadNeighbor);
  });

  it('ignores cards three or more ranks away in the same suit', () => {
    const history = [card('H', 2)];
    expect(computeDiscardSafety(history, card('H', 7))).toBe(0);
  });

  it('ignores same-rank-or-neighbor cards in a different suit for the neighbor check', () => {
    const history = [card('D', 6)];
    expect(computeDiscardSafety(history, card('H', 7))).toBe(0);
  });

  it('never counts the card itself even if present in the history by id', () => {
    const target = card('H', 7);
    const safety = computeDiscardSafety([target], target);
    expect(safety).toBe(0);
  });

  it('combines rank and neighbor signals', () => {
    const history = [card('C', 7), card('H', 6), card('H', 8), card('S', 2)];
    const safety = computeDiscardSafety(history, card('H', 7));
    expect(safety).toBe(1 * SAFETY_WEIGHTS.deadRank + 2 * SAFETY_WEIGHTS.deadNeighbor);
  });
});
