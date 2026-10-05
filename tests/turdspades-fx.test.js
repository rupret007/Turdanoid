import { describe, it, expect } from 'vitest';
import {
  prefersReducedMotion,
  trickSweepDurationMs,
  spadesBrokenParticleCount
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
});
