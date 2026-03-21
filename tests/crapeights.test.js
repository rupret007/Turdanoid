import { describe, it, expect, beforeEach } from 'vitest';
import { CrapeightsEngine, RANKS, SUITS } from '../games/crapeights-engine.js';

describe('CrapeightsEngine', () => {
  let game;

  beforeEach(() => {
    game = new CrapeightsEngine(1);
  });

  describe('Initialization', () => {
    it('should create a 52-card deck for single deck', () => {
      expect(game.deck.length).toBe(52);
    });

    it('should deal 5 cards to each player', () => {
      expect(game.playerHand.length).toBe(5);
      expect(game.cpuHand.length).toBe(5);
    });

    it('should have one card in discard pile', () => {
      expect(game.discardPile.length).toBe(1);
    });

    it('should set current suit from discard', () => {
      expect(game.currentSuit).toBeDefined();
    });
  });

  describe('Card Playing', () => {
    it('should allow playing card matching suit', () => {
      const topCard = game.getTopCard();
      const matchingCard = game.playerHand.find(c => c.suit === topCard.suit);
      
      if (matchingCard) {
        const result = game.playCard(matchingCard);
        expect(result.valid).toBe(true);
      }
    });

    it('should allow playing card matching rank', () => {
      const topCard = game.getTopCard();
      const matchingRankCard = game.playerHand.find(c => c.rank === topCard.rank && c.suit !== topCard.suit);
      
      if (matchingRankCard) {
        const result = game.playCard(matchingRankCard);
        expect(result.valid).toBe(true);
      }
    });

    it('should allow playing 8 anytime', () => {
      const eightCard = game.playerHand.find(c => c.rank === '8');
      
      if (eightCard) {
        const result = game.playCard(eightCard, 'H'); // Declare hearts
        expect(result.valid).toBe(true);
        expect(game.currentSuit).toBe('H');
      }
    });

    it('should not allow playing non-matching card', () => {
      const topCard = game.getTopCard();
      const nonMatchingCard = game.playerHand.find(
        c => c.suit !== topCard.suit && c.rank !== topCard.rank && c.rank !== '8'
      );
      
      if (nonMatchingCard) {
        const result = game.playCard(nonMatchingCard);
        expect(result.valid).toBe(false);
      }
    });
  });

  describe('Drawing', () => {
    it('should draw from deck when no playable cards', () => {
      // Clear hand and draw one card
      game.playerHand = [];
      game.drawFromDeck();
      expect(game.playerHand.length).toBe(1);
    });

    it('should add drawn card to hand', () => {
      const initialHandSize = game.playerHand.length;
      const result = game.drawFromDeck();
      
      expect(game.playerHand.length).toBe(initialHandSize + 1);
      expect(result.card).toBeDefined();
    });
  });

  describe('Game End', () => {
    it('should detect player win', () => {
      // Give player a single card and play it
      game.playerHand = [{ rank: '8', suit: 'S' }];
      game.discardPile = [{ rank: '7', suit: 'H' }];
      game.currentSuit = 'H';
      
      const result = game.playCard(game.playerHand[0], 'S');
      
      expect(result.valid).toBe(true);
      expect(game.gameOver).toBe(true);
      expect(game.winner).toBe('player');
    });

    it('should detect CPU win', () => {
      game.cpuHand = [{ rank: '8', suit: 'S' }];
      game.discardPile = [{ rank: '7', suit: 'H' }];
      game.currentSuit = 'H';
      game.currentPlayer = 'cpu';
      
      // Simulate CPU playing their winning card
      game.discardPile.push(game.cpuHand.pop());
      
      expect(game.cpuHand.length).toBe(0);
      expect(game.gameOver).toBe(true);
      expect(game.winner).toBe('cpu');
    });
  });

  describe('Turn Management', () => {
    it('should switch from player to CPU', () => {
      game.currentPlayer = 'player';
      game.switchTurn();
      expect(game.currentPlayer).toBe('cpu');
    });

    it('should switch from CPU to player', () => {
      game.currentPlayer = 'cpu';
      game.switchTurn();
      expect(game.currentPlayer).toBe('player');
    });
  });

  describe('Deck Management', () => {
    it('should reshuffle discard when deck is empty', () => {
      game.deck = [];
      game.discardPile = [{ rank: '7', suit: 'H' }, { rank: '8', suit: 'S' }];
      
      game.reshuffleDiscard();
      
      expect(game.deck.length).toBe(1);
      expect(game.discardPile.length).toBe(1);
    });
  });
});
