import { describe, expect, it } from 'vitest';
import { advance, act, createRun, startRun, TUNING } from '../games/turdrush-core.js';
import {
  TurdRushRace, RUSH_COURSE_METRES, RUSH_COUNTDOWN_MS, RUSH_INPUT_BUFFER_MS, RUSH_TICKS_PER_SECOND,
  advanceRushRacer, unpackRushRacer
} from '../games/turdrush-race.js';

const seed = 42, id = 'rush-race-fixture', now = 10000, start = now + RUSH_COUNTDOWN_MS;
const make = (course = seed) => new TurdRushRace(id, now, null, course);
const pop = (game, seat, sequence, inputs, time) => game.command(seat, { version: 1, id, action: 'input', sequence, inputs }, time);
const timeAt = tick => start + Math.ceil(tick * 1000 / RUSH_TICKS_PER_SECOND);
const settledAt = tick => timeAt(tick) + RUSH_INPUT_BUFFER_MS;
const obstacles = ['barrier', 'crate', 'beam'];

function coursePlan(course) {
  const run = createRun(course), commands = [];
  startRun(run);
  let last = 0, skilledRow = -1;
  for (let tick = 1; tick < 5400 && run.phase === 'running' && run.distance < RUSH_COURSE_METRES; tick++) {
    const next = run.entities.find(entity => obstacles.includes(entity.kind) && entity.at > run.distance + .62);
    if (next && tick - last >= 12) {
      const row = run.entities.filter(entity => obstacles.includes(entity.kind) && entity.at === next.at);
      const gap = next.at - run.distance;
      const safe = [0, 1, 2].find(lane => row.every(entity => entity.lane !== lane));
      let move;
      if (safe !== undefined && gap < 13 && safe !== run.player.lane) { move = safe < run.player.lane ? 'left' : 'right'; }
      if (safe === undefined && skilledRow !== next.at && gap <= run.speed * .27) {
        move = next.kind === 'crate' ? 'jump' : 'slide';
        skilledRow = next.at;
      }
      if (move && act(run, move).length) { commands.push([tick, move]); last = tick; }
    }
    advance(run, TUNING.fixedStep);
  }
  expect(run.distance).toBeGreaterThanOrEqual(RUSH_COURSE_METRES);
  return commands;
}

