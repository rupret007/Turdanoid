import { describe, it, expect } from 'vitest';
import {
  pickAiPlayCard,
  countRemainingSpades,
  unseenSpadesForPlayer
} from '../games/turdspades-play-ai.js';

function beats(card, best, lead) {
  if (!best) {
    return true;
  }
  if (card.suit === 'S') {
    return best.suit !== 'S' || card.rank > best.rank;
  }
  if (best.suit === 'S') {
    return false;
  }
  return card.suit === lead && (best.suit !== lead || card.rank > best.rank);
}

function winnerEntry(trick) {
  if (!trick.length) {
    return null;
  }
  const lead = trick[0].card.suit;
  let best = trick[0];
  for (let i = 1; i < trick.length; i++) {
    const e = trick[i];
    const c = e.card;
    const b = best.card;
    if (c.suit === 'S') {
      if (b.suit !== 'S' || c.rank > b.rank) {
        best = e;
      }
      continue;
    }
    if (b.suit === 'S') {
      continue;
    }
    if (c.suit === lead && (b.suit !== lead || c.rank > b.rank)) {
      best = e;
    }
  }
  return best;
}

function allSpades() {
  return Array.from({ length: 13 }, (_, i) => ({
    id: `S${i + 2}`,
    suit: 'S',
    rank: i + 2
  }));
}

function fourHandTableWithBotSpades(botPlayer, botCount) {
  const spades = allSpades();
  const botSpades = spades.slice(0, botCount);
  const rest = spades.slice(botCount);
  const hands = [[], [], [], []];
  hands[botPlayer] = [...botSpades, { id: 'C3', suit: 'C', rank: 3 }];
  rest.forEach((card, i) => {
    const seat = (botPlayer + 1 + (i % 3)) % 4;
    hands[seat].push(card);
  });
  return { hands, botSpades };
}

const playHelpers = {
  beats,
  winnerEntry,
  pickNilCoverCard: () => null,
  low: (c) => c.slice().sort((a, b) => a.rank - b.rank)[0],
  high: (c) => c.slice().sort((a, b) => b.rank - a.rank)[0]
};

describe('turdspades-play-ai', () => {
  it('counts remaining spades from hands and trick', () => {
    const hands = [[{ suit: 'S', rank: 14 }], [], [], []];
    const trick = [{ card: { suit: 'S', rank: 2 } }];
    expect(countRemainingSpades(hands, trick, [])).toBe(11);
  });

  it('counts 11 unseen trump when the acting bot holds two and none are public', () => {
    const { hands } = fourHandTableWithBotSpades(1, 2);
    const state = { hands, trick: [], playedThisRound: [] };
    expect(unseenSpadesForPlayer(state, 1)).toBe(11);
  });

  it('deduplicates a public spade that appears in both the trick and history', () => {
    const own = [
      { id: 'SA', suit: 'S', rank: 14 },
      { id: 'SK', suit: 'S', rank: 13 }
    ];
    const publicSpade = { id: 'S2-0', suit: 'S', rank: 2 };
    expect(countRemainingSpades([own], [{ card: publicSpade }], [publicSpade])).toBe(10);
    const { hands } = fourHandTableWithBotSpades(1, 2);
    const oppSeat = hands.findIndex((hand, i) => i !== 1 && hand.some((c) => c.suit === 'S'));
    const idx = hands[oppSeat].findIndex((c) => c.suit === 'S');
    const fromHand = hands[oppSeat].splice(idx, 1)[0];
    const state = {
      hands,
      trick: [{ player: oppSeat, card: fromHand }],
      playedThisRound: [{ id: fromHand.id, suit: fromHand.suit, rank: fromHand.rank }]
    };
    expect(unseenSpadesForPlayer(state, 1)).toBe(10);
  });

  it('does not dump trump just because opponents still hold hidden spades', () => {
    const { hands } = fourHandTableWithBotSpades(1, 2);
    const state = {
      bids: [4, 3, 4, 3],
      tricks: [4, 3, 4, 3],
      trick: [],
      hands,
      playedThisRound: []
    };
    const legal = [
      { id: 'C3', suit: 'C', rank: 3 },
      { id: 'SA', suit: 'S', rank: 14 }
    ];
    const card = pickAiPlayCard({
      state,
      player: 1,
      legal,
      difficulty: 'normal',
      helpers: playHelpers
    });
    expect(unseenSpadesForPlayer(state, 1)).toBe(11);
    expect(card.id).toBe('C3');
  });

  it('covers partner Nil with cheapest winner', () => {
    const state = {
      bids: [4, 3, 4, 0],
      tricks: [0, 0, 0, 0],
      trick: [{ player: 3, card: { id: 'east-win', suit: 'H', rank: 9 } }],
      hands: { 1: [] },
      playedThisRound: []
    };
    const legal = [
      { id: 'low', suit: 'H', rank: 3 },
      { id: 'cover', suit: 'H', rank: 12 },
      { id: 'ace', suit: 'H', rank: 14 }
    ];
    const pickNilCoverCard = (l, partner) => {
      if (state.bids[partner] !== 0) {
        return null;
      }
      const lead = state.trick[0].card.suit;
      const best = winnerEntry(state.trick)?.card;
      const covers = l.filter((card) => beats(card, best, lead));
      return covers.sort((a, b) => a.rank - b.rank)[0];
    };
    const card = pickAiPlayCard({
      state,
      player: 1,
      legal,
      difficulty: 'normal',
      helpers: {
        beats,
        winnerEntry,
        pickNilCoverCard,
        low: (c) => c.slice().sort((a, b) => a.rank - b.rank)[0],
        high: (c) => c.slice().sort((a, b) => b.rank - a.rank)[0]
      }
    });
    expect(card.id).toBe('cover');
  });

  it('Nil bot sheds highest losing card', () => {
    const state = {
      bids: [4, 0, 3, 3],
      tricks: [0, 0, 0, 0],
      trick: [{ player: 0, card: { id: 'lead', suit: 'H', rank: 10 } }],
      hands: { 1: [] },
      playedThisRound: []
    };
    const legal = [
      { id: 'low', suit: 'H', rank: 2 },
      { id: 'safe-dump', suit: 'H', rank: 9 },
      { id: 'winner', suit: 'H', rank: 11 }
    ];
    const card = pickAiPlayCard({
      state,
      player: 1,
      legal,
      difficulty: 'hard',
      helpers: {
        beats,
        winnerEntry,
        pickNilCoverCard: () => null,
        low: (c) => c.slice().sort((a, b) => a.rank - b.rank)[0],
        high: (c) => c.slice().sort((a, b) => b.rank - a.rank)[0]
      }
    });
    expect(card.id).toBe('safe-dump');
  });
});
