/**
 * Regression tests that load the real TurdAnoid.html (inline script and all)
 * in jsdom and drive the game through the window.__turdanoid test hook.
 *
 * Canvas 2D and requestAnimationFrame are stubbed: the tests call step()
 * manually with a fixed dt so the simulation is fully deterministic.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

const html = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'TurdAnoid.html'),
  'utf8'
);

const FRAME = 1000 / 60;

function makeCtxStub() {
  const gradient = { addColorStop() {} };
  const target = {};
  return new Proxy(target, {
    get(t, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => gradient;
      }
      if (prop in t) {
        return t[prop];
      }
      return () => {};
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    }
  });
}

function bootAt(url) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url,
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = () => makeCtxStub();
      // No rAF loop: tests drive step() manually for determinism.
      window.requestAnimationFrame = () => 0;
      window.cancelAnimationFrame = () => {};
    }
  });
  return dom;
}

function bootGame() {
  const dom = bootAt('http://localhost/TurdAnoid.html');
  const g = dom.window.__turdanoid;
  if (!g) {
    throw new Error('TurdAnoid test hook (window.__turdanoid) missing');
  }
  return { dom, g };
}

function stepFrames(g, frames, dt = FRAME) {
  for (let i = 0; i < frames; i++) {
    g.step(dt);
  }
}

describe('TurdAnoid game regressions', () => {
  let dom;
  let g;

  beforeEach(() => {
    ({ dom, g } = bootGame());
    g.startGame();
  });

  it('boots to the title state and starts a game with a populated wall', () => {
    expect(g.state).toBe('playing');
    expect(g.level).toBe(1);
    expect(g.lives).toBe(3);
    expect(g.bricks.length).toBeGreaterThan(0);
  });

  describe('level clear (regression: bonus/level fired every frame)', () => {
    it('awards the clear bonus and increments the level exactly once', () => {
      const baseScore = g.score;
      g.bricks = [];
      // Simulate many frames during the 600ms transition window
      stepFrames(g, 40);
      expect(g.score).toBe(baseScore + 250); // 200 + 1*50, once
      expect(g.level).toBe(2); // incremented once, not 40 times
      expect(g.state).toBe('playing'); // no accidental instant win
      expect(g.levelTransition).toBe(true);
    });

    it('spawns the next level after the transition delay', async () => {
      g.bricks = [];
      stepFrames(g, 5);
      expect(g.bricks.length).toBe(0);
      await new Promise((resolve) => setTimeout(resolve, 750));
      expect(g.levelTransition).toBe(false);
      expect(g.bricks.length).toBeGreaterThan(0);
      expect(g.level).toBe(2);
    });

    it('does not lose a life for the ball-less transition window', () => {
      const lives = g.lives;
      g.bricks = [];
      g.balls = [];
      stepFrames(g, 10);
      expect(g.lives).toBe(lives);
    });

    it('cancels the queued next level when quitting to menu mid-transition', async () => {
      g.bricks = [];
      stepFrames(g, 2);
      expect(g.levelTransition).toBe(true);
      g.quitToMenu();
      await new Promise((resolve) => setTimeout(resolve, 750));
      expect(g.state).toBe('title');
      expect(g.levelTransition).toBe(false);
      expect(g.bricks.length).toBe(0); // newLevel() must not have run
    });
  });

  describe('shield (regression: only saved a solo ball)', () => {
    it('saves every ball during multiball', () => {
      const H = g.H;
      g.activePowers.shield = 60 * 8;
      g.balls = [
        { x: 50, y: H + 30, r: 9, vx: 0, vy: 5, speed: 5, stuck: false, fire: 0, trail: [] },
        { x: 90, y: H + 30, r: 9, vx: 0, vy: 5, speed: 5, stuck: false, fire: 0, trail: [] }
      ];
      const lives = g.lives;
      g.step(FRAME);
      expect(g.balls.length).toBe(2);
      expect(g.balls.every((b) => b.vy < 0 && b.y < H)).toBe(true);
      expect(g.lives).toBe(lives);
    });

    it('burns shield time per save and eventually expires', () => {
      const H = g.H;
      g.activePowers.shield = 60 * 2; // exactly one save's worth
      g.balls = [
        { x: 50, y: H + 30, r: 9, vx: 0, vy: 5, speed: 5, stuck: false, fire: 0, trail: [] }
      ];
      g.step(FRAME);
      expect(g.balls.length).toBe(1); // saved
      expect(g.activePowers.shield).toBeUndefined(); // fully consumed
    });
  });

  describe('new-wall power continuity', () => {
    it('carries still-active ball powers through a real wall clear', async () => {
      g.activePowers.slow = 120;
      g.activePowers.fast = 120;
      g.activePowers.fire = 120;
      g.activePowers.ghost = 120;

      g.bricks = [];
      g.step(FRAME);
      expect(g.levelTransition).toBe(true);
      expect(g.level).toBe(2);

      await new Promise((resolve) => setTimeout(resolve, 750));

      const [ball] = g.balls;
      const baseSpeed = 5.4 + 2 * 0.16;
      const expectedSpeed = Math.max(3.5, baseSpeed * 0.7) * 1.35;
      expect(g.levelTransition).toBe(false);
      expect(g.level).toBe(2);
      expect(ball.baseSpeed).toBeCloseTo(baseSpeed, 6);
      expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(expectedSpeed, 6);
      expect(ball.speed).toBeCloseTo(expectedSpeed, 6);
      expect(ball.fire).toBe(119);
      expect(ball.ghost).toBe(119);
    });

    it('restores the natural speed as slow and fast expire independently', () => {
      g.activePowers.slow = 1;
      g.activePowers.fast = 2;
      g.newLevel();

      const [ball] = g.balls;
      const baseSpeed = 5.4 + 1 * 0.16;
      expect(ball.speed).toBeCloseTo(Math.max(3.5, baseSpeed * 0.7) * 1.35, 6);

      g.step(FRAME);
      expect(g.activePowers.slow).toBeUndefined();
      expect(g.activePowers.fast).toBe(1);
      expect(ball.speed).toBeCloseTo(baseSpeed * 1.35, 6);
      expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(baseSpeed * 1.35, 6);

      g.step(FRAME);
      expect(g.activePowers.fast).toBeUndefined();
      expect(ball.speed).toBeCloseTo(baseSpeed, 6);
      expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(baseSpeed, 6);
    });

    it('keeps Enlarge paddle width through a real wall clear', async () => {
      const baseW = g.paddle.baseW;
      g.applyPower({ t: 'enlarge' });
      const wide = g.paddle.w;
      expect(wide).toBeGreaterThan(baseW);

      g.bricks = [];
      g.step(FRAME);
      expect(g.levelTransition).toBe(true);
      expect(g.level).toBe(2);

      await new Promise((resolve) => setTimeout(resolve, 750));

      expect(g.levelTransition).toBe(false);
      expect(g.level).toBe(2);
      expect(g.activePowers.big).toBeGreaterThan(0);
      expect(g.paddle.w).toBeCloseTo(wide, 6);
      expect(g.paddle.w).toBeGreaterThan(g.paddle.baseW);
      expect(dom.window.document.getElementById('powers').textContent).toContain('Big');
      expect(g.paddle.x).toBeGreaterThanOrEqual(g.paddle.w / 2);
      expect(g.paddle.x).toBeLessThanOrEqual(g.W - g.paddle.w / 2);
    });

    it('keeps stacked Enlarge and Shrink size across newLevel()', () => {
      const baseW = g.paddle.baseW;
      g.applyPower({ t: 'enlarge' });
      g.applyPower({ t: 'enlarge' });
      const stacked = g.paddle.w;
      expect(stacked).toBeGreaterThan(baseW * 1.18);

      g.newLevel();
      expect(g.paddle.w).toBeCloseTo(stacked, 6);
      expect(g.activePowers.big).toBeGreaterThan(0);

      g.applyPower({ t: 'shrink', bad: true });
      const shrunk = g.paddle.w;
      expect(shrunk).toBeLessThan(stacked);

      g.newLevel();
      expect(g.paddle.w).toBeCloseTo(shrunk, 6);
      expect(g.activePowers.shrink).toBeGreaterThan(0);
      expect(dom.window.document.getElementById('powers').textContent).toContain('Shrunk');
    });

    it('still resets paddle size when no sizing power is active', () => {
      g.paddle.w = g.paddle.baseW * 1.5;
      g.newLevel();
      expect(g.paddle.w).toBe(g.paddle.baseW);
    });

    it('still strips paddle size when a life is lost', () => {
      g.applyPower({ t: 'enlarge' });
      expect(g.paddle.w).toBeGreaterThan(g.paddle.baseW);
      const lives = g.lives;
      g.balls = [];
      g.step(FRAME);
      expect(g.lives).toBe(lives - 1);
      expect(g.activePowers.big).toBeUndefined();
      expect(g.paddle.w).toBe(g.paddle.baseW);
    });

    it('returns paddle to base width when Enlarge expires after the wall change', () => {
      g.applyPower({ t: 'enlarge' });
      g.activePowers.big = 1;
      g.newLevel();
      expect(g.paddle.w).toBeGreaterThan(g.paddle.baseW);
      g.step(FRAME);
      expect(g.activePowers.big).toBeUndefined();
      expect(g.paddle.w).toBe(g.paddle.baseW);
    });

    it('refreshes speed powers without stacking and copies them to multiball', () => {
      const [source] = g.balls;
      const baseSpeed = source.baseSpeed;

      g.applyPower({ t: 'slow' });
      const slowSpeed = source.speed;
      g.applyPower({ t: 'slow' });
      expect(source.speed).toBeCloseTo(slowSpeed, 6);

      g.applyPower({ t: 'speed', bad: true });
      const combinedSpeed = source.speed;
      g.applyPower({ t: 'speed', bad: true });
      expect(source.speed).toBeCloseTo(combinedSpeed, 6);
      expect(combinedSpeed).toBeCloseTo(Math.max(3.5, baseSpeed * 0.7) * 1.35, 6);

      g.applyPower({ t: 'fire' });
      g.applyPower({ t: 'ghost' });
      g.spawnMulti();

      expect(g.balls).toHaveLength(3);
      for (const ball of g.balls) {
        expect(ball.baseSpeed).toBeCloseTo(baseSpeed, 6);
        expect(ball.speed).toBeCloseTo(combinedSpeed, 6);
        expect(Math.hypot(ball.vx, ball.vy)).toBeCloseTo(combinedSpeed, 6);
        expect(ball.fire).toBe(60 * 8);
        expect(ball.ghost).toBe(60 * 5);
      }
    });
  });

  describe('frame-rate independence', () => {
    it('moves the ball the same distance for the same elapsed time', () => {
      const run = (dt, frames) => {
        const { g: game } = bootGame();
        game.startGame();
        game.bricks = [];
        // Cancel level-clear side effects by marking transition done manually:
        // use a fresh ball travelling through open space instead.
        game.balls = [
          { x: 100, y: 200, r: 9, vx: 2, vy: -1, speed: 5, stuck: false, fire: 0, trail: [] }
        ];
        stepFrames(game, frames, dt);
        return { x: game.balls[0].x, y: game.balls[0].y };
      };
      const at60 = run(FRAME, 30); // 30 frames at 60Hz
      const at120 = run(FRAME / 2, 60); // 60 frames at 120Hz, same wall time
      const at144 = run(1000 / 144, 72); // 72 frames at 144Hz, same wall time
      expect(at120.x).toBeCloseTo(at60.x, 6);
      expect(at120.y).toBeCloseTo(at60.y, 6);
      expect(at144.x).toBeCloseTo(at60.x, 6);
      expect(at144.y).toBeCloseTo(at60.y, 6);
    });

    it('expires timed power-ups after the same wall time regardless of frame rate', () => {
      g.activePowers.laser = 60; // one second's worth
      stepFrames(g, 59);
      expect(g.activePowers.laser).toBeGreaterThan(0);
      stepFrames(g, 2);
      expect(g.activePowers.laser).toBeUndefined();

      const { g: g120 } = bootGame();
      g120.startGame();
      g120.activePowers.laser = 60;
      stepFrames(g120, 118, FRAME / 2);
      expect(g120.activePowers.laser).toBeGreaterThan(0);
      stepFrames(g120, 4, FRAME / 2);
      expect(g120.activePowers.laser).toBeUndefined();
    });
  });

  describe('bomb scoring leftover', () => {
    function brick(cx, cy, hp) {
      return {
        x: cx - 18,
        y: cy - 8,
        w: 36,
        h: 16,
        hp,
        c1: '#7af1c4',
        c2: '#2a6644',
        glow: false
      };
    }

    function inBlast(g, cx, cy) {
      return Math.hypot(cx - g.W / 2, cy - g.H / 2) < Math.min(g.W, g.H) * 0.45;
    }

    it('pays the destroy bonus for bricks the blast kills', () => {
      const nearX = g.W / 2;
      const nearY = g.H / 2;
      expect(inBlast(g, nearX, nearY)).toBe(true);
      expect(inBlast(g, 8, 8)).toBe(false);

      g.bricks = [brick(nearX, nearY, 1), brick(8, 8, 1)];
      const base = g.score;
      g.applyPower({ t: 'bomb' });

      expect(g.score).toBe(base + 5 * g.level);
      expect(g.bricks).toHaveLength(1);
      expect(g.bricks[0].hp).toBe(1);
      expect(g.bricks[0].x).toBeCloseTo(-10, 6);
      expect(g.floats.some((item) => item.text === '+5')).toBe(true);
      expect(dom.window.document.getElementById('hudScore').textContent).toBe(
        (base + 5 * g.level).toLocaleString()
      );
    });

    it('does not pay for chips that only take splash damage', () => {
      g.bricks = [brick(g.W / 2, g.H / 2, 3), brick(8, 8, 2)];
      const base = g.score;
      g.applyPower({ t: 'bomb' });

      expect(g.score).toBe(base);
      expect(g.bricks).toHaveLength(2);
      expect(g.bricks.map((b) => b.hp)).toEqual([1, 2]);
    });

    it('doubles destroy points while Gold Rush is live', () => {
      g.activePowers.gold = 60 * 6;
      g.bricks = [brick(g.W / 2, g.H / 2, 2), brick(g.W / 2 + 12, g.H / 2, 1), brick(8, 8, 1)];
      const base = g.score;
      g.applyPower({ t: 'bomb' });

      expect(g.score).toBe(base + 2 * (2 * 5 * g.level));
      expect(g.bricks).toHaveLength(1);
      expect(g.bricks[0].x).toBeCloseTo(-10, 6);
    });

    it('can still drop a pickup from a killed brick', () => {
      const originalRandom = dom.window.Math.random;
      dom.window.Math.random = () => 0;
      g.bricks = [brick(g.W / 2, g.H / 2, 1), brick(8, 8, 1)];
      g.applyPower({ t: 'bomb' });
      dom.window.Math.random = originalRandom;

      expect(g.powerups.length).toBeGreaterThan(0);
      expect(g.powerups[0].x).toBeCloseTo(g.W / 2, 6);
    });

    it('leaves a survivor so the blast does not fake a wall clear', () => {
      g.bricks = [brick(g.W / 2, g.H / 2, 1), brick(8, 8, 1)];
      g.applyPower({ t: 'bomb' });
      g.step(FRAME);
      expect(g.levelTransition).toBe(false);
      expect(g.level).toBe(1);
      expect(g.bricks).toHaveLength(1);
    });
  });

  describe('Mega Flush pays for the bottom row it actually removes', () => {
    function brick(x, y, hp) {
      return {
        x,
        y,
        w: 36,
        h: 16,
        hp,
        c1: '#7af1c4',
        c2: '#2a6644',
        glow: false
      };
    }

    it('pays the flush bonus for bricks on the bottom row', () => {
      g.bricks = [brick(80, 200, 1), brick(80, 40, 1)];
      const base = g.score;
      g.applyPower({ t: 'flush' });

      expect(g.score).toBe(base + 15 * g.level);
      expect(g.bricks).toHaveLength(1);
      expect(g.bricks[0].y).toBe(40);
      expect(g.floats.some((item) => item.text === '+15')).toBe(true);
      expect(dom.window.document.getElementById('hudScore').textContent).toBe(
        (base + 15 * g.level).toLocaleString()
      );
    });

    it('still pays when the flushed brick had leftover HP', () => {
      g.bricks = [brick(80, 200, 4), brick(80, 40, 2)];
      const base = g.score;
      g.applyPower({ t: 'flush' });

      expect(g.score).toBe(base + 15 * g.level);
      expect(g.bricks).toHaveLength(1);
      expect(g.bricks[0].hp).toBe(2);
      expect(g.floats.some((item) => item.text === '+15')).toBe(true);
    });

    it('doubles the flush bonus while Gold Rush is live', () => {
      g.activePowers.gold = 60 * 6;
      g.bricks = [brick(40, 180, 1), brick(120, 180, 3), brick(80, 40, 1)];
      const base = g.score;
      g.applyPower({ t: 'flush' });

      expect(g.score).toBe(base + 2 * (2 * 15 * g.level));
      expect(g.bricks).toHaveLength(1);
      expect(g.bricks[0].y).toBe(40);
      expect(g.floats.some((item) => item.text === '+30')).toBe(true);
    });

    it('can still drop a pickup from a flushed brick', () => {
      const originalRandom = dom.window.Math.random;
      dom.window.Math.random = () => 0;
      g.bricks = [brick(80, 200, 1), brick(80, 40, 1)];
      g.applyPower({ t: 'flush' });
      dom.window.Math.random = originalRandom;

      expect(g.powerups.length).toBeGreaterThan(0);
      expect(g.powerups[0].x).toBeCloseTo(98, 6);
    });

    it('leaves an upper brick so the flush does not fake a wall clear', () => {
      g.bricks = [brick(80, 200, 1), brick(80, 40, 1)];
      g.applyPower({ t: 'flush' });
      g.step(FRAME);
      expect(g.levelTransition).toBe(false);
      expect(g.level).toBe(1);
      expect(g.bricks).toHaveLength(1);
    });
  });

  describe('auto-pause on tab blur', () => {
    it('reuses doPause and clears held paddle and fire inputs', () => {
      g.keys.left = true;
      g.keys.right = true;
      g.pointerActive = true;

      dom.window.dispatchEvent(new dom.window.Event('blur'));

      expect(g.state).toBe('paused');
      expect(g.keys).toEqual({ left: false, right: false });
      expect(g.pointerActive).toBe(false);

      g.doResume();
      expect(g.state).toBe('playing');
      expect(g.keys).toEqual({ left: false, right: false });
      expect(g.pointerActive).toBe(false);
    });

    it('clears held inputs on visibility loss through the same handler', () => {
      g.keys.left = true;
      g.pointerActive = true;
      Object.defineProperty(dom.window.document, 'hidden', { configurable: true, value: true });

      dom.window.document.dispatchEvent(new dom.window.Event('visibilitychange'));

      expect(g.state).toBe('paused');
      expect(g.keys.left).toBe(false);
      expect(g.pointerActive).toBe(false);
    });

    it('does not clear held inputs on a manual pause', () => {
      g.keys.left = true;
      g.pointerActive = true;
      g.doPause();

      expect(g.state).toBe('paused');
      expect(g.keys.left).toBe(true);
      expect(g.pointerActive).toBe(true);
    });
  });
});

describe('TurdAnoid Pages debug surface', () => {
  it('exposes the test hook on localhost', () => {
    const dom = bootAt('http://localhost/TurdAnoid.html');
    expect(dom.window.__turdanoid).toBeTruthy();
    expect(typeof dom.window.__turdanoid.startGame).toBe('function');
  });

  it('exposes the test hook on the local smoke host', () => {
    const dom = bootAt('http://127.0.0.1:8123/TurdAnoid.html');
    expect(dom.window.__turdanoid).toBeTruthy();
  });

  it('hides the test hook on the public GitHub Pages host', () => {
    const dom = bootAt('https://rupret007.github.io/Turdanoid/TurdAnoid.html');
    expect(dom.window.__turdanoid).toBeUndefined();
  });

  it('hides the test hook on file URLs', () => {
    const dom = bootAt('file:///TurdAnoid.html');
    expect(dom.window.__turdanoid).toBeUndefined();
  });
});