describe('authoritative same-course Turd Rush', () => {
  it('starts from the same obstacles and fences early, late, future, paced and spectator input', () => {
    const game = make(), a = game.view('a', now), b = game.view('b', now);
    expect(a).toMatchObject({ phase: 'countdown', startsAt: start, seed, course: RUSH_COURSE_METRES });
    expect(a.runner.run.entities).toEqual(b.runner.run.entities);
    expect(pop(game, 'a', 1, [[1, 'left']], start - 1).reason).toBe('countdown');
    expect(pop(game, null, 1, [[1, 'left']], start).reason).toBe('unavailable');
    expect(pop(game, 'a', 1, [[1, 'warp']], start).reason).toBe('invalid-input');
    expect(pop(game, 'a', 1, [[14, 'left']], start).reason).toBe('invalid-tick');
    expect(pop(game, 'a', 1, [[2, 'left'], [1, 'right']], start).reason).toBe('invalid-tick');
    expect(pop(game, 'a', 1, [[1, 'left'], [2, 'right'], [3, 'jump'], [4, 'slide']], start).ok).toBe(true);
    expect(pop(game, 'a', 1, [[1, 'left']], start).reason).toBe('sequence');
    expect(pop(game, 'a', 2, [[4, 'right'], [4, 'right'], [4, 'right']], start).reason).toBe('input-paced');
    expect(pop(game, 'b', 1, [[1, 'jump']], settledAt(1)).reason).toBe('late-input');
    expect(TurdRushRace.restore(game.checkpoint()).view('a', settledAt(1))).toEqual(game.view('a', settledAt(1)));
  });

  it('replays fast correction and deliberate cancellation through the same bounded lane target', () => {
    const game = make();
    expect(pop(game, 'a', 1, [[1, 'right'], [2, 'swipe-left'], [3, 'swipe-left']], start).ok).toBe(true);
    expect(pop(game, 'b', 1, [[1, 'right'], [2, 'swipe-left'], [3, 'swipe-left'], [4, 'cancel-swipe']], start).ok).toBe(true);
    const prediction = unpackRushRacer(game.view('a', start).runner);
    advanceRushRacer(prediction, 50);
    game.expire(settledAt(50));
    expect(game.view('a', settledAt(50)).runner.run.player).toMatchObject({ lane: 0, x: -2.4 });
    expect(game.view('b', settledAt(50)).runner.run.player).toMatchObject({ lane: 2, x: 2.4 });
    expect(prediction.run.player).toEqual(game.view('a', settledAt(50)).runner.run.player);
  });

  it('accepts a delayed dodge before collision at the original tick and rejects it once committed', () => {
    const game = make();
    const hazards = unpackRushRacer(game.view('a', start).runner).run.entities
      .filter(entity => entity.at === 100 && obstacles.includes(entity.kind));
    const safe = [0, 1, 2].find(lane => hazards.every(entity => entity.lane !== lane));
    const danger = hazards.find(entity => entity.lane !== 1).lane;
    const into = danger < 1 ? 'left' : 'right';
    const dodge = safe < danger ? 'swipe-left' : 'swipe-right';
    for (const seat of ['a', 'b']) { expect(pop(game, seat, 1, [[1, into]], start).ok).toBe(true); }
    const earlyTick = 880;
    const corrections = Array.from({ length: Math.abs(safe - danger) }, (_, index) => [earlyTick + index, dodge]);
    expect(pop(game, 'a', 2, corrections, timeAt(earlyTick) + 400).ok).toBe(true);
    expect(pop(game, 'b', 2, [[earlyTick, dodge]], settledAt(earlyTick)).reason).toBe('late-input');
    game.expire(settledAt(1000));
    expect(game.view('a', settledAt(1000)).players).toMatchObject({ a: { status: 'running' }, b: { status: 'crashed' } });
    expect(TurdRushRace.restore(game.checkpoint()).view('a', settledAt(1000))).toEqual(game.view('a', settledAt(1000)));
  });

  it('finishes the entire course equally with immediate and delayed inputs', () => {
    for (const course of [1, 23, seed]) {
      let game = make(course);
      for (const [index, input] of coursePlan(course).entries()) {
        const now = timeAt(input[0]);
        expect(pop(game, 'a', index + 1, [input], now).ok).toBe(true);
        expect(pop(game, 'b', index + 1, [input], now + 220).ok).toBe(true);
        if (index % 3 === 0) { game = TurdRushRace.restore(game.checkpoint()); }
      }
      expect(game.expire(game.deadline)).toBe(true);
      const result = game.view(null, settledAt(5400));
      expect(result.players.a).toEqual(result.players.b);
      expect(result.players.a).toMatchObject({ status: 'finished' });
      expect(result.players.a.distance).toBeGreaterThanOrEqual(RUSH_COURSE_METRES);
      expect(result.result).toMatchObject({ reason: 'course', winner: null });
      expect(TurdRushRace.restore(game.checkpoint()).view(null, settledAt(5400))).toEqual(result);
    }
  });

  it('rejects corrupt snapshots and preserves an explicit forfeit across restore', () => {
    const game = make(), checkpoint = game.checkpoint();
    checkpoint.racers.a.run.entities[0][1] = 100;
    expect(() => TurdRushRace.restore(checkpoint)).toThrow('Invalid Turd Rush checkpoint');
    expect(game.command('b', { version: 1, id, action: 'resign' }, start).ok).toBe(true);
    expect(TurdRushRace.restore(game.checkpoint()).view(null, start).result).toEqual({ reason: 'resign', tick: 0, winner: 'a' });
  });
});
