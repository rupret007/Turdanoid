import { describe, it, expect } from 'vitest';
import { createShoe, handValue, getCardValue } from './cards';

describe('Card Logic', () => {
  it('creates a shoe with the correct number of cards', () => {
    const oneDeck = createShoe(1);
    expect(oneDeck.length).toBe(52);

    const fourDecks = createShoe(4);
    expect(fourDecks.length).toBe(208);
  });

  it('calculates blackjack values correctly', () => {
    expect(getCardValue({ rank: 'A' })).toBe(11);
    expect(getCardValue({ rank: 'K' })).toBe(10);
    expect(getCardValue({ rank: '7' })).toBe(7);
  });

  it('calculates hand values with aces correctly', () => {
    const hand1 = [{ rank: 'A' }, { rank: '10' }]; // Blackjack
    expect(handValue(hand1)).toBe(21);

    const hand2 = [{ rank: 'A' }, { rank: 'A' }, { rank: '9' }]; // Soft 11 or Hard 11
    // A(11) + A(11) + 9 = 31 -> A(1) + A(11) + 9 = 21
    expect(handValue(hand2)).toBe(21);

    const hand3 = [{ rank: 'A' }, { rank: '5' }, { rank: 'K' }];
    // A(11) + 5 + 10 = 26 -> A(1) + 5 + 10 = 16
    expect(handValue(hand3)).toBe(16);
  });
});
