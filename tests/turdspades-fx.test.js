import { describe, it, expect } from 'vitest';
import {
  prefersReducedMotion,
  trickSweepDurationMs,
  spadesBrokenParticleCount,
  dealAnimationDurationMs,
  cardFlightDurationMs
} from '../games/turdspades-fx.js';

describe('turdspades-fx', () => {
  it('returns zero-duration sweep when reduced motion is requested', () => {
    expect(trickSweepDurationMs(true)).toBe(0);
    expect(trickSweepDurationMs(false)).toBeGreaterThan(0);
  });

  it('caps spades-broken particles when reduced motion', () => {
    expect(spadesBrokenParticleCount(true)).toBe(0);
    expect(spadesBrokenParticleCount(false)).toBe(18);
  });

  it('prefersReducedMotion is boolean', () => {
    expect(typeof prefersReducedMotion()).toBe('boolean');
  });

  it('skips deal animation when reduced motion', () => {
    expect(dealAnimationDurationMs(true)).toBe(0);
    expect(dealAnimationDurationMs(false)).toBeGreaterThan(0);
  });

  it('keeps card flight in the snappy 180–320ms band when motion is on', () => {
    expect(cardFlightDurationMs(true)).toBe(0);
    const ms = cardFlightDurationMs(false);
    expect(ms).toBeGreaterThanOrEqual(180);
    expect(ms).toBeLessThanOrEqual(320);
  });
});
