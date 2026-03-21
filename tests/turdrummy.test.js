import { describe, it, expect } from 'vitest';
import { TurdRummyEngine } from '../games/turdrummy-engine.js';

describe('TurdRummyEngine', () => {
  it('should create a full 52-card deck', () => {
    const game = new TurdRummyEngine();
    expect(game.deck.length).toBe(52);
  });

  it('Deal: should deal 10 cards to each player and 1 to discard', () => {
    const game = new TurdRummyEngine();
    game.deal();
    expect(game.playerHand.length).toBe(10);
    expect(game.aiHand.length).toBe(10);
    expect(game.discardPile.length).toBe(1);
    expect(game.stockPile.length).toBe(31); // 52 - 10 - 10 - 1
  });

  it('Meld: should find sets (3 or 4 of a kind)', () => {
    const game = new TurdRummyEngine();
    const hand = [
      { suit: 'C', rank: 5 },
      { suit: 'D', rank: 5 },
      { suit: 'H', rank: 5 },
      { suit: 'S', rank: 9 },
    ];
    const sets = game.findSets(hand);
    expect(sets.length).toBe(1);
    expect(sets[0].length).toBe(3);
  });

  it('Meld: should find runs (3 or more same suit in order)', () => {
    const game = new TurdRummyEngine();
    const hand = [
      { suit: 'H', rank: 7 },
      { suit: 'H', rank: 8 },
      { suit: 'H', rank: 9 },
      { suit: 'C', rank: 2 },
    ];
    const runs = game.findRuns(hand);
    expect(runs.length).toBe(1);
    expect(runs[0].length).toBe(3);
  });

  it('Deadwood: should calculate face cards as 10 and aces as 1', () => {
    const game = new TurdRummyEngine();
    const hand = [
      { suit: 'S', rank: 1 },  // Ace = 1
      { suit: 'S', rank: 11 }, // Jack = 10
      { suit: 'S', rank: 12 }, // Queen = 10
      { suit: 'S', rank: 13 }, // King = 10
      { suit: 'S', rank: 5 },  // 5 = 5
    ];
    const score = game.calculateDeadwood(hand);
    expect(score).toBe(1 + 10 + 10 + 10 + 5); // 36
  });
});
