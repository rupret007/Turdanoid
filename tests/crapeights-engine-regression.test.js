import { describe, expect, it } from 'vitest';
import { CrapeightsEngine } from '../games/crapeights-engine.js';

function cpuTurn() {
  const game = new CrapeightsEngine();
  game.currentPlayer = 'cpu';
  game.discardPile = [{ rank: '6', suit: 'H' }];
  game.currentSuit = 'H';
  game.cpuHand = [{ rank: '4', suit: 'D' }];
  return game;
}

describe('Crappy Eights legacy engine regressions', () => {
  it('hands control back after the CPU immediately plays its drawn card', () => {
    const game = cpuTurn();
    const drawn = { rank: 'K', suit: 'H' };
    game.deck = [drawn];
    game.lastPlayWasEight = true;
    expect(game.cpuPlay()).toEqual({ action: 'draw', card: drawn });
    expect(game.currentPlayer).toBe('player');
    expect(game.cpuHand).toEqual([{ rank: '4', suit: 'D' }]);
    expect(game.getTopCard()).toBe(drawn);
    expect(game.lastPlayWasEight).toBe(false);
  });

  it('declares a suit and completes the turn after drawing a wild', () => {
    const game = cpuTurn();
    game.deck = [{ rank: '8', suit: 'S' }];
    game.cpuPlay();
    expect(game.currentSuit).toBe('D');
    expect(game.lastPlayWasEight).toBe(true);
    expect(game.currentPlayer).toBe('player');
  });

  it('recognizes an empty hand after playing a drawn card', () => {
    const game = cpuTurn();
    game.cpuHand = [];
    game.deck = [{ rank: '9', suit: 'H' }];
    game.cpuPlay();
    expect(game.gameOver).toBe(true);
    expect(game.winner).toBe('cpu');
    expect(game.cpuPlay()).toBeNull();
  });

  it('passes an exhausted CPU draw without adding undefined to its hand', () => {
    const game = cpuTurn();
    game.deck = [];
    expect(game.cpuPlay()).toEqual({ action: 'draw', card: null });
    expect(game.cpuHand).toEqual([{ rank: '4', suit: 'D' }]);
    expect(game.currentPlayer).toBe('player');
  });

  it('passes an exhausted human draw without corrupting the hand', () => {
    const game = cpuTurn();
    game.currentPlayer = 'player';
    game.deck = [];
    const before = [...game.playerHand];
    expect(game.drawFromDeck()).toEqual({ card: null, canPlay: false });
    expect(game.playerHand).toEqual(before);
    expect(game.currentPlayer).toBe('cpu');
    expect(game.canPlayCard(undefined)).toBe(false);
  });

  it('keeps legacy jacks, queens and twos as ordinary suit matches', () => {
    for (const rank of ['J', 'Q', '2']) {
      const game = cpuTurn();
      game.cpuHand = [{ rank, suit: 'H' }, { rank: '5', suit: 'S' }];
      const playerSize = game.playerHand.length;
      game.cpuPlay();
      expect(game.playerHand.length).toBe(playerSize);
      expect(game.direction).toBe(1);
      expect(game.currentPlayer).toBe('player');
    }
  });
});
