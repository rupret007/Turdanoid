import { describe, it, expect } from 'vitest';
import { CrapeightsEngine } from '../games/crapeights-engine.js';

function fixture() {
  const game = new CrapeightsEngine();
  game.playerHand = [{ rank: '7', suit: 'H' }, { rank: '3', suit: 'C' }];
  game.cpuHand = [{ rank: '9', suit: 'D' }];
  game.discardPile = [{ rank: '5', suit: 'H' }];
  game.deck = [{ rank: '6', suit: 'S' }];
  game.currentSuit = 'H';
  game.lastPlayWasEight = false;
  return game;
}

describe('Crapeights player action guards', () => {
  for (const phase of ['cpu turn', 'finished game']) {
    for (const action of ['play', 'draw']) {
      it(`rejects ${action} during ${phase} without changing state`, () => {
        const game = fixture();
        if (phase === 'cpu turn') {
          game.currentPlayer = 'cpu';
        } else {
          game.gameOver = true;
          game.winner = 'cpu';
        }
        const before = JSON.stringify(game);
        const result = action === 'play'
          ? game.playCard(game.playerHand[0])
          : game.drawFromDeck();
        expect(JSON.stringify(game)).toBe(before);
        if (action === 'play') {
          expect(result.valid).toBe(false);
        } else {
          expect(result).toEqual({ card: null, canPlay: false });
        }
      });
    }
  }

  it('still plays a matching card on the player turn', () => {
    const game = fixture();
    expect(game.playCard(game.playerHand[0]).valid).toBe(true);
    expect(game.playerHand).toEqual([{ rank: '3', suit: 'C' }]);
    expect(game.currentPlayer).toBe('cpu');
  });

  it('still draws and ends the player turn for an unplayable card', () => {
    const game = fixture();
    expect(game.drawFromDeck()).toEqual({ card: { rank: '6', suit: 'S' }, canPlay: false });
    expect(game.playerHand).toHaveLength(3);
    expect(game.deck).toHaveLength(0);
    expect(game.currentPlayer).toBe('cpu');
  });
});
