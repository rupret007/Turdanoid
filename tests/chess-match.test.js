// SPDX-License-Identifier: GPL-3.0-or-later
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ChessMatch, CHESS_INITIAL_CLOCK_MS, CHESS_MATCH_VERSION } from '../games/chess-match.js';

const start = 1000;
const clock = CHESS_INITIAL_CLOCK_MS;

function send(match, seat, action, fields = {}, now = start) {
  const { id, revision } = match.view(now);
  return match.command(seat, { version: CHESS_MATCH_VERSION, id, revision, action, ...fields }, now);
}

function play(match, moves) {
  for (const move of moves.split(' ')) {
    expect(send(match, match.view(start).turn, 'move', { move })).toEqual({ ok: true });
  }
}

describe('Royal Flush Chess match authority', () => {
  it('rejects non-seat, out-of-turn, illegal, old-version and stale commands without moving', () => {
    const match = new ChessMatch('match-one', start);
    const before = match.checkpoint();
    expect(send(match, null, 'move', { move: 'e2e4', seat: 'w' }).reason).toBe('unavailable');
    expect(send(match, 'b', 'move', { move: 'e2e4', seat: 'w' }).reason).toBe('wrong-turn');
    expect(send(match, 'w', 'move', { move: 'e2e5' }).reason).toBe('illegal-move');
    expect(send(match, 'w', 'move', { move: 'e2e4', id: 'match-old' }).reason).toBe('match-changed');
    expect(send(match, 'w', 'move', { move: 'e2e4', version: 2 }).reason).toBe('match-changed');
    expect(match.checkpoint()).toEqual(before);
    expect(send(match, 'w', 'move', { move: 'e2e4' }).ok).toBe(true);
    expect(send(match, 'b', 'move', { move: 'e7e5', revision: 0 }).reason).toBe('stale');
    expect(match.view(start)).toMatchObject({ moves: ['e2e4'], revision: 1, turn: 'b' });
  });

  it('uses server elapsed time and freezes the clock on resignation', () => {
    const match = new ChessMatch('match-one', start);
    expect(send(match, 'w', 'move', { move: 'e2e4', clock: 10, now: start }, start + 2100).ok).toBe(true);
    expect(match.view(start + 2700)).toMatchObject({
      clock: { w: clock - 2100, b: clock - 600 }, deadline: start + 2100 + clock
    });
    expect(send(match, 'w', 'resign', {}, start + 2700).ok).toBe(true);
    expect(match.view(start + 9000)).toMatchObject({
      clock: { w: clock - 2100, b: clock - 600 }, deadline: null, result: { winner: 'b', reason: 'Resignation' }
    });
  });

  it('ends a flag fall at the exact deadline, including before a late move', () => {
    const match = new ChessMatch('match-one', start);
    expect(match.expire(start + clock - 1)).toBe(false);
    expect(send(match, 'w', 'move', { move: 'e2e4' }, start + clock)).toEqual({
      ok: false, reason: 'finished', changed: true
    });
    expect(match.expire(start + clock + 1)).toBe(false);
    expect(match.view(start + clock + 100)).toMatchObject({
      moves: [], clock: { w: 0, b: clock }, revision: 1, result: { winner: 'b', reason: 'Time expired' }
    });
  });

  it('records checkmate and refuses further commands', () => {
    const match = new ChessMatch('match-one', start);
    play(match, 'f2f3 e7e5 g2g4 d8h4');
    expect(match.view(start)).toMatchObject({ result: { winner: 'b', reason: 'Checkmate' }, deadline: null });
    expect(send(match, 'w', 'offer-draw').reason).toBe('finished');
  });

  it('requires a valid promotion piece and records underpromotion', () => {
    const match = new ChessMatch('match-one', start);
    play(match, 'a2a4 h7h5 a4a5 h5h4 a5a6 h4h3 a6b7 h3g2');
    expect(send(match, 'w', 'move', { move: 'b7a8' }).reason).toBe('illegal-move');
    expect(send(match, 'w', 'move', { move: 'b7a8n' }).ok).toBe(true);
    expect(match.view(start).fen.startsWith('N')).toBe(true);
  });

  it('requires the other player to accept an offer and clears declined offers', () => {
    const match = new ChessMatch('match-one', start);
    expect(send(match, 'w', 'offer-draw').ok).toBe(true);
    expect(send(match, 'w', 'accept-draw').reason).toBe('no-draw-offer');
    expect(send(match, 'b', 'decline-draw').ok).toBe(true);
    expect(match.view(start).drawOffer).toBeNull();
    expect(send(match, 'b', 'offer-draw').ok).toBe(true);
    expect(send(match, 'w', 'accept-draw', {}, start + 500).ok).toBe(true);
    expect(match.view(start + 9000)).toMatchObject({
      clock: { w: clock - 500, b: clock }, drawOffer: null, result: { winner: null, reason: 'Draw by agreement' }
    });
  });

  it('restores repetition history and can claim a draw by intended move', () => {
    const original = new ChessMatch('match-one', start);
    play(original, 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1');
    const restored = ChessMatch.restore(JSON.parse(JSON.stringify(original.checkpoint())));
    expect(restored.view(start + 900)).toEqual(original.view(start + 900));
    expect(send(restored, 'b', 'claim-draw').reason).toBe('no-draw-claim');
    expect(send(restored, 'b', 'claim-draw', { move: 'f6g8' }).ok).toBe(true);
    expect(restored.view(start)).toMatchObject({
      moves: original.view(start).moves,
      fen: original.view(start).fen,
      result: { winner: null, reason: 'Threefold repetition', intended: 'f6g8' }
    });
  });

  it('keeps checkpoint changes detached and rejects an invalid replay', () => {
    const match = new ChessMatch('match-one', start);
    const checkpoint = match.checkpoint();
    checkpoint.moves.push('e2e5');
    checkpoint.revision++;
    expect(() => ChessMatch.restore(checkpoint)).toThrow('Invalid chess match history');
    expect(match.view(start).moves).toEqual([]);
  });
});
