import { describe, expect, it } from 'vitest';
import { TurdanoidBrickRace, advanceBrickRacer, brickRaceWall, brickRacePaddle, BRICK_COUNTDOWN_MS } from '../games/turdanoid-race.js';
import { ACTION_INPUT_BUFFER_MS } from '../games/arcade-action-clock.js';

const id = 'brick-race-fixture', now = 10000, start = now + BRICK_COUNTDOWN_MS;
const seed = 3;
const gameFor = (selected = seed) => new TurdanoidBrickRace(id, now, null, selected);
const input = (game, seat, sequence, inputs, at = start) =>
  game.command(seat, { version: 1, id, action: 'input', sequence, inputs }, at);
const at = tick => start + Math.ceil(tick * 1000 / 120);
const confirm = tick => at(tick) + ACTION_INPUT_BUFFER_MS;

describe('authoritative same-wall Turdanoid', () => {
  it('gives both players the same authored wall and fences input and countdown', () => {
    const game = gameFor(), a = game.view('a', now), b = game.view('b', now);
    expect(a).toMatchObject({ phase: 'countdown', startsAt: start, wall: { name: 'Fresh Tiles', total: 21 } });
    expect(a.runner.run.hp).toEqual(b.runner.run.hp);
    expect(input(game, 'a', 1, [[1, 'serve']], start - 1).reason).toBe('countdown');
    expect(input(game, null, 1, [[1, 'serve']]).reason).toBe('unavailable');
    expect(input(game, 'a', 1, [[1, 'aim', 1001]]).reason).toBe('invalid-input');
    expect(input(game, 'a', 1, [[1, 'axis', 2]]).reason).toBe('invalid-input');
    expect(input(game, 'a', 1, [[14, 'serve']]).reason).toBe('invalid-tick');
    expect(input(game, 'a', 1, [[1, 'aim', 500], [2, 'serve']]).ok).toBe(true);
    expect(input(game, 'a', 1, [[1, 'serve']]).reason).toBe('sequence');
    expect(input(game, 'b', 1, [[1, 'serve']], confirm(1)).reason).toBe('late-input');
    const record = game.checkpoint();
    expect(TurdanoidBrickRace.restore(record).view('a', confirm(1))).toEqual(game.view('a', confirm(1)));
    record.racers.b.run.hp[0] = -5;
    expect(() => TurdanoidBrickRace.restore(record)).toThrow('Invalid Turdanoid checkpoint');
  });

  it('hits the same bricks and keeps controls in sync with a delayed seat', () => {
    let game = gameFor();
    const controls = [[2, 'serve'], [4, 'aim', 555]];
    expect(input(game, 'a', 1, controls)).toEqual({ ok: true });
    expect(input(game, 'b', 1, controls, at(2) + 220)).toEqual({ ok: true });
    const predicted = game.view('b', at(2) + 220).runner;
    advanceBrickRacer(predicted, 110, brickRaceWall(seed), seed);
    game = TurdanoidBrickRace.restore(game.checkpoint());
    game.expire(confirm(110));
    const a = game.view('a', confirm(110)), b = game.view('b', confirm(110));
    expect(a.players.a.broken).toBeGreaterThan(0);
    expect(a.players.a).toEqual(a.players.b);
    expect(a.runner.run).toEqual(b.runner.run);
    expect(b.runner.run).toEqual(predicted.run);
  });

  it('catches a ball at the paddle and accepts an explicit second serve', () => {
    const saved = gameFor().checkpoint();
    const run = saved.racers.a.run, paddle = brickRacePaddle(run);
    run.powers.sticky = 40;
    Object.assign(run.ball, { y: paddle.y - run.ball.r - .25, vx: 0, vy: 5, stuck: false });
    const game = TurdanoidBrickRace.restore(saved);
    game.expire(confirm(2));
    expect(game.view('a', confirm(2)).runner.run).toMatchObject({ rebounds: 1, ball: { stuck: true } });
    expect(input(game, 'a', 1, [[45, 'serve']], at(45)).ok).toBe(true);
    game.expire(confirm(46));
    expect(game.view('a', confirm(46)).runner.run).toMatchObject({ serves: 1, ball: { stuck: false } });
  });

  it('stops both simulations on the first clear and ranks exact simultaneous clears equally', () => {
    const wall = brickRaceWall(seed);
    for (const finishers of [['a'], ['a', 'b']]) {
      const saved = gameFor().checkpoint();
      for (const seat of finishers) {
        const run = saved.racers[seat].run, last = wall.bricks.at(-1);
        run.hp.fill(0);
        run.hp[run.hp.length - 1] = 1;
        run.broken = wall.total - 1;
        Object.assign(run.ball, { x: last.x + last.w / 2, y: last.y + last.h + run.ball.r + .1, stuck: false, vx: 0, vy: -5 });
      }
      const game = TurdanoidBrickRace.restore(saved);
      expect(game.expire(confirm(200))).toBe(true);
      const expected = { reason: 'clear', tick: 1, winner: finishers.length === 2 ? null : 'a' };
      expect(game.view('a', confirm(200)).result).toEqual(expected);
      expect(game.view('b', confirm(200)).runner.tick).toBe(1);
      expect(TurdanoidBrickRace.restore(game.checkpoint()).view(null, confirm(200)).result).toEqual(expected);
    }
  });

  it('resolves the time limit by progress and preserves forfeit and out verdicts', () => {
    const game = gameFor();
    expect(input(game, 'a', 1, [[1, 'serve']]).ok).toBe(true);
    expect(game.expire(game.deadline)).toBe(true);
    expect(game.view(null, at(9000)).result).toEqual({ winner: 'a', tick: 9000, reason: 'time' });
    const forfeit = gameFor();
    expect(forfeit.command('b', { version: 1, id, action: 'resign' }, start).ok).toBe(true);
    expect(TurdanoidBrickRace.restore(forfeit.checkpoint()).view(null, start).result).toEqual({ winner: 'a', tick: 0, reason: 'resign' });
    const checkpoint = gameFor().checkpoint();
    for (const seat of ['a', 'b']) {
      const run = checkpoint.racers[seat].run;
      run.lives = 1;
      Object.assign(run.ball, { y: 407, vy: 5, stuck: false });
    }
    const out = TurdanoidBrickRace.restore(checkpoint);
    expect(out.expire(confirm(2))).toBe(true);
    expect(out.view(null, confirm(2)).result).toEqual({ winner: null, tick: 1, reason: 'out' });
  });
});
