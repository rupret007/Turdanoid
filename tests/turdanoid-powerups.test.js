/**
 * Behaviour of every TurdAnoid power-up (bathroom-punk set), driven through
 * the real TurdAnoid.html in jsdom via window.__turdanoid.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import { POWERS, unlockedPowers } from '../games/turdanoid_logic.js';
import { POWER_DISPLAY_NAMES } from '../games/turdanoid-qa.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(rootDir, 'TurdAnoid.html'), 'utf8');
const levelsCore = readFileSync(join(rootDir, 'games/turdanoid-levels-core.js'), 'utf8');
const storageCore = readFileSync(join(rootDir, 'games/turdanoid-storage-core.js'), 'utf8');
const FRAME = 1000 / 60;

function ctxStub() {
  const gradient = { addColorStop() {} };
  return new Proxy(
    {},
    {
      get(t, prop) {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return () => gradient;
        }
        if (prop in t) {
          return t[prop];
        }
        return () => {};
      },
      set(t, prop, v) {
        t[prop] = v;
        return true;
      }
    }
  );
}

function boot() {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/TurdAnoid.html',
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = () => ctxStub();
      window.requestAnimationFrame = () => 0;
      window.cancelAnimationFrame = () => {};
      window.eval(levelsCore);
      window.eval(storageCore);
    }
  });
  return { dom, g: dom.window.__turdanoid };
}

const hpSum = (bricks) => bricks.filter((b) => !b.indestructible).reduce((s, b) => s + b.hp, 0);

describe('power-up catalogue', () => {
  let g;
  beforeEach(() => {
    ({ g } = boot());
  });

  it('gives every power a unique name, emoji and capsule label that match the QA names', () => {
    const defs = g.powerDefs;
    expect(defs.map((d) => d.t).sort()).toEqual(POWERS.map((p) => p.t).sort());
    expect(new Set(defs.map((d) => d.name)).size).toBe(defs.length);
    expect(new Set(defs.map((d) => d.e)).size).toBe(defs.length);
    expect(new Set(defs.map((d) => d.lab)).size).toBe(defs.length);
    for (const d of defs) {
      expect(POWER_DISPLAY_NAMES[d.t], d.t).toBe(d.name);
      expect(d.lab.length, d.t).toBeLessThanOrEqual(2);
      expect(d.name.length, d.t).toBeLessThanOrEqual(16); // fits the catch label on a 320px phone
      expect(d.blurb.length, d.t).toBeGreaterThan(3);
    }
  });

  it('covers every classic Arkanoid capsule', () => {
    const t = new Set(POWERS.map((p) => p.t));
    for (const classic of ['slow', 'catch', 'enlarge', 'multi', 'laser', 'warp', 'life']) {
      expect(t.has(classic), classic).toBe(true);
    }
  });

  it('keeps Flush Warp rare and the new powers out of level 1-2 pools', () => {
    const pool = unlockedPowers(8, { includeBad: false });
    const total = pool.reduce((s, p) => s + p.weight, 0);
    const warp = pool.find((p) => p.t === 'warp');
    expect(warp.weight / total).toBeLessThan(0.03);
    const early = unlockedPowers(2).map((p) => p.t);
    expect(early).not.toContain('warp');
    expect(early).not.toContain('chord');
  });
});

describe('power-up behaviour', () => {
  let g;
  beforeEach(() => {
    ({ g } = boot());
    g.startGame();
    g.qaJumpToLevel(5);
  });

  const catchLabel = (type) => {
    const name = POWER_DISPLAY_NAMES[type].toUpperCase();
    expect(
      g.floats.some((f) => f.text === name),
      `${type} label`
    ).toBe(true);
  };

  it.each(POWERS.map((p) => p.t))('%s shows its name when caught', (type) => {
    expect(g.qaActivatePower(type)).toBe(true);
    catchLabel(type);
  });

  it('Wide Load widens the paddle', () => {
    const w = g.paddle.w;
    g.qaActivatePower('enlarge');
    expect(g.paddle.w).toBeGreaterThan(w);
    expect(g.activePowers.big).toBeGreaterThan(0);
  });

  it('Air Freshener slows the ball', () => {
    g.launch();
    const before = Math.hypot(g.balls[0].vx, g.balls[0].vy);
    g.qaActivatePower('slow');
    expect(g.activePowers.slow).toBeGreaterThan(0);
    expect(Math.hypot(g.balls[0].vx, g.balls[0].vy)).toBeLessThan(before);
  });

  it('Plunger Catch makes the paddle sticky', () => {
    g.qaActivatePower('catch');
    expect(g.activePowers.sticky).toBeGreaterThan(0);
  });

  it('Mosh Pit splits into three balls', () => {
    g.launch();
    g.qaActivatePower('multi');
    expect(g.balls).toHaveLength(3);
  });

  it('Spare Roll adds a life', () => {
    const lives = g.lives;
    g.qaActivatePower('life');
    expect(g.lives).toBe(lives + 1);
  });

  it('TP Cannon fires two unspooling TP rolls', () => {
    g.qaActivatePower('laser');
    g.fireAll();
    expect(g.lasers).toHaveLength(2);
    for (const l of g.lasers) {
      expect(l.tp).toBe(true);
      expect(typeof l.y0).toBe('number');
      expect(l.vy).toBeLessThan(0);
    }
  });

  it('Spitwad Spread fires a V of wads', () => {
    g.qaActivatePower('paper');
    g.fireAll();
    const wads = g.paddleShots.filter((s) => !s.hotdog);
    expect(wads).toHaveLength(2);
    expect(Math.sign(wads[0].vx)).not.toBe(Math.sign(wads[1].vx));
  });

  it('Seat Cover arms the shield', () => {
    g.qaActivatePower('shield');
    expect(g.activePowers.shield).toBeGreaterThan(0);
  });

  it('Chili Fire sets every ball on fire', () => {
    g.qaActivatePower('fire');
    expect(g.balls.every((b) => b.fire > 0)).toBe(true);
  });

  it('Cherry Bomb damages bricks', () => {
    const hp = hpSum(g.bricks);
    g.qaActivatePower('bomb');
    expect(hpSum(g.bricks)).toBeLessThan(hp);
  });

  it('Dookie Magnet turns on capsule pull', () => {
    g.qaActivatePower('plunger');
    expect(g.activePowers.plunger).toBeGreaterThan(0);
  });

  it('Flush Warp flushes every breakable brick and ends the round', () => {
    const score = g.score;
    g.qaActivatePower('warp');
    expect(g.remainingBreakable).toBe(0);
    expect(g.score).toBeGreaterThan(score);
    expect(g.particles.length).toBeGreaterThan(40); // the drain swirl
    g.step(FRAME);
    expect(g.levelTransition).toBe(true);
  });

  it('Flush Warp leaves steel in place', () => {
    g.qaJumpToLevel(6);
    const steel = g.bricks.filter((b) => b.indestructible).length;
    g.qaActivatePower('warp');
    expect(g.bricks.filter((b) => b.indestructible).length).toBe(steel);
  });

  it.each([0, 1, 2])('catches Flush Warp at capsule index %s and advances with other drops on screen', (warpIndex) => {
    const lives = g.lives;
    const level = g.level;
    for (let i = 0; i < 3; i += 1) {
      g.qaSpawnCapsule(i === warpIndex ? 'warp' : 'life', 0.5, 0.3);
    }
    const warp = g.powerups[warpIndex];
    warp.x = g.paddle.x;
    warp.y = g.paddle.y;
    warp.vy = 0;

    expect(() => g.step(FRAME)).not.toThrow();
    expect(g.powerups).toHaveLength(0);
    expect(g.remainingBreakable).toBe(0);
    expect(g.lives).toBe(lives);
    expect(g.levelTransition).toBe(true);
    expect(g.clearTally).toBeTruthy();
    g.skipClearTally();
    expect(g.level).toBe(level + 1);
    expect(g.levelTransition).toBe(false);
    expect(g.bricks.length).toBeGreaterThan(0);
  });

  it('Mega Wipe clears the bottom row', () => {
    const n = g.bricks.length;
    const maxY = Math.max(...g.bricks.map((b) => b.y));
    g.qaActivatePower('flush');
    expect(g.bricks.length).toBeLessThan(n);
    expect(g.bricks.some((b) => !b.indestructible && b.y >= maxY - 8)).toBe(false);
  });

  it('Wiener Rockets fire hot dogs', () => {
    g.qaActivatePower('hotdog');
    g.fireAll();
    expect(g.paddleShots.filter((s) => s.hotdog)).toHaveLength(2);
  });

  it('Power Chord hits every breakable brick once', () => {
    g.qaJumpToLevel(6);
    const breakable = g.bricks.filter((b) => !b.indestructible);
    const hp = hpSum(g.bricks);
    const steel = g.bricks.filter((b) => b.indestructible).length;
    g.qaActivatePower('chord');
    expect(hpSum(g.bricks)).toBe(hp - breakable.length);
    expect(g.bricks.filter((b) => b.indestructible).length).toBe(steel);
    expect(g.floats.some((f) => f.text.includes('KERRANG'))).toBe(true);
  });

  it('Ghost Poo lets balls phase', () => {
    g.qaActivatePower('ghost');
    expect(g.balls.every((b) => b.ghost > 0)).toBe(true);
  });

  it('Skunk Cloud drops a stink cloud', () => {
    g.qaActivatePower('skunk');
    expect(g.particles.some((p) => p.stink)).toBe(true);
  });

  it('Golden Throne doubles points', () => {
    g.qaActivatePower('gold');
    expect(g.activePowers.gold).toBeGreaterThan(0);
  });

  it('Shrinkage, Bad Curry and Backwash are timed bad pickups', () => {
    const w = g.paddle.w;
    g.qaActivatePower('shrink');
    expect(g.paddle.w).toBeLessThan(w);
    g.qaActivatePower('speed');
    expect(g.activePowers.fast).toBeGreaterThan(0);
    g.qaActivatePower('reverse');
    expect(g.activePowers.reverse).toBeGreaterThan(0);
  });
});

describe('Chili Fire expiry', () => {
  let dom;
  let g;
  beforeEach(() => {
    ({ dom, g } = boot());
    g.startGame();
  });
  afterEach(() => dom.window.close());

  function stepFrames(count, dt = FRAME) {
    for (let i = 0; i < count; i += 1) {
      g.step(dt);
    }
  }

  function aimAtBrick(ball, hp = 10) {
    const brick = { ...g.bricks[0], x: 80, y: 150, w: 40, h: 16, hp, maxHp: hp };
    g.bricks = [brick];
    Object.assign(ball, { x: 100, y: 166 + ball.r, vx: 0, vy: -2 });
    return brick;
  }

  it.each([60, 120])('expires while caught at %s Hz and relaunches with ordinary brick damage', (hz) => {
    g.qaActivatePower('catch');
    g.launch();
    const ball = g.balls[0];
    Object.assign(ball, { x: g.paddle.x, y: g.paddle.y - ball.r, vx: 0, vy: 2 });
    g.step(FRAME);
    expect(ball.stuck).toBe(true);
    g.qaActivatePower('fire');
    stepFrames(hz * 8 - 1, 1000 / hz);
    expect(g.activePowers.fire).toBeGreaterThan(0);
    expect(ball.fire).toBeGreaterThan(0);
    g.step(1000 / hz);
    expect(g.activePowers.fire).toBeUndefined();
    expect(dom.window.document.getElementById('powers').textContent).not.toContain('Chili');
    g.launch();
    const brick = aimAtBrick(ball);
    g.step(FRAME);
    expect(brick.hp).toBe(9);
    expect(ball.vy).toBeGreaterThan(0);
    expect(ball.fire).toBe(0);
  });

  it('clears caught and airborne multiballs together before collisions on the expiry frame', () => {
    g.qaActivatePower('fire');
    stepFrames(479);
    g.qaActivatePower('multi');
    expect(g.balls).toHaveLength(3);
    expect(g.balls.map((ball) => ball.stuck)).toEqual([true, false, false]);
    const brick = aimAtBrick(g.balls[1]);
    g.step(FRAME);
    expect(g.activePowers.fire).toBeUndefined();
    expect(brick.hp).toBe(9);
    expect(g.balls.map((ball) => ball.fire)).toEqual([0, 0, 0]);
    g.qaActivatePower('multi');
    expect(g.balls).toHaveLength(5);
    expect(g.balls.every((ball) => ball.fire === 0)).toBe(true);
  });

  it('clears Fire even when a brick break freezes ball physics', () => {
    g.qaActivatePower('fire');
    g.activePowers.fire = 2;
    g.launch();
    const ball = g.balls[0];
    aimAtBrick(ball, 2);
    g.bricks.push({ ...g.bricks[0], x: 250 }); // Keep the round alive.
    g.step(FRAME);
    expect(g.bricks).toHaveLength(1);
    expect(g.activePowers.fire).toBe(1);
    const y = ball.y;
    g.step(FRAME);
    expect(ball.y).toBe(y);
    expect(g.activePowers.fire).toBeUndefined();
    expect(ball.fire).toBe(0);
  });

  it.each([[1, 1], [2, 2]])('with %s Fire frames left, deals %s boss damage on the next hit', (frames, damage) => {
    dom.window.document.getElementById('btnBoss').click();
    g.qaActivatePower('fire');
    g.activePowers.fire = frames;
    g.launch();
    const boss = g.boss;
    const hp = boss.hp;
    Object.assign(g.balls[0], { x: boss.x, y: boss.y + boss.h, vx: 0, vy: -2 });
    g.step(FRAME);
    expect(boss.hp).toBe(hp - damage);
  });

  it('refreshes Fire for all balls for one new bounded duration', () => {
    g.qaActivatePower('fire');
    stepFrames(479);
    g.qaActivatePower('multi');
    g.qaActivatePower('fire');
    expect(g.activePowers.fire).toBe(480);
    expect(g.balls.map((ball) => ball.fire)).toEqual([480, 480, 480]);
    // Hold the split balls safely on the paddle for the rest of the timer.
    g.balls.forEach((ball) => { ball.stuck = true; });
    g.step(FRAME);
    expect(g.activePowers.fire).toBe(479);
    expect(g.balls.every((ball) => ball.fire > 0)).toBe(true);
    stepFrames(479);
    expect(g.activePowers.fire).toBeUndefined();
    expect(g.balls.map((ball) => ball.fire)).toEqual([0, 0, 0]);
  });

  it.each(['ball loss', 'drip', 'round change'])('still ends Fire early on %s', (reset) => {
    g.qaActivatePower('fire');
    const lives = g.lives;
    const level = g.level;
    if (reset === 'ball loss') {
      g.launch();
      Object.assign(g.balls[0], { y: g.H + 40, vy: 2 });
    } else if (reset === 'drip') {
      g.sludges.push({ x: g.paddle.x, y: g.paddle.y + 4, vy: 0, r: 8 });
    } else {
      g.qaActivatePower('warp');
    }
    g.step(FRAME);
    if (reset === 'round change') {
      expect(g.clearTally).toBeTruthy();
      g.skipClearTally();
      expect(g.level).toBe(level + 1);
      expect(g.lives).toBe(lives);
    } else {
      expect(g.lives).toBe(lives - 1);
    }
    expect(g.activePowers.fire).toBeUndefined();
    expect(g.balls).toHaveLength(1);
    expect(g.balls[0].fire).toBe(0);
    g.launch();
    expect(g.balls[0].fire).toBe(0);
  });
});

describe('power-up safety bounds (Karen gate)', () => {
  let g;
  beforeEach(() => {
    ({ g } = boot());
    g.startGame();
    g.qaJumpToLevel(5);
  });

  it('caps Mosh Pit at maxBalls no matter how many are caught', () => {
    g.launch();
    for (let i = 0; i < 10; i += 1) {
      g.qaActivatePower('multi');
    }
    expect(g.balls.length).toBe(g.maxBalls);
    expect(g.maxBalls).toBe(6);
  });

  it('keeps every timer bounded when a power is caught over and over', () => {
    const f = 60 * 8;
    const limits = {
      big: f * 2.5,
      slow: f,
      sticky: f,
      laser: f,
      paper: f,
      shield: f * 1.5,
      fire: f,
      plunger: f * 1.2,
      hotdog: f,
      ghost: 60 * 5,
      gold: 60 * 6,
      shrink: f,
      fast: f,
      reverse: 60 * 5
    };
    for (let i = 0; i < 8; i += 1) {
      for (const p of POWERS) {
        g.qaActivatePower(p.t);
      }
    }
    for (const [k, max] of Object.entries(limits)) {
      if (g.activePowers[k] !== undefined) {
        expect(g.activePowers[k], k).toBeLessThanOrEqual(max);
      }
    }
    expect(g.paddle.w).toBeLessThanOrEqual(g.paddle.baseW * 1.8);
  });

  it('keeps drop chance between the 12% floor and 38% ceiling', async () => {
    const { computeDropChance } = await import('../games/turdanoid_logic.js');
    for (let level = 1; level <= 40; level += 1) {
      for (const remaining of [1, 23, 24, 100]) {
        const c = computeDropChance(level, remaining);
        expect(c).toBeGreaterThanOrEqual(0.12);
        expect(c).toBeLessThanOrEqual(0.38);
      }
    }
  });

  it('stops TP rolls and spitwads on steel', () => {
    g.qaJumpToLevel(6);
    const steel = g.bricks.find((b) => b.indestructible);
    const hp = steel.hp;
    g.qaActivatePower('laser');
    g.lasers = [
      {
        x: steel.x + steel.w / 2,
        y: steel.y + steel.h - 4,
        y0: steel.y + 40,
        vy: -1,
        life: 60,
        tp: true
      }
    ];
    g.qaActivatePower('paper');
    g.paddleShots.push({
      x: steel.x + steel.w / 2,
      y: steel.y + steel.h / 2,
      vx: 0,
      vy: 0,
      r: 6,
      life: 60,
      rot: 0
    });
    // A soft brick tucked directly behind (above) the steel must be shielded.
    const behind = { ...steel, y: steel.y - steel.h - 2, hp: 1, maxHp: 1, indestructible: false };
    delete behind.steel;
    g.bricks.push(behind);
    g.step(1000 / 60);
    expect(g.bricks.includes(steel)).toBe(true);
    expect(steel.hp).toBe(hp);
    // Both shots are consumed by the steel, not passed through it.
    expect(g.lasers).toHaveLength(0);
    expect(g.paddleShots).toHaveLength(0);
    expect(g.bricks.includes(behind)).toBe(true);
    expect(behind.hp).toBe(1);
  });

  it('drops all powers, capsules and shots when a ball is lost', () => {
    g.launch();
    g.qaActivatePower('laser');
    g.qaActivatePower('enlarge');
    g.fireAll();
    g.qaSpawnCapsule('fire', 0.4, 0.3);
    g.balls = [
      { x: 50, y: g.H + 40, r: 9, vx: 0, vy: 5, speed: 5, stuck: false, fire: 0, trail: [] }
    ];
    g.step(1000 / 60);
    expect(Object.keys(g.activePowers)).toHaveLength(0);
    expect(g.paddle.w).toBe(g.paddle.baseW);
    expect(g.lasers).toHaveLength(0);
    expect(g.powerups).toHaveLength(0);
  });

  it('drops all powers when a drip costs a life', () => {
    g.qaActivatePower('laser');
    g.qaActivatePower('enlarge');
    const lives = g.lives;
    g.sludges.push({ x: g.paddle.x, y: g.paddle.y + 4, vy: 0, r: 8 });
    g.step(1000 / 60);
    expect(g.lives).toBe(lives - 1);
    expect(Object.keys(g.activePowers)).toHaveLength(0);
    expect(g.paddle.w).toBe(g.paddle.baseW);
  });

  it('clears falling capsules and shots on round change', () => {
    g.qaActivatePower('laser');
    g.fireAll();
    g.qaSpawnCapsule('fire', 0.4, 0.3);
    g.qaJumpToLevel(7);
    expect(g.powerups).toHaveLength(0);
    expect(g.lasers).toHaveLength(0);
    expect(g.paddleShots).toHaveLength(0);
  });
});
