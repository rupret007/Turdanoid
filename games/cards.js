/**
 * Shared card game logic for Turdanoid
 */

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUITS = ['S', 'H', 'D', 'C'];

/**
 * Creates a shuffled deck of cards.
 * @param {number} decks - Number of 52-card decks to include.
 * @returns {Array} Shuffled array of card objects {rank, suit}.
 */
export function createShoe(decks = 1) {
  const next = [];

  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        next.push({ rank, suit });
      }
    }
  }

  // Fisher-Yates Shuffle
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }

  return next;
}

/**
 * Calculates the Blackjack value of a card.
 */
export function getBlackjackValue(card) {
  if (!card) return 0;
  if (card.rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(card.rank)) return 10;
  return parseInt(card.rank, 10);
}

/**
 * Calculates the total value of a Blackjack hand, accounting for Aces.
 */
export function calculateHandValue(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += getBlackjackValue(card);
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

/**
 * Returns the Hi-Lo value of a card for card counting.
 */
export function getHiLoValue(card) {
  if (!card) return 0;
  if (['2', '3', '4', '5', '6'].includes(card.rank)) return 1;
  if (['10', 'J', 'Q', 'K', 'A'].includes(card.rank)) return -1;
  return 0;
}

/**
 * Returns basic strategy action for Blackjack.
 * @param {number} playerValue - Total hand value.
 * @param {string} dealerUpCard - Rank of dealer's up card.
 * @param {boolean} isSoft - True if hand contains an Ace being counted as 11.
 */
export function getBasicStrategyAction(playerValue, dealerUpCard, isSoft = false) {
  const dealerVal = getBlackjackValue({ rank: dealerUpCard });

  if (isSoft) {
    if (playerValue >= 19) return 'STAND';
    if (playerValue === 18) {
      if (dealerVal >= 9) return 'HIT';
      return 'STAND';
    }
    return 'HIT';
  }

  if (playerValue >= 17) return 'STAND';
  if (playerValue >= 13) {
    if (dealerVal >= 7) return 'HIT';
    return 'STAND';
  }
  if (playerValue === 12) {
    if (dealerVal >= 4 && dealerVal <= 6) return 'STAND';
    return 'HIT';
  }
  return 'HIT';
}
