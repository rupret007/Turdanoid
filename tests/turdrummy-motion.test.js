import { describe, it, expect } from 'vitest';
import {
  shouldAnimate,
  easeOutCubic,
  tweenValue,
  staggerDelay,
  flightDelta,
  flightDuration
} from '../games/turdrummy-motion.js';

describe('shouldAnimate (reduced-motion gate)', () => {
  it('refuses to animate when the user prefers reduced motion, even if the API exists', () => {
    expect(shouldAnimate({ reduced: true, canAnimate: true })).toBe(false);
  });

  it('refuses when the environment cannot animate (no WAAPI / rAF, e.g. jsdom)', () => {
    expect(shouldAnimate({ reduced: false, canAnimate: false })).toBe(false);
  });

  it('allows motion only when both are clear', () => {
    expect(shouldAnimate({ reduced: false, canAnimate: true })).toBe(true);
  });

  it('fails closed when called without an environment', () => {
    expect(shouldAnimate()).toBe(false);
    expect(shouldAnimate(null)).toBe(false);
  });
});

describe('tweenValue', () => {
  it('lands exactly on the target at progress 1 and starts at the origin', () => {
    expect(tweenValue(12, 3, 1)).toBe(3);
    expect(tweenValue(12, 3, 0)).toBe(12);
  });

  it('returns whole numbers while in flight', () => {
    for (let t = 0; t <= 1; t += 0.1) {
      expect(Number.isInteger(tweenValue(0, 25, t))).toBe(true);
    }
  });

  it('eases out: more than half the distance is covered by the midpoint', () => {
    expect(tweenValue(0, 100, 0.5)).toBeGreaterThan(50);
  });

  it('clamps progress outside [0, 1]', () => {
    expect(tweenValue(5, 9, -1)).toBe(5);
    expect(tweenValue(5, 9, 4)).toBe(9);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe('staggerDelay', () => {
  it('spaces items by the step and caps long hands', () => {
    expect(staggerDelay(0, 32, 200)).toBe(0);
    expect(staggerDelay(3, 32, 200)).toBe(96);
    expect(staggerDelay(40, 32, 200)).toBe(200);
  });

  it('ignores negative or garbage indexes', () => {
    expect(staggerDelay(-4, 32)).toBe(0);
    expect(staggerDelay('x', 32)).toBe(0);
  });
});

describe('flightDelta and flightDuration', () => {
  it('moves a box centre-to-centre and scales it toward the target size', () => {
    const from = { left: 0, top: 0, width: 40, height: 60 };
    const to = { left: 100, top: 200, width: 60, height: 90 };
    const delta = flightDelta(from, to);
    expect(delta.dx).toBe(110);
    expect(delta.dy).toBe(215);
    expect(delta.scale).toBe(1.25); // 1.5 requested, capped so a flight never balloons
  });

  it('bounds the scale so a zero-width source cannot blow up', () => {
    expect(flightDelta({ left: 0, top: 0, width: 0, height: 0 }, { left: 0, top: 0, width: 50, height: 70 }).scale).toBe(1);
    expect(flightDelta({ left: 0, top: 0, width: 10, height: 10 }, { left: 0, top: 0, width: 400, height: 40 }).scale).toBe(1.25);
  });

  it('keeps short hops snappy and long flights under half a second', () => {
    expect(flightDuration(0)).toBe(180);
    expect(flightDuration(100000)).toBe(320);
  });

  it('keeps every card flight inside the 180-320 ms snappy band', () => {
    for (const distance of [0, 1, 40, 200, 600, 1400, 5000]) {
      const ms = flightDuration(distance);
      expect(ms).toBeGreaterThanOrEqual(180);
      expect(ms).toBeLessThanOrEqual(320);
    }
    // Monotonic: a longer hop is never faster than a shorter one.
    expect(flightDuration(400)).toBeGreaterThan(flightDuration(100));
  });
});
