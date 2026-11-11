import { describe, expect, it } from 'vitest';
import { CLEAR_BONUS, createBoard, findGroup, popGroup } from '../games/turdomania-core.js';
import { TurdomaniaDuel, DUEL_COUNTDOWN_MS, DUEL_DURATION_MS, findDuelSolution, locateDuelTile, pickDuelSeed } from '../games/turdomania-duel.js';

const id = 'mania-fixture';
const now = 10000, start = now + DUEL_COUNTDOWN_MS;
const match = (seed = 1) => new TurdomaniaDuel(id, now, null, seed);
const pop = (game, seat, tile, move, at = start, fields = {}) =>
  game.command(seat, { version: 1, id, action: 'pop', tile, move, ...fields }, at);
const solution = game => findDuelSolution(game.view('a', start).self.board);

describe('mirrored Turdomania duel', () => {
  it('chooses solvable six-by-six boards with the solo gravity and group rules', () => {
    for (const source of [...Array.from({ length: 40 }, (_, i) => i * 0x9e3779b9 >>> 0), 0xffffffff]) {
      const seed = pickDuelSeed(source);
      let board = createBoard(6, 6, 3, seed);
      const path = findDuelSolution(board);
      expect(path.length).toBeGreaterThanOrEqual(5);
      for (const id of path) { board = popGroup(board, ...locateDuelTile(board, id)).board; }
      expect(board).toEqual([]);
    }
  });

  it('starts both sides on the same countdown and keeps their live boards independent', () => {
    const game = match();
    const a = game.view('a', now), b = game.view('b', now), watcher = game.view(null, now);
    expect(a).toMatchObject({ cols: 6, rows: 6, startsAt: start, phase: 'countdown', boards: null });
    expect(b.self.board).toEqual(a.self.board);
    expect(watcher.self).toBeNull();
    expect(watcher.boards).toEqual({ a: a.self.board, b: b.self.board });
    expect(pop(game, 'a', 14, 0, start - 1).reason).toBe('countdown');
    expect(pop(game, 'a', 14, 0, start, { version: 2 }).reason).toBe('match-changed');
    expect(pop(game, null, 14, 0).reason).toBe('unavailable');
    expect(pop(game, 'a', 14, 1).reason).toBe('stale');
    expect(pop(game, 'a', 100, 0).reason).toBe('illegal-group');
    const lone = a.self.board.flat().find(tile => findGroup(a.self.board, ...locateDuelTile(a.self.board, tile.id)).length === 1);
    expect(pop(game, 'a', lone.id, 0).reason).toBe('illegal-group');
    expect(pop(game, 'a', 14, 0).ok).toBe(true);
    expect(pop(game, 'a', 14, 0).reason).toBe('stale');
    expect(pop(game, 'a', 14, 1).reason).toBe('illegal-group');
    expect(game.view('b', start).self.board).toEqual(b.self.board);
    expect(game.view('b', start).players.a).toMatchObject({ moves: 1 });
    expect(pop(game, 'b', 14, 0).ok).toBe(true);
    expect(game.view(null, start).boards.a).toEqual(game.view(null, start).boards.b);
  });

  it('ranks a clear above an exhausted board and preserves both paths on reconnect', () => {
    let game = match();
    for (const [move, tile] of solution(game).entries()) {
      expect(pop(game, 'a', tile, move, start + move * 90).ok).toBe(true);
    }
    expect(game.view('a', start + 1000)).toMatchObject({ phase: 'play', result: null, players: { a: { left: 0, cleared: true, over: true } } });
    expect(game.view('a', start + 1000).players.a.score).toBeGreaterThanOrEqual(CLEAR_BONUS);
    for (const [move, tile] of [0, 2, 3, 1, 10, 12, 16, 19, 23, 34].entries()) {
      expect(pop(game, 'b', tile, move, start + 2000 + move * 90).ok).toBe(true);
      const before = game.view('b', start + 3000);
      game = TurdomaniaDuel.restore(game.checkpoint());
      expect(game.view('b', start + 3000)).toEqual(before);
    }
    expect(game.view(null, start + 3000)).toMatchObject({ phase: 'finished', result: { reason: 'boards', winner: 'a' },
      players: { b: { over: true, cleared: false, score: 57 } }, boards: { a: [] } });
  });

  it('draws equal completed puzzles even when one player finishes much earlier', () => {
    const game = match(), path = solution(game);
    for (const [seat, elapsed] of [['a', 1000], ['b', 30000]]) {
      for (const [move, tile] of path.entries()) { expect(pop(game, seat, tile, move, start + elapsed + move * 100).ok).toBe(true); }
    }
    expect(game.view(null, start + 40000).result).toMatchObject({ reason: 'boards', winner: null });
  });

  it('enforces the server deadline and rejects corrupt checkpoints', () => {
    const game = match();
    expect(pop(game, 'a', 14, 0).ok).toBe(true);
    const deadline = start + DUEL_DURATION_MS;
    expect(game.expire(deadline - 1)).toBe(false);
    expect(pop(game, 'b', 14, 0, deadline)).toEqual({ ok: false, reason: 'finished', changed: true });
    expect(game.view('a', deadline).result).toEqual({ reason: 'time', winner: 'a', at: deadline });
    const record = game.checkpoint();
    expect(() => TurdomaniaDuel.restore({ ...record, result: { ...record.result, winner: 'b' } })).toThrow('Invalid Turdomania result');
    expect(() => TurdomaniaDuel.restore({ ...record, picks: { a: [14, 14], b: [] } })).toThrow('Illegal Turdomania checkpoint move');
    expect(TurdomaniaDuel.restore(record).view('a', deadline)).toEqual(game.view('a', deadline));
  });
});
