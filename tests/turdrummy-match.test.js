import { describe, expect, it } from 'vitest';
import { TurdRummyMatch } from '../games/turdrummy-match.js';

const id = 'rummy-table-fixture';
const card = (suit, rank) => 'CDHS'.indexOf(suit) * 13 + rank - 1;
const range = (suit, start, end) => Array.from({ length: end - start + 1 }, (_, n) => card(suit, start + n));
const inventory = Array.from({ length: 52 }, (_, index) => index);

function fixture(a, b, top, draw, extra = {}) {
  const initial = new TurdRummyMatch(id).checkpoint();
  const used = new Set([...a, ...b, top, draw]);
  const stock = [...inventory.filter(value => !used.has(value)), draw];
  return TurdRummyMatch.restore({ ...initial, hands: { a, b }, discard: [top], stock, ...extra });
}
function send(match, seat, action, fields = {}) {
  return match.command(seat, { id, version: 1, revision: match.view(null).revision, action, ...fields });
}

describe('authoritative TurdRummy', () => {
  it('deals two private hands and hides stock draw identity from the other seat and spectators', () => {
    const match = new TurdRummyMatch(id);
    const a = match.view('a'), b = match.view('b');
    expect(a.hand).toHaveLength(10);
    expect(b.hand).toHaveLength(10);
    expect(a.hand.some(value => b.hand.some(other => other.id === value.id))).toBe(false);
    expect(b).toMatchObject({ stockCount: 31, turn: 'b', canDrawStock: true, canTakeDiscard: true });
    expect(send(match, 'b', 'draw-stock').ok).toBe(true);
    expect(match.view('b').drawn).toBeTypeOf('number');
    expect(match.view('a')).toMatchObject({ drawn: null, blocked: null, counts: { a: 10, b: 11 } });
    expect(match.view(null)).toMatchObject({ hand: [], stockCount: 30, drawn: null, blocked: null });
    expect(match.view(null)).not.toHaveProperty('stock');
    expect(match.view('a')).not.toHaveProperty('hands');
    expect(TurdRummyMatch.restore(match.checkpoint()).view('b')).toEqual(match.view('b'));
  });

  it('enforces seat, phase, revision, ownership and the discard pickup restriction', () => {
    const match = fixture(range('D', 1, 10), range('C', 1, 10), card('H', 12), card('S', 4));
    expect(send(match, null, 'draw-stock').reason).toBe('unavailable');
    expect(send(match, 'a', 'draw-stock').reason).toBe('wrong-turn');
    expect(send(match, 'b', 'discard', { card: card('C', 1) }).reason).toBe('wrong-phase');
    expect(send(match, 'b', 'draw-discard').ok).toBe(true);
    const before = match.checkpoint();
    expect(match.view('b').blocked).toBe(card('H', 12));
    expect(match.view('a').blocked).toBeNull();
    expect(send(match, 'b', 'discard', { card: card('H', 12) }).reason).toBe('return-discard');
    expect(send(match, 'b', 'discard', { card: card('D', 1) }).reason).toBe('illegal-card');
    expect(send(match, 'b', 'discard', { card: card('C', 1), revision: 0 }).reason).toBe('stale');
    expect(send(match, 'b', 'gin', { card: card('C', 1) }).reason).toBe('not-gin');
    expect(match.checkpoint()).toEqual(before);
    expect(send(match, 'b', 'discard', { card: card('C', 1) }).ok).toBe(true);
    expect(match.view(null)).toMatchObject({ turn: 'a', top: { suit: 'C', rank: 1 } });
  });

  it('settles gin with the shipped bonus, reaches 100 and keeps the ending hands private', () => {
    const match = fixture(range('D', 1, 10), range('C', 1, 10), card('H', 12), card('C', 11), { score: { a: 0, b: 75 } });
    expect(send(match, 'b', 'draw-stock').ok).toBe(true);
    expect(send(match, 'b', 'gin', { card: card('C', 11) }).ok).toBe(true);
    expect(match.view(null)).toMatchObject({
      score: { a: 0, b: 100 }, result: { winner: 'b', reason: 'score' },
      roundResult: { winner: 'b', kind: 'gin', points: 25, laidOff: 0 }, hand: []
    });
    expect(match.finished).toBe(true);
    expect(send(match, 'b', 'next-round').reason).toBe('finished');
  });

  it('settles knocks with chained layoffs and alternates the opening turn', () => {
    const a = [...range('H', 10, 12), ...range('S', 10, 12), card('C', 7), card('C', 8), card('D', 10), card('D', 12)];
    const b = [...range('C', 1, 6), ...range('D', 2, 4), card('H', 3)];
    const match = fixture(a, b, card('S', 1), card('C', 13));
    expect(send(match, 'b', 'draw-stock').ok).toBe(true);
    expect(send(match, 'b', 'knock', { card: card('D', 2) }).reason).toBe('knock-limit');
    expect(send(match, 'b', 'knock', { card: card('C', 13) }).ok).toBe(true);
    expect(match.view(null).roundResult).toEqual({
      winner: 'b', knocker: 'b', kind: 'knock', points: 17, knockerDeadwood: 3, defenderDeadwood: 20, laidOff: 2
    });
    expect(send(match, 'a', 'next-round').ok).toBe(true);
    expect(match.view('a')).toMatchObject({ round: 2, turn: 'a', roundResult: null, score: { a: 0, b: 17 } });
  });

  it('awards the undercut to the defender and validates checkpoints', () => {
    const match = fixture(range('D', 1, 10), [...range('C', 1, 9), card('S', 9)], card('H', 12), card('C', 11));
    expect(send(match, 'b', 'draw-stock').ok).toBe(true);
    expect(send(match, 'b', 'knock', { card: card('C', 11) }).ok).toBe(true);
    expect(match.view(null).roundResult).toMatchObject({ winner: 'a', knocker: 'b', kind: 'undercut', points: 34 });
    const saved = match.checkpoint();
    expect(() => TurdRummyMatch.restore({ ...saved, stock: [...saved.stock, saved.discard[0]] })).toThrow('Invalid TurdRummy checkpoint');
  });

  it('recycles older discards, preserving the current up-card', () => {
    const initial = new TurdRummyMatch(id).checkpoint();
    const match = TurdRummyMatch.restore({ ...initial, stock: [], discard: [...initial.stock, ...initial.discard] });
    const upCard = match.view(null).top;
    expect(send(match, 'b', 'draw-stock').ok).toBe(true);
    expect(match.view(null)).toMatchObject({ top: upCard, stockCount: 30 });
    expect(TurdRummyMatch.restore(match.checkpoint()).view('b')).toEqual(match.view('b'));
  });
});
