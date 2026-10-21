/* global URLSearchParams, URL */
import { describe, expect, it } from 'vitest';

import * as Core from '../games/turdomania-core.js';
import * as Daily from '../games/turdomania-daily.js';

function storage(initial = {}) {
  const data = { ...initial };
  return { data, getItem: (key) => data[key] ?? null, setItem: (key, value) => { data[key] = String(value); } };
}

function firstMove(run, reverse = false) {
  const moves = [];
  for (let col = 0; col < run.state.board.length; col++) {
    for (let row = 0; row < run.state.board[col].length; row++) {
      if (Core.findGroup(run.state.board, col, row).length >= 2) { moves.push([col, row]); }
    }
  }
  return reverse ? moves.at(-1) : moves[0];
}

function finish(run, reverse = false) {
  while (!run.state.over) {
    const move = firstMove(run, reverse);
    run = Daily.playMove(run, ...move).run;
  }
  return run;
}

const challenge = Daily.makeChallenge('2026-10-21');

describe('Daily Dump Chicago calendar and identity', () => {
  it('uses the Chicago date on both sides of midnight, independently of host timezone', () => {
    expect(Daily.challengeDate('2026-10-21T04:59:59Z')).toBe('2026-10-20');
    expect(Daily.challengeDate('2026-10-21T05:00:00Z')).toBe('2026-10-21');
    expect(Daily.challengeDate('2026-12-21T05:59:59Z')).toBe('2026-12-20');
    expect(Daily.challengeDate('2026-12-21T06:00:00Z')).toBe('2026-12-21');
  });

  it('finds exact next resets across both daylight-saving transitions', () => {
    const spring = Date.parse('2026-03-08T06:00:00Z');
    const fall = Date.parse('2026-11-01T05:00:00Z');
    expect(new Date(Daily.nextResetAt(spring)).toISOString()).toBe('2026-03-09T05:00:00.000Z');
    expect(Daily.nextResetAt(spring) - spring).toBe(23 * 3600000);
    expect(new Date(Daily.nextResetAt(fall)).toISOString()).toBe('2026-11-02T06:00:00.000Z');
    expect(Daily.nextResetAt(fall) - fall).toBe(25 * 3600000);
  });

  it('validates real dates, incoming versions and future links', () => {
    const now = Date.parse('2026-10-21T18:00:00Z');
    for (const invalid of ['2026-02-29', '2026-13-01', '26-10-21', '<script>', '2026-10-21extra']) {
      expect(Daily.validDate(invalid)).toBe(false);
      expect(Daily.parseChallengeRequest(new URLSearchParams({ daily: invalid }), now).challenge).toBeNull();
    }
    expect(Daily.validDate('2028-02-29')).toBe(true);
    expect(Daily.parseChallengeRequest(new URLSearchParams('daily=today'), now).challenge).toEqual(challenge);
    expect(Daily.parseChallengeRequest(new URLSearchParams('daily=2026-10-22'), now).error).toContain('not arrived');
    expect(Daily.parseChallengeRequest(new URLSearchParams('daily=2026-10-21&v=2'), now).error).toContain('rules version');
    expect(Daily.parseChallengeRequest(new URLSearchParams('seed=123'), now).requested).toBe(false);
  });

  it('pins all logical dimensions, difficulty, generator, seed and rules', () => {
    expect(challenge).toMatchObject({ date: '2026-10-21', rules: 1, generator: 1, cols: 8, rows: 10, kinds: 4, level: 'normal' });
    expect(Object.isFrozen(challenge)).toBe(true);
    const a = Daily.createRun(challenge);
    const b = Daily.createRun(Daily.makeChallenge('2026-10-21'));
    expect(a.state.board).toEqual(b.state.board);
    expect(Core.tileCount(a.state.board)).toBe(80);
    expect(a.state.cols).toBe(8);
    expect(a.state.rows).toBe(10);
    expect(new Set(a.state.board.flat().map((tile) => tile.kind)).size).toBe(4);
    expect(Daily.createRun(Daily.makeChallenge('2026-10-22')).state.board).not.toEqual(a.state.board);
    expect(Daily.validChallenge({ ...challenge, cols: 6 })).toBe(false);
  });

  it('keeps an active run identity frozen after the next calendar day arrives', () => {
    const run = Daily.createRun(challenge);
    const next = Daily.playMove(run, ...firstMove(run)).run;
    expect(next.challenge).toEqual(challenge);
    expect(next.challenge.date).toBe('2026-10-21');
    expect(Daily.challengeDate('2026-10-22T05:01:00Z')).toBe('2026-10-22');
  });
});

