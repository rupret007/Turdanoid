import { describe, it, expect } from 'vitest';
import {
  shakeOffset,
  flashStrength,
  parallaxSpeedFactor,
  clampBurstCount,
  dangerPulse,
  isReducedMotion,
  allowJuiceEffects,
  confettiCount,
  impactColor,
  confettiPalette,
  flashFill,
  makeSpark,
  paintSpark,
  paintImpactRing
} from '../games/turdanoid-fx.js';
import { TOKENS } from '../games/turdanoid-theme.js';

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

  it('tints hit flashes porcelain and zeroes them when idle', () => {
    const idle = flashFill(0, motion);
    expect(idle.a).toBe(0);
    const hit = flashFill(1, motion);
    expect(hit.a).toBeCloseTo(0.35);
    expect(hit.css).toMatch(/^rgba\(232,244,239,/);
    const calm = flashFill(1, reduced);
    expect(calm.a).toBeLessThan(hit.a);
  });

  it('builds theme impact colors and diamond sparks', () => {
    expect(impactColor('paddle')).toBe(TOKENS.slime);
    expect(impactColor('gold')).toBe(TOKENS.brass);
    expect(confettiPalette()).toEqual([TOKENS.slime, TOKENS.brass, TOKENS.rose, TOKENS.aqua]);
    const spark = makeSpark(10, 12, TOKENS.brass, () => 0.25);
    expect(spark.spark).toBe(true);
    expect(spark.x).toBe(10);
    const ctxCalls = [];
    const ctx = {
      save() { ctxCalls.push('save'); },
      restore() { ctxCalls.push('restore'); },
      beginPath() {},
      moveTo() {},
      lineTo() {},
      closePath() {},
      fill() { ctxCalls.push('fill'); },
      stroke() { ctxCalls.push('stroke'); },
      arc() {},
      translate() {},
      rotate() {},
      fillStyle: '',
      strokeStyle: '',
      globalAlpha: 1,
      lineWidth: 1
    };
    expect(paintSpark(ctx, spark)).toBe(true);
    expect(ctxCalls).toEqual(['save', 'fill', 'fill', 'restore']);
    expect(paintImpactRing(ctx, { x: 1, y: 2, r: 8, life: 10, col: TOKENS.slime })).toBe(true);
    expect(paintImpactRing(ctx, { x: 1, y: 2, r: 8, life: 0 })).toBe(false);
  });
});
