import { describe, it, expect } from 'vitest';
import {
  prefersReducedMotion,
  effectiveShake,
  decaySceneShake,
  sparkCountForClear,
  buildClearCallouts,
  levelUpFlashDurationFrames
} from '../games/turdtris-fx.js';
import { TURDTRIS_FEEL } from '../games/suite-feel.js';

describe('turdtris-fx', () => {
  const reduced = { matches: true };
  const full = { matches: false };

  it('respects reduced motion for shake and sparks', () => {
    expect(prefersReducedMotion(reduced)).toBe(true);
    expect(effectiveShake(10, reduced)).toBe(0);
    expect(effectiveShake(10, full)).toBe(10);
    expect(sparkCountForClear(26, reduced)).toBe(TURDTRIS_FEEL.maxClearSparksReduced);
    expect(sparkCountForClear(26, full)).toBe(26);
  });

  it('decays scene shake toward zero', () => {
    expect(decaySceneShake(4)).toBeLessThan(4);
    expect(decaySceneShake(0.1)).toBe(0);
  });

  it('builds prioritized clear callouts', () => {
    const calls = buildClearCallouts({ lines: 4, combo: 3, b2b: 2 });
    expect(calls.some((c) => c.text.includes('TURDTRIS'))).toBe(true);
    expect(calls.some((c) => c.text.includes('B2B'))).toBe(true);
    expect(calls.some((c) => c.text.includes('COMBO'))).toBe(true);
  });

  it('exposes level flash frame budget', () => {
    expect(levelUpFlashDurationFrames()).toBe(TURDTRIS_FEEL.levelFlashFrames);
  });

  it('labels the existing full T-spin single without incorrectly calling it a mini', () => {
    expect(buildClearCallouts({ lines: 1, tSpin: true })[0].text).toBe('T-SPIN SINGLE');
    expect(buildClearCallouts({ lines: 2, tSpin: true })[0].text).toBe('T-SPIN DOUBLE');
    expect(buildClearCallouts({ lines: 3, tSpin: true })[0].text).toBe('T-SPIN TRIPLE');
  });
});
