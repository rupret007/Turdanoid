import { describe, it, expect } from 'vitest';
import { CrapeightsEngine } from '../games/crapeights-engine.js';

function fixture(lastCard = false) {
  const game = new CrapeightsEngine();
  game.playerHand = [{ rank: '8', suit: 'S' }];
  if (!lastCard) {game.playerHand.push({ rank: '3', suit: 'C' });}
  game.cpuHand = [{ rank: '9', suit: 'D' }];
  game.discardPile = [{ rank: '5', suit: 'H' }];
  game.deck = [{ rank: '6', suit: 'S' }];
  game.currentSuit = 'H';
  game.lastPlayWasEight = false;
  return game;
}

describe('Crapeights eight suit declaration', () => {
  for (const lastCard of [false, true]) {
    describe(lastCard ? 'last card' : 'ongoing hand', () => {
      it.each(['ZZ', '', 's', 'h', 'd', 'c', 'X', 'Hearts', ' H ', null, undefined])(
        'rejects declared suit %j without changing any game state',
        (suit) => {
          const game = fixture(lastCard);
          const before = JSON.stringify(game);
          const result = game.playCard(game.playerHand[0], suit);
          expect(result.valid).toBe(false);
          expect(JSON.stringify(game)).toBe(before);
        }
      );

      it('rejects an omitted suit without changing any game state', () => {
        const game = fixture(lastCard);
        const before = JSON.stringify(game);
        expect(game.playCard(game.playerHand[0]).valid).toBe(false);
        expect(JSON.stringify(game)).toBe(before);
      });

      it.each(['S', 'H', 'D', 'C'])('accepts declared suit %s', (suit) => {
        const game = fixture(lastCard);
        const eight = game.playerHand[0];
        expect(game.playCard(eight, suit).valid).toBe(true);
        expect(game.playerHand).toEqual(lastCard ? [] : [{ rank: '3', suit: 'C' }]);
        expect(game.discardPile).toEqual([{ rank: '5', suit: 'H' }, eight]);
        expect(game.currentSuit).toBe(suit);
        expect(game.lastPlayWasEight).toBe(true);
        expect(game.currentPlayer).toBe(lastCard ? 'player' : 'cpu');
        expect(game.gameOver).toBe(lastCard);
        expect(game.winner).toBe(lastCard ? 'player' : null);
      });
    });
  }
});
