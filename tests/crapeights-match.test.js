import { describe, expect, it } from 'vitest';
import { CrapeightsMatch } from '../games/crapeights-match.js';

const id = 'table-fixture';
const card = (rank, suit = 'S') => 'SHDC'.indexOf(suit) * 13 + ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].indexOf(rank);
const all = Array.from({ length: 52 }, (_, index) => index);
function table(a, b, top, draws = [], extra = {}) {
  const initial = new CrapeightsMatch(id).checkpoint();
  const rest = all.filter(value => ![...a, ...b, top, ...draws].includes(value));
  return CrapeightsMatch.restore({ ...initial, hands: { a, b }, discard: [top], activeSuit: 'S', deck: [...rest, ...draws.toReversed()], ...extra });
}

function send(game, seat, action, details = {}) {
  return game.command(seat, { version: 1, id, revision: game.view(seat).revision, action, ...details });
}

describe('authoritative Crappy Eights', () => {
  it('deals seven cards to each seat and only projects the viewer’s hand', () => {
    const game = new CrapeightsMatch(id);
    const a = game.view('a'), b = game.view('b'), spectator = game.view(null);
    expect(a.hand).toHaveLength(7);
    expect(b.hand).toHaveLength(7);
    expect(a.hand.map(item => item.id)).not.toEqual(expect.arrayContaining(b.hand.map(item => item.id)));
    expect(spectator.hand).toEqual([]);
    expect(spectator.counts).toEqual({ a: 7, b: 7 });
    expect(spectator.deckCount).toBe(37);
    expect(spectator.top.rank).not.toBe('8');
    expect(spectator).not.toHaveProperty('deck');
    expect(a).not.toHaveProperty('hands');
    expect(CrapeightsMatch.restore(game.checkpoint()).view('b')).toEqual(b);
  });

  it('rejects stale, spectator, out-of-turn, foreign-card and undeclared wild plays', () => {
    const game = table([card('8'), card('3')], [card('4')], card('A'));
    const before = game.checkpoint();
    expect(send(game, 'a', 'play', { card: card('8'), revision: 2 }).reason).toBe('stale');
    expect(send(game, null, 'draw').reason).toBe('unavailable');
    expect(send(game, 'b', 'draw').reason).toBe('wrong-turn');
    expect(send(game, 'a', 'play', { card: card('4') }).reason).toBe('illegal-card');
    expect(send(game, 'a', 'play', { card: card('8') }).reason).toBe('choose-suit');
    expect(game.checkpoint()).toEqual(before);
    expect(send(game, 'a', 'play', { card: card('8'), suit: 'D' })).toEqual({ ok: true });
    expect(game.view('b')).toMatchObject({ activeSuit: 'D', top: { rank: '8', suit: 'S' }, turn: 'b' });
    expect(game.view('b').hand[0].playable).toBe(false);
  });

  it('applies draw two, skip, and reverse at the table, with no forced cards in the public view', () => {
    const game = table([card('2'), card('J'), card('Q'), card('3')], [card('4')], card('A'), [card('5', 'H'), card('6', 'H')]);
    expect(send(game, 'a', 'play', { card: card('2') }).ok).toBe(true);
    expect(game.view(null)).toMatchObject({ counts: { a: 3, b: 3 }, hand: [], turn: 'a', action: { kind: 'draw-two', seat: 'b', count: 2 } });
    expect(send(game, 'a', 'play', { card: card('J') }).ok).toBe(true);
    expect(game.view(null)).toMatchObject({ turn: 'a', action: { kind: 'skip', seat: 'b' } });
    expect(send(game, 'a', 'play', { card: card('Q') }).ok).toBe(true);
    expect(game.view(null)).toMatchObject({ turn: 'b', direction: -1 });
  });

  it('offers one draw then play or pass, and automatically passes an unplayable draw', () => {
    const game = table([card('4')], [card('5')], card('A'), [card('3'), card('7', 'C')]);
    expect(send(game, 'a', 'pass').ok).toBe(false);
    expect(send(game, 'a', 'draw').ok).toBe(true);
    expect(game.view('a')).toMatchObject({ turn: 'a', canPass: true, canDraw: false });
    expect(game.view('b').hand.map(item => item.id)).toEqual([card('5')]);
    expect(send(game, 'a', 'draw').ok).toBe(false);
    expect(send(game, 'a', 'pass').ok).toBe(true);
    expect(send(game, 'b', 'draw').ok).toBe(true);
    expect(game.view('a')).toMatchObject({ turn: 'a', canPass: false, counts: { a: 2, b: 2 } });
  });

  it('scores the round without revealing the losing hand and alternates the next lead', () => {
    const game = table([card('4')], [card('8', 'C'), card('A', 'H')], card('A'));
    expect(send(game, 'a', 'play', { card: card('4') }).ok).toBe(true);
    expect(game.view('a')).toMatchObject({ roundResult: { winner: 'a', points: 51 }, score: { a: 51, b: 0 }, hand: [], result: null });
    expect(send(game, 'b', 'next-round').ok).toBe(true);
    expect(game.view('b')).toMatchObject({ round: 2, turn: 'b', counts: { a: 7, b: 7 }, score: { a: 51, b: 0 } });
  });

  it('reshuffles a used discard, scores the target, and refuses a corrupt checkpoint', () => {
    const base = table([card('4')], [card('8', 'C')], card('A'), [], { score: { a: 180, b: 0 } }).checkpoint();
    const game = CrapeightsMatch.restore({ ...base, deck: [], discard: [...base.deck, ...base.discard] });
    expect(send(game, 'a', 'draw').ok).toBe(true);
    expect(game.view(null).deckCount).toBe(base.deck.length - 1);
    const winner = CrapeightsMatch.restore(base);
    expect(send(winner, 'a', 'play', { card: card('4') }).ok).toBe(true);
    expect(winner.view('b').result).toEqual({ winner: 'a', reason: 'score' });
    expect(send(winner, 'b', 'next-round').reason).toBe('finished');
    expect(() => CrapeightsMatch.restore({ ...base, deck: [...base.deck, card('4')] })).toThrow('Invalid Crappy Eights checkpoint');
  });
});
