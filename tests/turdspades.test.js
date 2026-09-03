import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MATCH_TARGET,
  RANK_VALUES,
  TurdspadesEngine,
  pickNilCoverCard,
  scoreSpadesTeamRound,
  shouldBidNil
} from '../games/turdspades-engine.js';

const livePage = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'turdspades.html'),
  'utf8'
);

const safeNilHand = [
  { rank: '2', suit: 'S' },
  { rank: '3', suit: 'S' },
  { rank: '4', suit: 'S' },
  { rank: '2', suit: 'H' },
  { rank: '5', suit: 'H' },
  { rank: '8', suit: 'H' },
  { rank: '10', suit: 'H' },
  { rank: '3', suit: 'D' },
  { rank: '6', suit: 'D' },
  { rank: '9', suit: 'D' },
  { rank: 'Q', suit: 'D' },
  { rank: '2', suit: 'C' },
  { rank: '7', suit: 'C' }
];

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

    it('recognizes a deliberately low-risk Nil hand', () => {
      expect(shouldBidNil(safeNilHand)).toBe(true);
      expect(shouldBidNil([...safeNilHand.slice(0, 12), { rank: 'A', suit: 'C' }])).toBe(false);
      expect(shouldBidNil([...safeNilHand.slice(0, 12), { rank: 'J', suit: 'S' }])).toBe(false);
    });

    it('covers a partner Nil winner with the cheapest overtake', () => {
      const legal = [
        { rank: '3', suit: 'H' },
        { rank: 'Q', suit: 'H' },
        { rank: 'K', suit: 'H' }
      ];
      const cover = pickNilCoverCard(legal, {
        partnerBid: 0,
        winnerPlayer: 2,
        partner: 2,
        cardBeatsWinner: (card) => RANK_VALUES[card.rank] > 9
      });

      expect(cover).toMatchObject({ rank: 'Q', suit: 'H' });
    });

    it('covers using numeric ranks from the live table', () => {
      const cover = pickNilCoverCard(
        [
          { id: 'low', rank: 3, suit: 'H' },
          { id: 'cover', rank: 12, suit: 'H' },
          { id: 'ace', rank: 14, suit: 'H' }
        ],
        {
          partnerBid: 0,
          winnerPlayer: 3,
          partner: 3,
          cardBeatsWinner: (card) => card.rank > 9
        }
      );

      expect(cover.id).toBe('cover');
    });

    it('does not cover when the partner is not winning or not on Nil', () => {
      const legal = [{ rank: 'A', suit: 'H' }];
      expect(
        pickNilCoverCard(legal, {
          partnerBid: 4,
          winnerPlayer: 2,
          partner: 2,
          cardBeatsWinner: () => true
        })
      ).toBeNull();
      expect(
        pickNilCoverCard(legal, {
          partnerBid: 0,
          winnerPlayer: 1,
          partner: 2,
          cardBeatsWinner: () => true
        })
      ).toBeNull();
      expect(
        pickNilCoverCard(legal, {
          partnerBid: 0,
          winnerPlayer: 2,
          partner: 2,
          cardBeatsWinner: () => false
        })
      ).toBeNull();
    });

    it('lets a bot call Nil only when its hand passes the risk gate', () => {
      game.hands[1] = safeNilHand.map((card) => ({ ...card }));

      expect(game.cpuDeclareBid(1)).toBe(0);
      expect(game.declarations[1]).toBe(0);
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

    it('awards a made Nil separately from the partnership contract', () => {
      const result = scoreSpadesTeamRound({ bids: [0, 4], tricks: [0, 5], bags: 8 });

      expect(result).toMatchObject({
        contractBid: 4,
        tricksTaken: 5,
        contractMade: true,
        contractPoints: 41,
        nilPoints: 100,
        overtricks: 1,
        bags: 9,
        bagPenalties: 0,
        delta: 141
      });
      expect(result.nilResults).toEqual([
        { playerIndex: 0, succeeded: true, tricks: 0, points: 100 }
      ]);
    });

    it('charges a failed Nil and counts those tricks toward bags', () => {
      const result = scoreSpadesTeamRound({ bids: [0, 4], tricks: [2, 4], bags: 8 });

      expect(result).toMatchObject({
        contractBid: 4,
        tricksTaken: 6,
        contractPoints: 42,
        nilPoints: -100,
        overtricks: 2,
        bags: 0,
        bagPenalties: 1,
        delta: -158
      });
      expect(result.nilResults[0]).toMatchObject({ succeeded: false, tricks: 2, points: -100 });
    });

    it('still awards a made Nil when the partnership misses its contract', () => {
      expect(scoreSpadesTeamRound({ bids: [0, 6], tricks: [0, 5] }).delta).toBe(40);
    });

    it('ships paced bot turns, blur pause, and partner Nil cover on the live table', () => {
      expect(livePage).toContain('function pickNilCoverCard');
      expect(livePage).toContain('function scheduleAiIfNeeded');
      expect(livePage).toContain('function suspendPlayForBackground');
      expect(livePage).toContain("window.addEventListener('blur', suspendPlayForBackground)");
      expect(livePage).not.toContain('guard < 80');
    });

    it('uses the shipped 250-point target and redeals cleanly after scoring', () => {
      game.declarations = [0, 3, 4, 3];
      game.actualTricks = [0, 3, 5, 5];
      game.team1Score = MATCH_TARGET - 1;
      game.resolveRound();

      expect(game.lastRoundResult.team1.delta).toBe(141);
      expect(game.team1Score).toBe(390);
      expect(game.gameOver).toBe(true);
      expect(game.winner).toBe('team1');
      expect(game.hands.every((hand) => hand.length === 13)).toBe(true);
    });
  });
});
