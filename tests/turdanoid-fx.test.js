import { describe, it, expect } from 'vitest';
import {
  shakeOffset,
  flashStrength,
  parallaxSpeedFactor,
  clampBurstCount,
  dangerPulse,
  isReducedMotion,
  allowJuiceEffects,
  confettiCount
} from '../games/turdanoid-fx.js';

describe('Turdanoid FX (reduced motion)', () => {
  const reduced = { matches: true };
  const motion = { matches: false };

  it('detects reduced motion preference', () => {
    expect(isReducedMotion(reduced)).toBe(true);
    expect(isReducedMotion(motion)).toBe(false);
    expect(isReducedMotion(null)).toBe(false);
  });

  it('zeroes screen shake when reduced motion is on', () => {
    expect(shakeOffset(12, reduced, () => 0.9)).toEqual({ sx: 0, sy: 0 });
    const on = shakeOffset(10, motion, () => 0.5);
    expect(on.sx).toBe(0);
    expect(on.sy).toBe(0);
  });

  it('weakens flash overlay for reduced motion', () => {
    expect(flashStrength(1, motion)).toBeCloseTo(0.35);
    expect(flashStrength(1, reduced)).toBeCloseTo(0.35 * 0.35);
  });

  it('slows parallax and caps bursts', () => {
    expect(parallaxSpeedFactor(reduced)).toBeLessThan(parallaxSpeedFactor(motion));
    expect(clampBurstCount(40, reduced)).toBeLessThan(40);
    expect(clampBurstCount(40, motion)).toBe(40);
  });

  it('keeps danger pulse steady when reduced', () => {
    expect(dangerPulse(0, reduced)).toBe(1);
    expect(dangerPulse(0, motion)).not.toBe(1);
  });

  it('gates confetti and juice under reduced motion', () => {
    expect(allowJuiceEffects(reduced)).toBe(false);
    expect(allowJuiceEffects(motion)).toBe(true);
    expect(confettiCount(80, reduced)).toBe(0);
    expect(confettiCount(80, motion)).toBeGreaterThan(0);
  });
});
