import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const context = {};
runInNewContext(readFileSync('games/suite-progress-core.js', 'utf8'), context);
const Core = context.SuiteProgressCore;
const clean = value => JSON.parse(JSON.stringify(value));
function session() {
  let state = Core.newState('progress-test-namespace');
  return {
    get state() { return state; },
    id(game) { const result = Core.allocate(state, game); state = result.state; return result.id; },
    record(event, at = 1000) { const result = Core.record(state, event, at); state = result.state; return result; },
    reload() { state = Core.parse(JSON.stringify(state)); }
  };
}
function event(id, game, extra = {}) { return { id, game, kind: 'run', outcome: 'complete', ...extra }; }

describe('optional device progress core', () => {
  it('has exactly twelve named, actionable goals across the eight promoted games', () => {
    expect(Core.GOALS).toHaveLength(12);
    expect(new Set(Core.GOALS.map(goal => goal.game)).size).toBe(8);
    expect(new Set(Core.GOALS.map(goal => goal.id)).size).toBe(12);
    expect(Core.GOALS.every(goal => goal.title && goal.description && goal.icon)).toBe(true);
    expect(Core.GAMES.map(game => game.href)).toEqual(['TurdAnoid.html', 'turdtris.html', 'turdjack.html', 'crapeights.html', 'turdrummy.html', 'turdspades.html', 'turdomania.html', 'chess.html']);
  });

  it.each([
    ['ta-stage', 'turdanoid', { mode: 'classic', levelsCleared: 1 }],
    ['ta-combo', 'turdanoid', { maxCombo: 5 }],
    ['tt-lines', 'turdtris', { mode: 'classic', lines: 10 }],
    ['tt-sprint', 'turdtris', { mode: 'sprint', lines: 40, completed: true, elapsedMs: 50000 }],
    ['jack-win', 'turdjack', { kind: 'hand', outcome: 'win', net: 5 }],
    ['jack-natural', 'turdjack', { kind: 'hand', outcome: 'win', net: 15, natural: true }],
    ['eights-round', 'crapeights', { kind: 'round', roundWon: true }],
    ['eights-match', 'crapeights', { kind: 'match', matchWon: true }],
    ['rummy-gin', 'turdrummy', { kind: 'round', gin: true }],
    ['spades-contract', 'turdspades', { kind: 'round', bid: 5, tricks: 5, outcome: 'loss', team: 'you-north' }],
    ['mania-clear', 'turdomania', { cleared: true, left: 0 }],
    ['chess-finish', 'chess', { completed: true, moves: 7, local: true, assisted: true }]
  ])('awards %s from its actual criterion only once', (goal, game, values) => {
    const s = session(); const input = event(s.id(game), game, values);
    const first = s.record(input);
    expect(first.recorded).toBe(true);
    expect(first.newlyEarned.find(item => item.id === goal)?.title).toBeTruthy();
    s.reload();
    expect(s.record(input).newlyEarned).toHaveLength(0);
    expect(s.state.history[game]).toHaveLength(1);
    expect(Core.parse(JSON.stringify(s.state))).not.toBeNull();
  });

  it.each([
    ['turdanoid', { levelsCleared: 0, maxCombo: 4 }],
    ['turdtris', { mode: 'ultra', lines: 10 }],
    ['turdtris', { mode: 'sprint', completed: false, lines: 40 }],
    ['turdtris', { mode: 'sprint', completed: true, lines: 39 }],
    ['turdjack', { kind: 'hand', outcome: 'draw', natural: true, net: 0 }],
    ['turdjack', { kind: 'hand', outcome: 'win', natural: true, net: 0 }],
    ['turdspades', { kind: 'round', bid: 0, tricks: 13 }],
    ['turdspades', { kind: 'round', bid: 5, tricks: 4 }],
    ['turdomania', { cleared: false, left: 1, score: 999999 }],
    ['chess', { completed: true, moves: 0 }]
  ])('does not infer achievement from a near miss in %s', (game, values) => {
    const s = session(); expect(s.record(event(s.id(game), game, values)).newlyEarned).toHaveLength(0);
  });

  it('keeps ten actual completions per game but deduplicates evicted IDs after reload', () => {
    const s = session(); let oldest;
    for (let n = 1; n <= 25; n++) {
      const input = event(s.id('turdanoid'), 'turdanoid', { score: n }); oldest ||= input;
      s.record(input, n);
    }
    s.record(event(s.id('chess'), 'chess', { completed: true, moves: 3 }), 30);
    expect(s.state.history.turdanoid.map(entry => entry.score)).toEqual([16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);
    expect(s.state.history.chess).toHaveLength(1);
    expect(Object.values(s.state.receipts)[0]).toEqual([[1, 25]]);
    s.reload(); expect(s.record(oldest).recorded).toBe(false);
    expect(s.state.history.turdanoid).toHaveLength(10);
  });

  it('keeps round-only proof in the ledger without inventing completed-match history', () => {
    const s = session(); const round = event(s.id('crapeights'), 'crapeights', { kind: 'round', history: false, roundWon: true });
    expect(s.record(round).newlyEarned.map(goal => goal.id)).toEqual(['eights-round']);
    expect(s.state.history.crapeights).toBeUndefined();
    s.reload(); expect(s.record(round).recorded).toBe(false);
  });

  it('updates the same Turdomania board after Undo and awards a newly achieved clear once', () => {
    const s = session(); const id = s.id('turdomania');
    s.record(event(id, 'turdomania', { cleared: false, left: 2, score: 100, mode: 'normal', difficulty: 'normal' }));
    s.reload();
    const update = s.record(event(id, 'turdomania', { cleared: true, left: 0, score: 1200, mode: 'normal', difficulty: 'normal' }), 2000);
    expect(update).toMatchObject({ recorded: false, updated: true });
    expect(update.newlyEarned.map(goal => goal.id)).toEqual(['mania-clear']);
    expect(s.state.history.turdomania).toHaveLength(1);
    expect(s.state.history.turdomania[0]).toMatchObject({ cleared: true, at: 2000, score: 1200 });
    expect(s.record(event(id, 'turdomania', { cleared: true, left: 0, score: 1200 })).newlyEarned).toHaveLength(0);
  });

  it('never reintroduces an evicted board into history even if a later finish meets a new goal', () => {
    const s = session(); const old = s.id('turdomania'); s.record(event(old, 'turdomania', { cleared: false }));
    for (let n = 0; n < 10; n++) {s.record(event(s.id('turdomania'), 'turdomania', { cleared: false }));}
    const result = s.record(event(old, 'turdomania', { cleared: true }));
    expect(result.recorded).toBe(false); expect(result.updated).toBe(false);
    expect(result.newlyEarned.map(goal => goal.id)).toEqual(['mania-clear']);
    expect(s.state.history.turdomania.some(entry => entry.id === old)).toBe(false);
  });

  it('compares completed peers within mode and difficulty, preserving the best beyond ten displayed runs', () => {
    const s = session();
    const finish = (score, mode = 'classic', difficulty = 'normal') => s.record(event(s.id('turdtris'), 'turdtris', { mode, difficulty, score }));
    expect(finish(1000).improvement).toBeNull();
    expect(finish(900).improvement).toBeNull();
    expect(finish(1400).improvement).toBe('400 points above your previous completed best');
    expect(finish(999999, 'ultra').improvement).toBeNull();
    expect(finish(999999, 'classic', 'easy').improvement).toBeNull();
    for (let n = 0; n < 11; n++) {finish(1);}
    s.reload();
    expect(finish(1300).improvement).toBeNull();
    expect(finish(1500).improvement).toBe('100 points above your previous completed best');
  });

  it('compares lower Sprint times only among completed forty-line peers', () => {
    const s = session();
    const finish = values => s.record(event(s.id('turdtris'), 'turdtris', { mode: 'sprint', difficulty: 'normal', ...values }));
    expect(finish({ elapsedMs: 5000, completed: false, lines: 10 }).improvement).toBeNull();
    expect(finish({ elapsedMs: 60000, completed: true, lines: 40 }).improvement).toBeNull();
    expect(finish({ elapsedMs: 58000, completed: true, lines: 40 }).improvement).toBe('2.00 seconds faster than your previous completed Sprint');
    expect(finish({ elapsedMs: 1, completed: true, lines: 39 }).improvement).toBeNull();
    expect(finish({ elapsedMs: 59000, completed: true, lines: 40 }).improvement).toBeNull();
  });

  it.each(['mixed', 'unknown', undefined])('does not compare unrepeatable %s difficulty mixtures as personal bests', difficulty => {
    const s = session();
    for (const game of ['turdanoid', 'turdtris', 'turdomania']) {
      const mode = game === 'turdomania' ? 'normal' : 'classic';
      s.record(event(s.id(game), game, { mode, difficulty, score: 50 }));
      expect(s.record(event(s.id(game), game, { mode, difficulty, score: 500 })).improvement).toBeNull();
    }
    s.record(event(s.id('turdtris'), 'turdtris', { mode: 'sprint', difficulty, lines: 40, completed: true, elapsedMs: 60000 }));
    expect(s.record(event(s.id('turdtris'), 'turdtris', { mode: 'sprint', difficulty, lines: 40, completed: true, elapsedMs: 30000 })).improvement).toBeNull();
    expect(s.state.bests).toEqual({});
  });

  it('preserves actual optional chess winner and reason through stored-history validation', () => {
    const s = session();
    s.record(event(s.id('chess'), 'chess', { kind: 'match', local: true, winner: 'b', reason: 'Resignation', completed: true, moves: 1 }));
    s.reload();
    expect(s.state.history.chess[0]).toMatchObject({ winner: 'b', reason: 'Resignation', moves: 1 });
    for (const value of [{ winner: 'red' }, { reason: '<script>' }, { reason: 'x'.repeat(81) }]) {
      expect(s.record(event(s.id('chess'), 'chess', value)).error).toBe('invalid');
    }
    expect(s.record(event(s.id('chess'), 'chess', { winner: null, reason: 'Stalemate' })).entry.winner).toBeNull();
  });

  it('compares Turdomania only with actual matching board dimensions, mode and difficulty', () => {
    const s = session();
    const finish = values => s.record(event(s.id('turdomania'), 'turdomania', { mode: 'normal', difficulty: 'normal', score: 100, ...values }));
    expect(finish({ cols: 8, rows: 10 }).improvement).toBeNull();
    expect(finish({ cols: 10, rows: 12, score: 1000 }).improvement).toBeNull();
    expect(finish({ cols: 8, rows: 10, score: 500 }).improvement).toBe('400 points above your previous completed best');
    expect(finish({ score: 10000 }).improvement).toBeNull();
    s.reload();
    expect(finish({ cols: 10, rows: 12, score: 1100 }).improvement).toBe('100 points above your previous completed best');
    expect(finish({ cols: 0, rows: 10 }).error).toBe('invalid');
    expect(finish({ cols: 8, rows: 65 }).error).toBe('invalid');
    expect(s.state.history.turdomania[0]).toMatchObject({ cols: 8, rows: 10 });
  });

  it('keeps measured goal progress from real finishes after history eviction, without mistaking an unfinished Sprint for success', () => {
    const s = session();
    s.record(event(s.id('turdanoid'), 'turdanoid', { mode: 'classic', levelsCleared: 0, maxCombo: 4 }));
    s.record(event(s.id('turdtris'), 'turdtris', { mode: 'classic', lines: 7, score: 100 }));
    s.record(event(s.id('turdtris'), 'turdtris', { mode: 'sprint', lines: 37, elapsedMs: 60000, completed: false }));
    for (let n = 0; n < 11; n++) {s.record(event(s.id('turdtris'), 'turdtris', { mode: 'classic', lines: 1, score: 10 }));}
    s.reload();
    expect(s.state.progress).toEqual({ 'ta-stage': 0, 'ta-combo': 4, 'tt-lines': 7, 'tt-sprint': 37 });
    expect(s.state.earned['tt-lines']).toBeUndefined(); expect(s.state.earned['tt-sprint']).toBeUndefined();
    s.record(event(s.id('turdtris'), 'turdtris', { mode: 'sprint', lines: 40, completed: false }));
    expect(s.state.progress['tt-sprint']).toBe(40); expect(s.state.earned['tt-sprint']).toBeUndefined();
    const bad = clean(s.state); bad.progress['tt-lines'] = 11;
    expect(Core.parse(JSON.stringify(bad))).toBeNull();
  });

  it('does not turn cards or chess into score/strength comparisons', () => {
    const s = session();
    for (const game of ['turdjack', 'turdrummy', 'crapeights', 'turdspades', 'chess']) {
      s.record(event(s.id(game), game, { score: 5 }));
      expect(s.record(event(s.id(game), game, { score: 999999 })).improvement).toBeNull();
    }
  });

  it('recovers only proved legacy badges, without fabricated events or completion dates', () => {
    const source = { turdtrisSprint40BestMs_v1: '60000', turdtrisHighScore: '1000000', turdanoid_v2_best: '900000', turdomania_best_v1: '{"best":{"normal":90000}}', turdjackStats: '{"wins":2,"blackjacks":1}', crapeightsStats: '{"roundsWon":3,"matchesWon":1}', turdrummy_stats_v1: '{"stats":{"playerGins":1}}', arcade_chess_results_v1: '{"version":1,"local":9}' };
    const result = Core.recoverLegacy(session().state, key => source[key]);
    expect(result.newlyEarned.map(goal => goal.id)).toEqual(['tt-sprint', 'jack-win', 'jack-natural', 'eights-round', 'eights-match', 'rummy-gin']);
    expect(result.state.history).toEqual({}); expect(result.state.receipts).toEqual({});
    expect(Object.values(result.state.earned).every(value => JSON.stringify(value) === '{"source":"legacy"}')).toBe(true);
    expect(Core.recoverLegacy(result.state, key => source[key]).newlyEarned).toHaveLength(0);
  });

  it('ignores malformed/denied legacy storage rather than guessing from scores', () => {
    for (const read of [() => { throw new Error('denied'); }, () => '{bad', () => '{"wins":"8","roundsWon":-1}', () => 'Infinity']) {
      expect(Core.recoverLegacy(session().state, read).newlyEarned).toHaveLength(0);
    }
    expect(Core.recoverLegacy(session().state, key => key === 'turdjackStats' ? '{"wins":7,"losses":9,"blackjacks":0}' : null).newlyEarned).toHaveLength(0);
    expect(Core.recoverLegacy(session().state, key => key === 'turdjackStats' ? '{"wins":1,"blackjacks":9}' : null).newlyEarned).toHaveLength(0);
  });

  it.each([null, '{}', '{bad', '{"__proto__":{}}', JSON.stringify({ version: 99 }), 'x'.repeat(140000)])('rejects corrupt or oversized progress safely', raw => {
    expect(Core.parse(raw)).toBeNull();
  });

  it('rejects invalid counters, mismatched IDs, nonfinite metrics and markup slugs', () => {
    const s = session(); const id = s.id('turdtris');
    for (const values of [{ score: Infinity }, { score: 1.5 }, { elapsedMs: 1.5 }, { mode: '<img>' }, { completed: 'true' }, { game: 'chess' }, { id: 'old-game-suffix-1' }]) {
      expect(s.record(event(id, 'turdtris', values)).error).toBe('invalid');
    }
    const raw = clean(s.state); raw.next.chess = -1; expect(Core.parse(JSON.stringify(raw))).toBeNull();
  });

  it('preserves fractional Crapjack payouts and negative Spades team scores', () => {
    const s = session();
    expect(s.record(event(s.id('turdjack'), 'turdjack', { kind: 'hand', outcome: 'win', natural: true, net: 7.5, score: 107.5 })).entry).toMatchObject({ net: 7.5, score: 107.5 });
    expect(s.record(event(s.id('turdspades'), 'turdspades', { kind: 'match', outcome: 'loss', score: -45 })).entry.score).toBe(-45);
  });

  it('fails at bounded ledger capacity without evicting receipts or altering the existing state', () => {
    const s = session();
    for (let n = 0; n < Core.MAX_RANGES; n++) { s.id('chess'); s.record(event(s.id('chess'), 'chess', { moves: 1, completed: true })); }
    const before = JSON.stringify(s.state);
    s.id('chess'); const id = s.id('chess'); const allocated = JSON.stringify(s.state);
    const result = s.record(event(id, 'chess', { moves: 1, completed: true }));
    expect(result.error).toBe('capacity'); expect(result.recorded).toBe(false);
    expect(JSON.stringify(s.state)).toBe(allocated); expect(before.length).toBeGreaterThan(0);
    expect(Core.parse(JSON.stringify(s.state))).not.toBeNull();
  });
});
