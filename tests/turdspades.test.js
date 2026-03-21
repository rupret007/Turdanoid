import { describe, it, expect, beforeEach } from 'vitest';
import { TurdspadesEngine, RANK_VALUES } from '../games/turdspades-engine.js';

describe('TurdspadesEngine', () => {
  let game;

  beforeEach(() => {
    game = new TurdspadesEngine();
  });

  describe('Initialization', () => {
    it('should deal 13 cards to each of 4 players', () => {
      expect(game.hands[0].length).toBe(13);
      expect(game.hands[1].length).toBe(13);
      expect(game.hands[2].length).toBe(13);
      expect(game.hands[3].length).toBe(13);
    });

    it('should have 52 cards total in hands', () => {
      const total = game.hands.reduce((sum, hand) => sum + hand.length, 0);
      expect(total).toBe(52);
    });

    it('should initialize scores to zero', () => {
      expect(game.team1Score).toBe(0);
      expect(game.team2Score).toBe(0);
    });
  });

  describe('Card Values', () => {
    it('should return correct rank values', () => {
      expect(RANK_VALUES['2']).toBe(2);
      expect(RANK_VALUES['J']).toBe(11);
      expect(RANK_VALUES['Q']).toBe(12);
      expect(RANK_VALUES['K']).toBe(13);
      expect(RANK_VALUES['A']).toBe(14);
    });

    it('should get card value correctly', () => {
      expect(game.getCardValue({ rank: '10', suit: 'S' })).toBe(10);
      expect(game.getCardValue({ rank: 'A', suit: 'H' })).toBe(14);
    });
  });

  describe('Card Suit Detection', () => {
    it('should identify spades correctly', () => {
      expect(game.isSpade({ rank: 'A', suit: 'S' })).toBe(true);
      expect(game.isSpade({ rank: 'K', suit: 'H' })).toBe(false);
    });

    it('should return card suit', () => {
      expect(game.getCardSuit({ rank: '5', suit: 'D' })).toBe('D');
    });
  });

  describe('Suit Following', () => {
    it('should check if player has suit', () => {
      // Player 0 should always have some cards
      expect(game.hasSuit(0, 'S')).toBeDefined();
      expect(game.hasSuit(0, 'H')).toBeDefined();
    });

    it('should verify valid move follows suit', () => {
      // Add a spade to hand 0
      game.hands[0].push({ rank: 'A', suit: 'S' });
      game.hands[0].push({ rank: '2', suit: 'H' });
      
      // Can play spade when spade is lead
      expect(game.canFollowSuit({ rank: 'A', suit: 'S' }, 'S')).toBe(true);
      
      // Must follow suit if has it
      expect(game.canFollowSuit({ rank: '2', suit: 'H' }, 'S')).toBe(false); // Has H but S led
    });
  });

  describe('Play Flow', () => {
    it('should track current player', () => {
      expect(game.currentPlayer).toBe(0); // Player starts
    });

    it('should add card to trick when played', () => {
      const hand = game.hands[0];
      const cardIndex = 0;
      const card = hand[cardIndex];
      
      game.playCard(0, cardIndex);
      
      expect(game.trick.length).toBe(1);
      expect(game.trick[0].card).toBe(card);
    });

    it('should reject play from wrong player', () => {
      const result = game.playCard(1, 0); // CPU1 tries to play on Player 0's turn
      expect(result.valid).toBe(false);
    });
  });

  describe('Bidding', () => {
    it('should accept valid bid', () => {
      const result = game.declareBid(0, 5);
      expect(result).toBe(true);
      expect(game.declarations[0]).toBe(5);
    });

    it('should reject invalid bid', () => {
      const result = game.declareBid(0, 14); // More than 13 tricks
      expect(result).toBe(false);
    });

    it('should calculate CPU bid', () => {
      const bid = game.cpuDeclareBid(0);
      expect(bid).toBeGreaterThanOrEqual(0);
      expect(bid).toBeLessThanOrEqual(13);
    });
  });

  describe('Scoring', () => {
    it('should return team scores', () => {
      const score = game.getScore();
      expect(score.team1).toBe(0);
      expect(score.team2).toBe(0);
    });

    it('should detect game over', () => {
      expect(game.isGameOver()).toBe(false);
    });
  });
});
