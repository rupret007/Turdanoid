/**
 * Blackjack engine for Turdanoid
 */

import { RANKS, SUITS, createShoe, handValue, isSoftHand, hiLoValue } from './cards.js';

export const INITIAL_BANKROLL = 1000;
export const MIN_BET = 10;
export const DEFAULT_RULES = {
  dealerHitsSoft17: false,
  blackjackPayout: 1.5,
  decks: 4,
  allowDoubleAfterSplit: true,
  allowSurrender: true,
  allowInsurance: true,
  allowHitSplitAces: false
};

/**
 * Returns basic strategy action for Blackjack.
 * @param {Object} options - { playerHand, dealerUpCard, canDouble, canSplit, canSurrender, rules }
 * @returns {Object} { action, reason }
 */
export function getStrategyAction({ 
  playerHand, 
  dealerUpCard, 
  canDouble = false, 
  canSplit = false, 
  canSurrender = false, 
  rules = DEFAULT_RULES 
}) {
  const up = typeof dealerUpCard === 'object' ? getCardValue(dealerUpCard) : dealerUpCard;
  const total = handValue(playerHand);
  const soft = isSoftHand(playerHand);
  const dealerHitsSoft17 = !!rules.dealerHitsSoft17;

  if (canSplit) {
    const rank = playerHand[0].rank;
    if (rank === 'A' || rank === '8') return { action: 'split', reason: 'Always split aces and eights.' };
    if (['10', 'J', 'Q', 'K'].includes(rank)) return { action: 'stand', reason: 'Keep a made 20.' };
    if (rank === '9') {
      return ([2, 3, 4, 5, 6, 8, 9].includes(up))
        ? { action: 'split', reason: '9,9 splits into stronger edges here.' }
        : { action: 'stand', reason: '9,9 should stand versus 7, 10, or Ace.' };
    }
    if (rank === '7') return up <= 7
      ? { action: 'split', reason: '7,7 split window versus weak dealer upcards.' }
      : { action: 'hit', reason: '7,7 is too weak to split here.' };
    if (rank === '6') {
      const splitWindow = rules.allowDoubleAfterSplit ? (up >= 2 && up <= 6) : (up >= 3 && up <= 6);
      return splitWindow
        ? { action: 'split', reason: '6,6 split depends on DAS and dealer weakness.' }
        : { action: 'hit', reason: '6,6 should not split in this matchup.' };
    }
    if (rank === '4') {
      return (rules.allowDoubleAfterSplit && (up === 5 || up === 6))
        ? { action: 'split', reason: '4,4 split is only good in DAS-friendly spots.' }
        : { action: 'hit', reason: '4,4 plays better as a hit here.' };
    }
    if (rank === '3' || rank === '2') {
      const splitWindow = rules.allowDoubleAfterSplit ? up <= 7 : (up >= 4 && up <= 7);
      return splitWindow
        ? { action: 'split', reason: 'Small pairs split best versus weak dealer ranges.' }
        : { action: 'hit', reason: 'Small pairs should not split in this spot.' };
    }
  }

  if (canSurrender) {
    if (total === 16 && (up === 9 || up === 10 || up === 11)) {
      return { action: 'surrender', reason: 'Late surrender trims a very bad EV spot.' };
    }
    if (total === 15 && (up === 10 || (dealerHitsSoft17 && up === 11))) {
      return { action: 'surrender', reason: 'Surrender is strongest on hard 15 versus heavy dealer strength.' };
    }
  }

  if (soft) {
    if (total >= 19) return { action: 'stand', reason: 'Soft 19+ is strong enough to stand.' };
    if (total === 18) {
      if (canDouble && ((up >= 3 && up <= 6) || (dealerHitsSoft17 && up === 2))) {
        return { action: 'double', reason: 'Soft 18 can press value with a double here.' };
      }
      if (up >= 9 || up === 11) return { action: 'hit', reason: 'Soft 18 needs improvement versus strong upcards.' };
      return { action: 'stand', reason: 'Soft 18 is stable against this upcard.' };
    }
    if (total === 17) {
      if (canDouble && ((dealerHitsSoft17 && up >= 3 && up <= 6) || (!dealerHitsSoft17 && up >= 4 && up <= 6))) {
        return { action: 'double', reason: 'Soft 17 has a profitable double window.' };
      }
      return { action: 'hit', reason: 'Soft 17 usually needs another card.' };
    }
    if (total === 16 || total === 15) {
      if (canDouble && ((up >= 4 && up <= 6) || (dealerHitsSoft17 && up === 3))) {
        return { action: 'double', reason: 'Soft mid totals double versus weak dealer ranges.' };
      }
      return { action: 'hit', reason: 'Soft mid totals continue as hits here.' };
    }
    if (total === 14 || total === 13) {
      if (canDouble && ((up >= 5 && up <= 6) || (dealerHitsSoft17 && up === 4))) {
        return { action: 'double', reason: 'Soft low totals only double in narrow spots.' };
      }
      return { action: 'hit', reason: 'Soft low totals should hit here.' };
    }
  }

  if (total >= 17) return { action: 'stand', reason: 'Hard 17+ stands.' };
  if (total >= 13 && total <= 16) {
    return (up >= 2 && up <= 6)
      ? { action: 'stand', reason: 'Dealer bust range makes standing best.' }
      : { action: 'hit', reason: 'Hard mid totals hit versus strong upcards.' };
  }
  if (total === 12) {
    return (up >= 4 && up <= 6)
      ? { action: 'stand', reason: 'Hard 12 stands against weak dealer upcards.' }
      : { action: 'hit', reason: 'Hard 12 hits outside the 4-6 window.' };
  }
  if (total === 11) {
    if (canDouble && (up !== 11 || dealerHitsSoft17)) {
      return { action: 'double', reason: 'Hard 11 is a premium double in this rule set.' };
    }
    return { action: 'hit', reason: 'Hard 11 fallback is a hit when double is unavailable.' };
  }
  if (total === 10) {
    return (canDouble && up <= 9)
      ? { action: 'double', reason: 'Hard 10 doubles versus non-ten dealer upcards.' }
      : { action: 'hit', reason: 'Hard 10 hits versus dealer ten or ace.' };
  }
  if (total === 9) {
    return (canDouble && up >= 3 && up <= 6)
      ? { action: 'double', reason: 'Hard 9 doubles in the 3-6 window.' }
      : { action: 'hit', reason: 'Hard 9 otherwise continues as hit.' };
  }
  return { action: 'hit', reason: 'Low totals should hit.' };
}

function getCardValue(card) {
  if (!card) return 0;
  if (card.rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(card.rank)) return 10;
  return parseInt(card.rank, 10);
}

export function isBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
}

export function isSoft17(hand) {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    total += getCardValue(c);
    if (c.rank === 'A') aces++;
  }
  let softAces = aces;
  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces--;
  }
  return total === 17 && softAces > 0;
}
