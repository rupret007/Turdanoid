import { describe, expect, it } from 'vitest';
import { SPADES_SEATS, TurdSpadesMatch } from '../games/turdspades-match.js';
import { scoreSpadesTeamRound } from '../games/turdspades-engine.js';

const id = 'spades-fixture';
function send(game, seat, action, fields = {}) {
  return game.command(seat, { version: 1, id, revision: game.view(null).revision, action, ...fields });
}
function bidAll(game, values = [3, 3, 3, 3]) {
  for (const bid of values) { expect(send(game, game.view(null).turn, 'bid', { bid }).ok).toBe(true); }
}
function playRound(game) {
  for (let i = 0; i < 52; i++) {
    const seat = game.view(null).turn;
    const card = game.view(seat).hand.find(value => value.playable);
    expect(send(game, seat, 'play', { card: card.id }).ok).toBe(true);
    if (i % 7 === 0) { game = TurdSpadesMatch.restore(game.checkpoint()); }
  }
  return game;
}

describe('authoritative TurdSpades', () => {
  it('deals four private 13-card hands and rejects out-of-turn, duplicate and invalid bids', () => {
    const game = new TurdSpadesMatch(id);
    const hands = SPADES_SEATS.map(seat => game.view(seat).hand);
    expect(hands.every(hand => hand.length === 13)).toBe(true);
    expect(new Set(hands.flat().map(card => card.id)).size).toBe(52);
    expect(game.view(null)).toMatchObject({ hand: [], phase: 'bid', turn: 'west', canBid: false });
    expect(game.view('west').canBid).toBe(true);
    expect(send(game, null, 'bid', { bid: 3 }).reason).toBe('unavailable');
    expect(send(game, 'north', 'bid', { bid: 3 }).reason).toBe('wrong-turn');
    expect(send(game, 'west', 'bid', { bid: 14 }).reason).toBe('invalid-bid');
    expect(send(game, 'west', 'bid', { bid: 0 }).ok).toBe(true);
    expect(game.view(null).bids.west).toBe(0);
    expect(send(game, 'west', 'bid', { bid: 3 }).reason).toBe('wrong-turn');
    expect(send(game, 'north', 'bid', { bid: 3, revision: 0 }).reason).toBe('stale');
  });

  it('enforces unbroken spades, following suit, trump, and clockwise play', () => {
    const fresh = new TurdSpadesMatch(id).checkpoint();
    const suit = start => Array.from({ length: 13 }, (_, n) => start + n);
    fresh.hands = { south: suit(0), west: suit(13), north: suit(26), east: suit(39) };
    [fresh.hands.south[0], fresh.hands.west[0]] = [fresh.hands.west[0], fresh.hands.south[0]];
    [fresh.hands.east[0], fresh.hands.north[0]] = [fresh.hands.north[0], fresh.hands.east[0]];
    [fresh.hands.west[1], fresh.hands.north[1]] = [fresh.hands.north[1], fresh.hands.west[1]];
    const game = TurdSpadesMatch.restore(fresh);
    bidAll(game);
    expect(send(game, 'west', 'play', { card: 0 }).reason).toBe('illegal-card');
    expect(send(game, 'west', 'play', { card: 15 }).ok).toBe(true);
    expect(send(game, 'north', 'play', { card: 28 }).reason).toBe('illegal-card');
    expect(send(game, 'north', 'play', { card: 14 }).ok).toBe(true);
    expect(send(game, 'east', 'play', { card: 26 }).ok).toBe(true);
    expect(send(game, 'south', 'play', { card: 1 }).reason).toBe('illegal-card');
    expect(send(game, 'south', 'play', { card: 13 }).ok).toBe(true);
    expect(game.view(null)).toMatchObject({ lastWinner: 'south', turn: 'south', spadesBroken: false });
    expect(send(game, 'south', 'play', { card: 1 }).ok).toBe(true);
    expect(game.view(null).spadesBroken).toBe(true);
    expect(TurdSpadesMatch.restore(game.checkpoint()).view('south')).toEqual(game.view('south'));
  });

  it('scores all 13 tricks using existing partnership, Nil and bag rules and rotates the next dealer', () => {
    const game = new TurdSpadesMatch(id);
    bidAll(game, [0, 1, 1, 1]);
    const settled = playRound(game);
    const view = settled.view(null);
    expect(view).toMatchObject({ phase: 'round-end', hand: [], result: null });
    expect(Object.values(view.tricks).reduce((a, b) => a + b, 0)).toBe(13);
    const partners = [['south', 'north'], ['west', 'east']];
    for (const [team, seats] of partners.entries()) {
      const expected = scoreSpadesTeamRound({ bids: seats.map(seat => view.bids[seat]), tricks: seats.map(seat => view.tricks[seat]) });
      expect(view.scores[team]).toBe(expected.delta);
      expect(view.bags[team]).toBe(expected.bags);
    }
    expect(send(settled, 'north', 'next-round').ok).toBe(true);
    expect(settled.view(null)).toMatchObject({ round: 2, dealer: 'west', turn: 'north', phase: 'bid' });
    expect(settled.view('north').hand).toHaveLength(13);
  });

  it('allows a team resignation and rejects corrupt private inventory', () => {
    const game = new TurdSpadesMatch(id);
    expect(send(game, 'north', 'resign').ok).toBe(true);
    expect(game.view(null).result).toEqual({ winner: 1, reason: 'resigned' });
    expect(game.finished).toBe(true);
    const saved = game.checkpoint();
    saved.hands.north[0] = saved.hands.south[0];
    expect(() => TurdSpadesMatch.restore(saved)).toThrow('Invalid TurdSpades checkpoint');
  });
});