describe('Daily Dump replay validation and local resume', () => {
  it('rebuilds legal moves exactly and ignores stored board/score fields', () => {
    let run = Daily.createRun(challenge);
    for (let n = 0; n < 3; n++) { run = Daily.playMove(run, ...firstMove(run)).run; }
    const raw = { ...Daily.serializeRun(run), state: { score: 999999, board: [] } };
    const replay = Daily.replayRun(JSON.parse(JSON.stringify(raw)));
    expect(replay.state).toEqual(run.state);
    expect(replay.state.score).not.toBe(999999);
  });

  it('rejects corrupt, illegal, stale and altered-identity saves', () => {
    const raw = Daily.serializeRun(Daily.createRun(challenge));
    const cases = [
      null, { ...raw, v: 2 }, { ...raw, practice: 'yes' }, { ...raw, moves: [[-1, 0]] },
      { ...raw, moves: [[0.5, 0]] }, { ...raw, moves: [[100, 100]] },
      { ...raw, moves: Array(41).fill([0, 0]) },
      { ...raw, challenge: { ...challenge, seed: challenge.seed + 1 } },
      { ...raw, challenge: { ...challenge, generator: 2 } }
    ];
    for (const bad of cases) { expect(Daily.replayRun(bad)).toBeNull(); }
    expect(Daily.loadActive(storage({ [Daily.ACTIVE_KEY]: '{oops' })).status).toBe('invalid');
    expect(Daily.loadActive(storage({ [Daily.ACTIVE_KEY]: JSON.stringify({ ...raw, v: 2 }) })).status).toBe('invalid');
  });

  it('never permits undo in the first run; practice has exact undo and no free-play writes', () => {
    const ranked = Daily.createRun(challenge);
    const played = Daily.playMove(ranked, ...firstMove(ranked)).run;
    expect(Daily.undoPractice(played)).toBeNull();
    const practice = Daily.createRun(challenge, true);
    const practicePlayed = Daily.playMove(practice, ...firstMove(practice)).run;
    expect(Daily.undoPractice(practicePlayed).state).toEqual(practice.state);
    expect(Daily.undoPractice(practice)).toBeNull();
    const local = storage({ [Core.BEST_KEY]: 'untouched', [Core.PREFS_KEY]: 'untouched' });
    Daily.saveActive(local, practicePlayed);
    expect(local.data[Core.BEST_KEY]).toBe('untouched');
    expect(local.data[Core.PREFS_KEY]).toBe('untouched');
  });

  it('resumes separate dates even when today is opened before yesterday is finished', () => {
    const local = storage();
    let previous = Daily.createRun(Daily.makeChallenge('2026-10-20'));
    previous = Daily.playMove(previous, ...firstMove(previous)).run;
    expect(Daily.saveActive(local, previous)).toBe(true);
    let today = Daily.createRun(challenge);
    today = Daily.playMove(today, ...firstMove(today)).run;
    expect(Daily.saveActive(local, today)).toBe(true);
    expect(Daily.loadActive(local, previous.challenge).run).toEqual(previous);
    expect(Daily.loadActive(local, challenge).run).toEqual(today);
    expect(Daily.loadActive(local).run).toEqual(today);
    expect(Daily.readDailyStatus(local, Date.parse('2026-10-21T18:00:00Z')).previous).toEqual(previous);
  });

  it('migrates an existing single-pointer active run before replacing it', () => {
    const previous = Daily.createRun(Daily.makeChallenge('2026-10-20'));
    const local = storage({ [Daily.ACTIVE_KEY]: JSON.stringify(Daily.serializeRun(previous)) });
    Daily.saveActive(local, Daily.createRun(challenge));
    expect(Daily.loadActive(local, previous.challenge).run).toEqual(previous);
  });

  it('survives denied reads, denied writes, quota failure and unavailable storage', () => {
    const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    const quota = { getItem: () => null, setItem() { throw new Error('quota'); } };
    const run = Daily.createRun(challenge);
    expect(Daily.loadActive(denied).status).toBe('unavailable');
    expect(Daily.loadActive(null).status).toBe('unavailable');
    expect(Daily.saveActive(denied, run)).toBe(false);
    expect(Daily.saveActive(quota, run)).toBe(false);
    expect(Daily.readDailyStatus(denied).status).toBe('new');
  });
});

