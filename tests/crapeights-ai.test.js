import { describe, expect, it } from 'vitest';
import '../games/crapeights-ai.js';
import { CONTINUE_KEY, loadContinue, validateEightsSnapshot } from '../games/table-continue.js';
import { validEightsSnapshot } from './continue-fixtures.js';

const { chooseCard, chooseSuit, createMemory, observe } = globalThis.CrapeightsAI;
const card = (rank, suit, id) => ({ rank, suit, id });

function decide(hand, options = {}) {
  return chooseCard({
    hand, playableCards: hand.filter((c) => c.suit === 'H' || c.rank === '8'),
    playerIndex: 0, counts: [hand.length, 7, 7, 7], direction: 1,
    activeSuit: 'H', topCard: card('6', 'H', 52), ...options
  });
}

describe('Crappy Eights fair table AI', () => {
  it('preserves a wild escape when a safe ordinary play exists', () => {
    const hand = [card('8', 'S', 1), card('10', 'H', 2), card('5', 'H', 3), card('Q', 'D', 4)];
    expect(decide(hand).rank).not.toBe('8');
  });

  it('sheds a wild worth 50 when an opponent is about to go out', () => {
    const hand = [card('8', 'S', 1), card('10', 'H', 2), card('5', 'H', 3), card('Q', 'D', 4)];
    expect(decide(hand, { counts: [4, 1, 7, 7] })).toBe(hand[0]);
  });

  it('denies the next opponent a winning turn before shedding wild points', () => {
    const hand = [card('8', 'S', 1), card('2', 'H', 2), card('5', 'H', 3), card('Q', 'D', 4)];
    expect(decide(hand, { counts: [4, 1, 7, 7] })).toBe(hand[1]);
  });

  it('uses suit continuity and rank bridges when switching suits', () => {
    const hand = [card('7', 'H', 1), card('7', 'D', 2), card('4', 'D', 3), card('K', 'D', 4), card('3', 'S', 5)];
    expect(decide(hand, { activeSuit: 'C', topCard: card('7', 'C', 52), playableCards: hand.slice(0, 2) })).toBe(hand[1]);
  });

  it('reverses away from a one-card opponent in either direction', () => {
    const hand = [card('Q', 'H', 1), card('7', 'H', 2), card('4', 'S', 3), card('9', 'D', 4)];
    expect(decide(hand, { counts: [4, 1, 7, 7] })).toBe(hand[0]);
    expect(decide(hand, { direction: -1, counts: [4, 7, 7, 1] })).toBe(hand[0]);
  });

  it('avoids reversing into an opponent who can go out', () => {
    const hand = [card('Q', 'H', 1), card('7', 'H', 2), card('4', 'S', 3), card('9', 'D', 4)];
    expect(decide(hand, { counts: [4, 7, 7, 1] })).toBe(hand[1]);
  });

  it('does not blindly skip a safe opponent to give a one-card opponent the turn', () => {
    const hand = [card('J', 'H', 1), card('7', 'H', 2), card('4', 'S', 3), card('9', 'D', 4)];
    expect(decide(hand, { counts: [4, 7, 1, 7] })).toBe(hand[1]);
  });

  it('wins immediately even when the final card is wild', () => {
    const hand = [card('8', 'S', 1)];
    expect(decide(hand)).toBe(hand[0]);
  });

  it('counts actual suit cards, excluding wilds and the departing card', () => {
    const hand = [card('8', 'S', 1), card('8', 'S', 2), card('3', 'H', 3)];
    expect(chooseSuit(hand, 1)).toBe('H');
    expect(['S', 'H', 'D', 'C']).toContain(chooseSuit([], undefined));
  });

  it('uses public passes to break a suit tie, and removes the clue after that suit is played', () => {
    const memory = createMemory();
    const hand = [card('7', 'S', 1), card('7', 'H', 2)];
    observe(memory, { playerIndex: 1, type: 'pass', suit: 'H' });
    expect(chooseSuit(hand, undefined, { nextPlayerIndex: 1, memory })).toBe('H');
    observe(memory, { playerIndex: 1, type: 'play', suit: 'H', rank: 'K' });
    expect(chooseSuit(hand, undefined, { nextPlayerIndex: 1, memory })).toBe('S');
  });

  it('uses observed weakness for ordinary plays and expires old evidence', () => {
    const memory = createMemory();
    const hand = [card('7', 'S', 1), card('7', 'H', 2)];
    observe(memory, { playerIndex: 1, type: 'pass', suit: 'H' });
    const options = { playableCards: hand, topCard: card('7', 'C', 52), activeSuit: 'C', memory };
    expect(decide(hand, options)).toBe(hand[1]);
    const initialClue = memory.seats[1].shortSuits.H;
    for (let i = 0; i < 30; i += 1) {
      observe(memory, { playerIndex: 2, type: 'play', suit: 'D', rank: '4' });
    }
    expect(memory.seats[1].shortSuits.H).toBeLessThan(initialClue / 20);
  });

  it('bounds inference and ignores skipped turns or invalid observations', () => {
    const memory = createMemory();
    observe(memory, { playerIndex: 1, type: 'skip', suit: 'H' });
    observe(memory, { playerIndex: -1, type: 'pass', suit: 'H' });
    expect(memory).toEqual(createMemory());
    for (let i = 0; i < 20; i += 1) {
      observe(memory, { playerIndex: 1, type: 'pass', suit: 'H' });
    }
    expect(memory.seats[1].shortSuits.H).toBeLessThanOrEqual(2);
  });

  it('is deterministic, does not mutate inputs and never reads hidden hands', () => {
    const hand = Object.freeze([Object.freeze(card('7', 'S', 1)), Object.freeze(card('7', 'H', 2))]);
    const counts = Object.freeze([2, 4, 5, 6]);
    const memory = createMemory();
    const before = JSON.stringify(memory);
    const options = {
      hand, playableCards: hand, counts, activeSuit: 'C', topCard: card('7', 'C', 52), memory,
      get hiddenHands() { throw new Error('AI must never peek at another hand'); }
    };
    expect(chooseCard(options)).toBe(hand[0]);
    options.playableCards = [hand[1], hand[0]];
    expect(chooseCard(options)).toBe(hand[0]);
    expect(JSON.stringify(memory)).toBe(before);
  });

  it('returns only legal held cards and handles empty choices', () => {
    const held = card('4', 'D', 1);
    expect(decide([held], { playableCards: [held, card('8', 'S', 99)] })).toBeNull();
    expect(chooseCard({ hand: [], playableCards: [] })).toBeNull();
  });
});

describe('Crappy Eights b3821b4 continue compatibility', () => {
  it('loads the unchanged v1 fixture and makes a move without added snapshot fields', () => {
    const original = validEightsSnapshot();
    const stored = JSON.stringify({ v: 1, games: { 'crapeights.html': { updatedAt: 1, snapshot: original } } });
    const storage = { getItem: (key) => key === CONTINUE_KEY ? stored : null };
    const restored = loadContinue(storage, 'crapeights.html');
    expect(restored).toEqual(original);
    const hand = restored.players[restored.currentPlayer].hand;
    const topCard = restored.discard.at(-1);
    const playableCards = hand.filter((c) => c.rank === '8' || c.suit === restored.activeSuit || c.rank === topCard.rank);
    const chosen = chooseCard({
      hand, playableCards, playerIndex: restored.currentPlayer,
      counts: restored.players.map((p) => p.hand.length), direction: restored.direction,
      activeSuit: restored.activeSuit, topCard, memory: createMemory()
    });
    expect(playableCards).toContain(chosen);
    expect(validateEightsSnapshot(restored)).toEqual(original);
    expect(restored).not.toHaveProperty('memory');
  });
});
