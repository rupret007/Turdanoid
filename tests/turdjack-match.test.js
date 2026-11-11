import { describe, expect, it } from 'vitest';
import { JACK_SEATS, TurdJackMatch } from '../games/turdjack-match.js';
import { RANKS, SUITS } from '../games/cards.js';

const id = 'jack-fixture';
function fixture(order, players = JACK_SEATS.slice(0, 2)) {
  const saved = new TurdJackMatch(id, players).checkpoint();
  const ids = order.map(([suit, rank, copy = 0]) => copy * 52 + SUITS.indexOf(suit) * 13 + RANKS.indexOf(rank));
  const reserved = new Set(ids);
  saved.shoe = [...saved.shoe.filter(card => !reserved.has(card)), ...ids.toReversed()];
  return TurdJackMatch.restore(saved);
}
function send(game, seat, action, data = {}) {
  return game.command(seat, { id, version: 1, revision: game.view(null).revision, action, ...data });
}

describe('authoritative shared Crapjack 21', () => {
  it('deals only after every seat is ready and projects private hands and public counts', () => {
    const game = new TurdJackMatch(id, JACK_SEATS);
    expect(send(game, 'spectator', 'wager', { chips: 10 }).reason).toBe('unavailable');
    expect(send(game, 'one', 'wager', { chips: 1000 }).reason).toBe('invalid-wager');
    for (const seat of JACK_SEATS.slice(0, 3)) {
      expect(send(game, seat, 'wager', { chips: 10 }).ok).toBe(true);
      expect(game.view(seat).phase).toBe('wager');
    }
    expect(send(game, 'four', 'wager', { chips: 0 }).ok).toBe(true);
    const live = game.view(null);
    expect(live.phase).not.toBe('wager');
    expect(live.self).toBeNull();
    expect(live.table.one.hands).toMatchObject([{ count: 2 }]);
    expect(live.table.one.hands[0]).not.toHaveProperty('cards');
    expect(live.table.four.hands).toEqual([]);
    expect(live).not.toHaveProperty('shoe');
    expect(game.view('two').self.hands[0].cards).toHaveLength(2);
    expect(TurdJackMatch.restore(game.checkpoint()).view('two')).toEqual(game.view('two'));
  });

  it('holds the dealer card and all outcomes until the last player stands', () => {
    const game = fixture([['S', '10'], ['H', '10'], ['D', '6'], ['S', '8'], ['H', '7'], ['D', '10'], ['C', '10']]);
    send(game, 'one', 'wager', { chips: 10 });
    send(game, 'two', 'wager', { chips: 20 });
    expect(game.view(null)).toMatchObject({ phase: 'play', active: 'one', dealerHidden: true, dealer: [{ suit: 'D', rank: '6' }] });
    expect(send(game, 'two', 'stand').reason).toBe('action-unavailable');
    expect(send(game, 'one', 'stand', { revision: 0 }).reason).toBe('stale');
    expect(send(game, 'one', 'stand').ok).toBe(true);
    expect(game.view('one')).toMatchObject({ phase: 'play', active: 'two', dealerHidden: true });
    expect(game.view('one').self.hands[0].outcome).toBeNull();
    expect(send(game, 'two', 'stand').ok).toBe(true);
    expect(game.view(null)).toMatchObject({ phase: 'settled', dealerHidden: false, dealerTotal: 26 });
    expect(game.view('one').self.chips).toBe(1010);
    expect(game.view('two').self.chips).toBe(1020);
    expect(send(game, 'one', 'next-round').ok).toBe(true);
    expect(game.view('one')).toMatchObject({ phase: 'wager', round: 2, dealer: [], self: { chips: 1010, hands: [] } });
  });

  it('supports one split, double after a split, and surrender of an unsplit hand', () => {
    const game = fixture([['S', '8'], ['C', '10'], ['D', '10'], ['H', '8'], ['C', '7'], ['D', '7'],
      ['S', '3'], ['S', '2'], ['S', '10'], ['C', '2']]);
    send(game, 'one', 'wager', { chips: 10 });
    send(game, 'two', 'wager', { chips: 10 });
    expect(send(game, 'one', 'split').ok).toBe(true);
    expect(game.view('one').self.hands.map(hand => hand.total)).toEqual([11, 10]);
    expect(send(game, 'one', 'split').reason).toBe('action-unavailable');
    expect(send(game, 'one', 'surrender').reason).toBe('action-unavailable');
    expect(send(game, 'one', 'double').ok).toBe(true);
    expect(send(game, 'one', 'hit').ok).toBe(true);
    expect(send(game, 'one', 'stand').ok).toBe(true);
    expect(send(game, 'two', 'surrender').ok).toBe(true);
    expect(game.view('one').self).toMatchObject({ chips: 1010, hands: [{ outcome: 'win', returned: 40 }, { outcome: 'lose', returned: 0 }] });
    expect(game.view('two').self).toMatchObject({ chips: 995, hands: [{ outcome: 'surrender', returned: 5 }] });
  });

  it('settles even money and insurance when the dealer has blackjack', () => {
    const game = fixture([['S', 'A'], ['H', '10'], ['D', 'A'], ['S', 'K'], ['H', '8'], ['D', 'K']]);
    send(game, 'one', 'wager', { chips: 20 });
    send(game, 'two', 'wager', { chips: 20 });
    expect(game.view('one').phase).toBe('insurance');
    expect(game.view('two').dealer).toEqual([{ suit: 'D', rank: 'A' }]);
    expect(send(game, 'one', 'cover').ok).toBe(true);
    expect(game.view(null).phase).toBe('insurance');
    expect(send(game, 'two', 'cover').ok).toBe(true);
    expect(game.view('one').self.chips).toBe(1020);
    expect(game.view('two').self.chips).toBe(1000);
    expect(game.view(null)).toMatchObject({ phase: 'settled', dealerTotal: 21 });
  });

  it('stands on soft 17 and pays a natural at 3:2', () => {
    const game = fixture([['S', 'A'], ['H', '10'], ['D', '6'], ['S', 'K'], ['H', '9'], ['D', 'A'], ['C', '10']]);
    send(game, 'one', 'wager', { chips: 10 });
    send(game, 'two', 'wager', { chips: 10 });
    expect(game.view('one').active).toBe('two');
    expect(send(game, 'two', 'stand').ok).toBe(true);
    expect(game.view(null)).toMatchObject({ dealerTotal: 17, dealer: [{ rank: '6' }, { rank: 'A' }] });
    expect(game.view('one').self).toMatchObject({ chips: 1015, hands: [{ outcome: 'blackjack', returned: 25 }] });
  });

  it('rejects corrupt cards and keeps refills and ending a session seat-scoped', () => {
    const saved = new TurdJackMatch(id, JACK_SEATS.slice(0, 2)).checkpoint();
    expect(() => TurdJackMatch.restore({ ...saved, shoe: [saved.shoe[0], ...saved.shoe] })).toThrow('Invalid Crapjack checkpoint');
    saved.seats.two.chips = 0;
    const game = TurdJackMatch.restore(saved);
    expect(send(game, 'one', 'recharge').reason).toBe('action-unavailable');
    expect(send(game, 'two', 'recharge').ok).toBe(true);
    expect(game.view('two').self.chips).toBe(1000);
    expect(send(game, 'two', 'finish').reason).toBe('action-unavailable');
    expect(send(game, 'one', 'finish').ok).toBe(true);
    expect(game.finished).toBe(true);
  });
});