describe('Daily Dump first results and hub contract', () => {
  it('records only a completed ranked result and keeps the first completion immutable', () => {
    const local = storage();
    const initial = Daily.createRun(challenge);
    expect(Daily.recordCompletion(local, initial).result).toBeNull();
    const first = finish(initial);
    const recorded = Daily.recordCompletion(local, first, Date.parse('2026-10-21T17:00:00Z'));
    expect(recorded.saved).toBe(true);
    expect(recorded.result.score).toBe(first.state.score);
    const saved = local.data[Daily.RESULT_PREFIX + challenge.id];
    const second = finish(Daily.createRun(challenge), true);
    const again = Daily.recordCompletion(local, second, Date.parse('2026-10-21T18:00:00Z'));
    expect(again.result).toEqual(recorded.result);
    expect(local.data[Daily.RESULT_PREFIX + challenge.id]).toBe(saved);
    expect(Daily.recordCompletion(local, finish(Daily.createRun(challenge, true))).result).toBeNull();
    expect(local.data[Daily.RESULT_PREFIX + challenge.id]).toBe(saved);
  });

  it('validates results by legal replay and does not trust a fabricated final score', () => {
    const complete = finish(Daily.createRun(challenge));
    const local = storage();
    Daily.recordCompletion(local, complete);
    const key = Daily.RESULT_PREFIX + challenge.id;
    const raw = JSON.parse(local.data[key]);
    raw.score = 999999;
    local.setItem(key, JSON.stringify(raw));
    expect(Daily.loadResult(local, challenge).score).toBe(complete.state.score);
    raw.moves.push([999, 999]);
    local.setItem(key, JSON.stringify(raw));
    expect(Daily.loadResult(local, challenge)).toBeNull();
  });

  it('keeps an in-memory completed result when storage is unavailable', () => {
    const run = finish(Daily.createRun(challenge));
    const recorded = Daily.recordCompletion(null, run);
    expect(recorded.saved).toBe(false);
    expect(recorded.result.score).toBe(run.state.score);
  });

  it('provides honest new, continue and completed hub states for today', () => {
    const now = Date.parse('2026-10-21T18:00:00Z');
    const local = storage();
    expect(Daily.readDailyStatus(local, now).status).toBe('new');
    let run = Daily.createRun(challenge);
    run = Daily.playMove(run, ...firstMove(run)).run;
    Daily.saveActive(local, run);
    expect(Daily.readDailyStatus(local, now).status).toBe('continue');
    run = finish(run);
    Daily.saveActive(local, run);
    Daily.recordCompletion(local, run, now);
    const summary = Daily.readDailyStatus(local, now);
    expect(summary.status).toBe('completed');
    expect(summary.result.score).toBe(run.state.score);
    expect(summary.resume).toBeNull();
  });
});

describe('Daily Dump sharing destinations', () => {
  it('preserves the deployed root or project prefix and removes unrelated parameters', () => {
    for (const prefix of ['', '/StalemateSite/play']) {
      const source = `https://example.test${prefix}/turdomania.html?seed=7&daily=today#board`;
      const link = Daily.challengeLink(challenge, source);
      expect(link).toBe(`https://example.test${prefix}/turdomania.html?daily=2026-10-21&v=1`);
      expect(Daily.parseChallengeRequest(new URL(link).searchParams, Date.parse('2026-10-21T18:00:00Z')).challenge).toEqual(challenge);
    }
    expect(() => Daily.challengeLink(challenge, 'javascript:alert(1)')).toThrow();
  });

  it('includes branding, date, rules, result, link and an explicit practice label', () => {
    const run = finish(Daily.createRun(challenge));
    const link = Daily.challengeLink(challenge, 'https://example.test/play/turdomania.html');
    const text = Daily.shareText(Daily.summarize(run), link);
    expect(text).toContain('Stalemate Arcade · The Daily Dump');
    expect(text).toContain('2026-10-21 · Turdomania · rules v1');
    expect(text).toContain(`${run.state.score} points`);
    expect(text).toContain(link);
    expect(Daily.shareText(Daily.summarize({ ...run, practice: true }), link)).toContain('Practice:');
  });
});
