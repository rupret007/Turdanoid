/**
 * Bot intent copy for TurdSpades — mirrors live table heuristics (hints only).
 */

const NAMES = ['You', 'West', 'North', 'East'];

export function formatCardLabel(card) {
  if (!card) {
    return 'a card';
  }
  const rank =
    card.rank === 14 || card.rank === 'A'
      ? 'A'
      : card.rank === 13 || card.rank === 'K'
        ? 'K'
        : card.rank === 12 || card.rank === 'Q'
          ? 'Q'
          : card.rank === 11 || card.rank === 'J'
            ? 'J'
            : String(card.rank);
  const sym = { S: '\u2660', H: '\u2665', D: '\u2666', C: '\u2663' };
  return rank + (sym[card.suit] || card.suit || '');
}

/**
 * @param {object} ctx
 * @param {number} ctx.player
 * @param {{ suit: string, rank: number }} ctx.card
 * @param {number|null} ctx.playerBid
 * @param {number|null} ctx.partnerBid
 * @param {number} ctx.teamNeed tricks still needed on partnership contract
 * @param {boolean} ctx.nilCover
 * @param {boolean} ctx.leading
 */
export function explainAiPlay(ctx) {
  const who = NAMES[ctx.player] || 'Bot';
  const card = formatCardLabel(ctx.card);
  if (ctx.nilCover) {
    return `${who} covers partner's Nil with ${card}.`;
  }
  if (ctx.playerBid === 0) {
    return `${who} ducks Nil with ${card}.`;
  }
  if (ctx.teamNeed > 0 && ctx.leading) {
    return `${who} leads for ${ctx.teamNeed} more trick${ctx.teamNeed === 1 ? '' : 's'} (${card}).`;
  }
  if (ctx.teamNeed > 0) {
    return `${who} fights for the contract (${card}).`;
  }
  if (ctx.card?.suit === 'S') {
    return `${who} dumps trump — bags watch (${card}).`;
  }
  return `${who} sloughs ${card} — contract safe.`;
}

export function teamContractNeed(bids, tricks, player, partner) {
  const bidSum = (bids[player] === 0 ? 0 : bids[player] || 0) + (bids[partner] === 0 ? 0 : bids[partner] || 0);
  const taken = (tricks[player] || 0) + (tricks[partner] || 0);
  return Math.max(0, bidSum - taken);
}
