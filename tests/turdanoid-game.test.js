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

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'TurdAnoid.html'), 'utf8');

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

function bootGame() {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/TurdAnoid.html',
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = () => makeCtxStub();
      // No rAF loop: tests drive step() manually for determinism.
      window.requestAnimationFrame = () => 0;
      window.cancelAnimationFrame = () => {};
    }
  });
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
  let g;

  beforeEach(() => {
    ({ g } = bootGame());
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
      expect(g.level).toBe(2);               // incremented once, not 40 times
      expect(g.state).toBe('playing');       // no accidental instant win
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
      expect(g.balls.length).toBe(1);       // saved
      expect(g.activePowers.shield).toBeUndefined(); // fully consumed
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
      const at60 = run(FRAME, 30);       // 30 frames at 60Hz
      const at120 = run(FRAME / 2, 60);  // 60 frames at 120Hz, same wall time
      expect(at120.x).toBeCloseTo(at60.x, 6);
      expect(at120.y).toBeCloseTo(at60.y, 6);
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
});
