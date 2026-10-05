import { describe, it, expect } from 'vitest';
import {
  phaseForHp,
  sludgeIntervalFrames,
  bossHitScore,
  MAX_HP,
  BOSS_BEST_KEY
} from '../games/turdanoid-boss.js';

describe('Turdanoid boss mode', () => {
  it('uses a separate best-score storage key', () => {
    expect(BOSS_BEST_KEY).toBe('turdanoid_boss_best_v1');
  });

  it('escalates phases and attack rate as HP drops', () => {
    expect(phaseForHp(MAX_HP, MAX_HP)).toBe(1);
    expect(phaseForHp(50, MAX_HP)).toBe(2);
    expect(phaseForHp(10, MAX_HP)).toBe(3);
    expect(sludgeIntervalFrames(3)).toBeLessThan(sludgeIntervalFrames(1));
    expect(bossHitScore(3)).toBeGreaterThan(bossHitScore(1));
  });
});
