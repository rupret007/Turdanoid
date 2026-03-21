import { describe, it, expect } from 'vitest';
import { TurdjackEngine, DEFAULT_RULES, MIN_BET, INITIAL_BANKROLL } from '../games/turdjack-engine.js';

describe('TurdjackEngine', () => {
  describe('Initialization', () => {
    it('should create a shoe with correct number of cards', () => {
      const game = new TurdjackEngine();
      // 4 decks * 52 cards = 208
      expect(game.shoe.length).toBe(208);
    });

    it('should initialize with default bankroll', () => {
      const game = new TurdjackEngine();
      expect(game.bankroll).toBe(INITIAL_BANKROLL);
    });

    it('should use custom bankroll when provided', () => {
      const game = new TurdjackEngine(DEFAULT_RULES, 500);
      expect(game.bankroll).toBe(500);
    });

    it('should initialize stats to zero', () => {
      const game = new TurdjackEngine();
      expect(game.stats.hands).toBe(0);
      expect(game.stats.wins).toBe(0);
      expect(game.stats.losses).toBe(0);
    });
  });

  describe('Card Values', () => {
    it('should calculate face card values as 10', () => {
      const game = new TurdjackEngine();
      expect(game.getCardValue({ rank: 'K', suit: 'S' })).toBe(10);
      expect(game.getCardValue({ rank: 'Q', suit: 'H' })).toBe(10);
      expect(game.getCardValue({ rank: 'J', suit: 'D' })).toBe(10);
    });

    it('should calculate number cards correctly', () => {
      const game = new TurdjackEngine();
      expect(game.getCardValue({ rank: '2', suit: 'S' })).toBe(2);
      expect(game.getCardValue({ rank: '9', suit: 'H' })).toBe(9);
    });

    it('should calculate Ace as 11', () => {
      const game = new TurdjackEngine();
      expect(game.getCardValue({ rank: 'A', suit: 'S' })).toBe(11);
    });
  });

  describe('Hand Value', () => {
    it('should calculate simple hand value', () => {
      const game = new TurdjackEngine();
      const hand = [
        { rank: '5', suit: 'S' },
        { rank: '8', suit: 'H' }
      ];
      expect(game.getHandValue(hand)).toBe(13);
    });

    it('should count Ace as 1 when hand busts', () => {
      const game = new TurdjackEngine();
      const hand = [
        { rank: 'A', suit: 'S' },
        { rank: 'K', suit: 'H' },
        { rank: '9', suit: 'D' }
      ];
      // A(11) + K(10) + 9 = 30, busts, A becomes 1 = 20
      expect(game.getHandValue(hand)).toBe(20);
    });

    it('should recognize blackjack', () => {
      const game = new TurdjackEngine();
      const hand = [
        { rank: 'A', suit: 'S' },
        { rank: 'K', suit: 'H' }
      ];
      expect(game.isBlackjack(hand)).toBe(true);
    });

    it('should not recognize 21 as blackjack', () => {
      const game = new TurdjackEngine();
      const hand = [
        { rank: '10', suit: 'S' },
        { rank: '9', suit: 'H' },
        { rank: '2', suit: 'D' }
      ];
      expect(game.isBlackjack(hand)).toBe(false);
    });
  });

  describe('Betting', () => {
    it('should place valid bet', () => {
      const game = new TurdjackEngine();
      const result = game.placeBet(100);
      expect(result).toBe(true);
      expect(game.currentBet).toBe(100);
      expect(game.bankroll).toBe(INITIAL_BANKROLL - 100);
    });

    it('should reject bet below minimum', () => {
      const game = new TurdjackEngine();
      const result = game.placeBet(5);
      expect(result).toBe(false);
    });

    it('should reject bet exceeding bankroll', () => {
      const game = new TurdjackEngine();
      const result = game.placeBet(INITIAL_BANKROLL + 100);
      expect(result).toBe(false);
    });
  });

  describe('Game Flow', () => {
    it('should start round with 2 cards each', () => {
      const game = new TurdjackEngine();
      game.placeBet(100);
      game.startRound();
      
      expect(game.playerHand.length).toBe(2);
      expect(game.dealerHand.length).toBe(2);
      expect(game.roundActive).toBe(true);
      expect(game.stats.hands).toBe(1);
    });

    it('should draw a card on hit', () => {
      const game = new TurdjackEngine();
      game.placeBet(100);
      game.startRound();
      const initialHandSize = game.playerHand.length;
      game.hit();
      
      expect(game.playerHand.length).toBe(initialHandSize + 1);
    });

    it('should end round on stand', () => {
      const game = new TurdjackEngine();
      game.placeBet(100);
      game.startRound();
      game.stand();
      
      expect(game.roundActive).toBe(false);
    });

    it('should resolve blackjack immediately', () => {
      const game = new TurdjackEngine({ blackjackPayout: 1.5 }, 1000);
      game.placeBet(100);
      
      // Force a blackjack by manipulating hands
      game.playerHand = [{ rank: 'A', suit: 'S' }, { rank: 'K', suit: 'H' }];
      game.dealerHand = [{ rank: '5', suit: 'S' }, { rank: '8', suit: 'H' }];
      game.roundActive = true;
      
      game.resolveRound();
      
      expect(game.stats.blackjacks).toBe(1);
    });
  });

  describe('Surrender', () => {
    it('should allow surrender when enabled', () => {
      const game = new TurdjackEngine({ allowSurrender: true }, 1000);
      game.placeBet(100);
      game.startRound();
      
      const result = game.surrender();
      expect(result).toBe(true);
      expect(game.roundActive).toBe(false);
      expect(game.stats.surrenders).toBe(1);
      // Half bet returned
      expect(game.bankroll).toBe(950); // 1000 - 100 + 50
    });

    it('should not allow surrender when disabled', () => {
      const game = new TurdjackEngine({ allowSurrender: false }, 1000);
      game.placeBet(100);
      game.startRound();
      
      const result = game.surrender();
      expect(result).toBe(false);
    });
  });

  describe('Split', () => {
    it('should allow split with pair and sufficient bankroll', () => {
      const game = new TurdjackEngine({ allowHitSplitAces: true }, 1000);
      game.placeBet(100);
      game.startRound();
      
      // Force a pair
      game.playerHand = [{ rank: '8', suit: 'S' }, { rank: '8', suit: 'H' }];
      
      const result = game.split();
      expect(result).toBe(true);
      expect(game.splitRound).toBe(true);
      expect(game.splitHand.length).toBe(2);
      expect(game.playerHand.length).toBe(2);
    });

    it('should not allow split without pair', () => {
      const game = new TurdjackEngine();
      game.placeBet(100);
      game.startRound();
      
      game.playerHand = [{ rank: '8', suit: 'S' }, { rank: '9', suit: 'H' }];
      
      const result = game.split();
      expect(result).toBe(false);
    });
  });
});
