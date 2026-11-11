import { describe, expect, it } from 'vitest';
import { TurdtrisMatch, SPRINT_COUNTDOWN_MS, SPRINT_LIMIT_MS } from '../games/turdtris-match.js';
import {
  SPRINT_TICK_MS, sprintBag, sprintNext, createSprintBoard, advanceSprint, applySprintInput, sprintGhost
} from '../games/turdtris-sprint.js';

const id = 'sprint-fixture';
const now = 10000;
const start = now + SPRINT_COUNTDOWN_MS;
const seed = 0x6db74e01;
const match = () => new TurdtrisMatch(id, now, null, seed);
const move = (game, seat, sequence, inputs, time = start, fields = {}) =>
  game.command(seat, { id, version: 1, action: 'input', sequence, inputs, ...fields }, time);
const bottom = grid => grid.at(-1);

describe('seeded Turdtris boards', () => {
  it('gives both players the same seven-bags independently of inputs or hold', () => {
    const a = createSprintBoard(seed), b = createSprintBoard(seed);
    expect(a).toEqual(b);
    for (let index = 0; index < 8; index++) {
      expect(sprintBag(seed, index).toSorted()).toEqual(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
    }
    expect(sprintBag(seed, 0)).toEqual(['I', 'S', 'J', 'T', 'Z', 'L', 'O']);
    const first = a.piece.name;
    expect(applySprintInput(a, seed, 'hold')).toBe(true);
    expect(applySprintInput(a, seed, 'hold')).toBe(false);
    expect(a.hold).toBe(first);
    expect(a.piece.name).toBe(sprintNext(seed, b.cursor, 1)[0]);
    applySprintInput(b, seed, 'drop');
    expect(b.piece).toEqual(a.piece);
    expect(a.cursor).toBe(b.cursor);
    expect(sprintNext(seed, a.cursor)).toEqual(sprintNext(seed, b.cursor));
  });

  it('projects the same timed gravity and lock when advanced in chunks or one step', () => {
    const a = createSprintBoard(seed), b = createSprintBoard(seed);
    for (let tick = 25; tick <= 1400; tick += 25) { advanceSprint(a, seed, tick); }
    advanceSprint(b, seed, 1400);
    expect(a).toEqual(b);
    expect(a.cursor).toBeGreaterThan(1);
  });

  it('uses live rotation and ghost placement while blocking moves past walls', () => {
    const board = createSprintBoard(seed);
    const initial = sprintGhost(board);
    expect(applySprintInput(board, seed, 'cw')).toBe(true);
    expect(sprintGhost(board)).not.toEqual(initial);
    for (let count = 0; count < 15; count++) { applySprintInput(board, seed, 'left'); }
    expect(applySprintInput(board, seed, 'left')).toBe(false);
    const ghost = sprintGhost(board);
    expect(applySprintInput(board, seed, 'drop')).toBe(true);
    expect(ghost.every(([row, col]) => board.grid[row][col])).toBe(true);
  });
});

describe('authoritative timed Turdtris versus', () => {
  it('fences the countdown, duplicate packets, invalid commands, bursts and spectator writes', () => {
    const game = match();
    expect(game.view('a', now)).toMatchObject({ startsAt: start, phase: 'countdown', self: { sequence: 0 } });
    expect(move(game, 'a', 1, ['drop'], start - 1).reason).toBe('countdown');
    expect(move(game, 'a', 1, ['drop'], start, { version: 2 }).reason).toBe('match-changed');
    expect(move(game, null, 1, ['drop']).reason).toBe('unavailable');
    expect(move(game, 'a', 1, ['drop', 'clear-lines']).reason).toBe('invalid-input');
    expect(move(game, 'a', 2, ['drop']).reason).toBe('sequence');
    expect(move(game, 'a', 1, ['left', 'left', 'left', 'drop', 'hold', 'cw']).ok).toBe(true);
    expect(move(game, 'a', 1, ['drop']).reason).toBe('sequence');
    expect(move(game, 'a', 2, ['drop']).reason).toBe('input-paced');
    expect(move(game, 'b', 1, ['drop']).ok).toBe(true);
    expect(move(game, 'a', 2, ['drop'], start + 40, { tick: 0 }).ok).toBe(true);
    expect(game.view('a', start + 40).self.board.tick).toBe(2);
    expect(game.view(null, start + 40).self).toBeNull();
    expect(game.view('b', start + 40).self.sequence).toBe(1);
  });

  it('keeps independently moving boards and restores an authoritative checkpoint', () => {
    const game = match();
    expect(move(game, 'a', 1, ['left', 'drop']).ok).toBe(true);
    expect(move(game, 'b', 1, ['right', 'drop']).ok).toBe(true);
    const saved = game.checkpoint();
    const latest = start + 3200;
    const a = game.view('a', latest), b = game.view('b', latest);
    expect(a.boards).toEqual(b.boards);
    expect(a.boards.a.grid).not.toEqual(a.boards.b.grid);
    expect(a.self.next).toEqual(b.self.next);
    expect(TurdtrisMatch.restore(saved).view('a', latest)).toEqual(a);
    expect(game.checkpoint()).toEqual(saved);
    saved.boards.a.grid[10][4] = 'invalid';
    expect(() => TurdtrisMatch.restore(saved)).toThrow('Invalid Turdtris checkpoint');
  });

  function finishPosition(game, ...seats) {
    const saved = game.checkpoint();
    for (const seat of seats) {
      const board = saved.boards[seat];
      board.lines = 39;
      board.piece = { name: 'I', rotation: 0, row: 10, col: 3, lastActionRotate: false };
      bottom(board.grid).fill('S');
      bottom(board.grid).fill(0, 3, 7);
    }
    return TurdtrisMatch.restore(saved);
  }

  it('commits the first 40-line finish on the next tick and freezes both boards', () => {
    const game = finishPosition(match(), 'a');
    expect(move(game, 'a', 1, ['drop'], start + 200).ok).toBe(true);
    expect(game.expire(start + 201)).toBe(false);
    expect(game.expire(start + 1500)).toBe(true);
    expect(game.view('b', start + 1500)).toMatchObject({ phase: 'finished', result: { reason: 'finish', winner: 'a', tick: 10 } });
    expect(game.view('b', start + 5000).self.board.tick).toBe(10);
  });

  it('draws when both clear 40 lines on the same server tick regardless of packet order', () => {
    for (const seats of [['a', 'b'], ['b', 'a']]) {
      const game = finishPosition(match(), ...seats);
      for (const seat of seats) { expect(move(game, seat, 1, ['drop'], start + 60).ok).toBe(true); }
      expect(game.expire(start + 80)).toBe(true);
      expect(game.view(null, start + 80).result).toEqual({ reason: 'finish', winner: null, tick: 3 });
    }
  });

  it('ranks timed finishes by lines then score and rejects inputs at the deadline', () => {
    const saved = match().checkpoint();
    const tick = SPRINT_LIMIT_MS / SPRINT_TICK_MS;
    for (const seat of ['a', 'b']) {
      saved.boards[seat].tick = tick - 2;
      saved.boards[seat].fallAt = tick + 10;
      saved.boards[seat].lines = 5;
    }
    saved.boards.b.score = 100;
    const game = TurdtrisMatch.restore(saved);
    expect(move(game, 'a', 1, ['drop'], start + SPRINT_LIMIT_MS)).toEqual({ ok: false, reason: 'finished', changed: true });
    expect(game.view('b', start + SPRINT_LIMIT_MS).result).toEqual({ reason: 'time', winner: 'b', tick });
    expect(TurdtrisMatch.restore(game.checkpoint()).deadline).toBeNull();
  });

  it('lets the remaining player continue when one board tops out', () => {
    const game = match();
    let sequence = 0;
    while (game.view('a', start + sequence * 100).self.board.status === 'playing') {
      expect(sequence).toBeLessThan(20);
      const time = start + sequence++ * 100;
      expect(move(game, 'a', sequence, ['drop'], time).ok).toBe(true);
    }
    const time = start + sequence * 100;
    expect(game.view('b', time).phase).toBe('play');
    expect(move(game, 'b', 1, ['left', 'drop'], time).ok).toBe(true);
    expect(game.command('a', { id, version: 1, action: 'resign' }, time).ok).toBe(true);
    expect(game.view('b', time).result).toMatchObject({ reason: 'resign', winner: 'b' });
  });
});
