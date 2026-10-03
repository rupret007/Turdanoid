import { describe, it, expect } from 'vitest';
import {
  TURDANOID_FEEL,
  TURDTRIS_FEEL,
  CARD_TABLE_FEEL,
  scaleLerp,
  lerpToward,
  clampMinBallSpeed,
  decayShake,
  bumpShake,
  ballDangerRatio
} from '../games/suite-feel.js';

describe('suite-feel', () => {
  it('documents TurdAnoid combo window used in TurdAnoid.html step()', () => {
    expect(TURDANOID_FEEL.comboWindowFrames).toBe(105);
  });

  it('scaleLerp is ~1 at large ts and 0 at ts=0', () => {
    expect(scaleLerp(0.4, 0)).toBe(0);
    expect(scaleLerp(0.4, 1)).toBeCloseTo(0.4);
    expect(scaleLerp(0.4, 60)).toBeGreaterThan(0.99);
  });

  it('lerpToward approaches the target', () => {
    expect(lerpToward(10, 20, 0.5)).toBe(15);
  });

  it('clampMinBallSpeed lifts slow horizontal grinds', () => {
    const { vx, vy } = clampMinBallSpeed(0.8, 0.2, 4.25);
    expect(Math.hypot(vx, vy)).toBeCloseTo(4.25);
  });

  it('card table AI pacing constants are positive and ordered', () => {
    expect(CARD_TABLE_FEEL.crapeightsAiMs).toBeLessThan(800);
    expect(CARD_TABLE_FEEL.turdrummyQuickAiMs).toBeLessThan(CARD_TABLE_FEEL.turdrummyAiMs);
    expect(CARD_TABLE_FEEL.turdspadesAiMs).toBeGreaterThan(300);
  });

  it('decayShake and bumpShake behave like TurdAnoid screen shake', () => {
    expect(decayShake(10, 1)).toBeCloseTo(9.4);
    expect(bumpShake(2, 7)).toBe(7);
    expect(bumpShake(9, 4)).toBe(9);
  });

  it('ballDangerRatio peaks for fast balls near the paddle zone', () => {
    const H = 600;
    const low = ballDangerRatio([{ vy: 5, y: 200, r: 10, stuck: false }], H, 550);
    const high = ballDangerRatio([{ vy: 5, y: 520, r: 10, stuck: false }], H, 550);
    expect(low).toBe(0);
    expect(high).toBeGreaterThan(0.5);
  });

  it('documents Turdtris danger HUD pulse threshold', () => {
    expect(TURDTRIS_FEEL.dangerHudPulseRatio).toBeGreaterThan(0.4);
    expect(TURDTRIS_FEEL.dangerHudPulseRatio).toBeLessThan(0.75);
  });
});
