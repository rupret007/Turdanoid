import { describe, it, expect } from 'vitest';
import {
  TURDANOID_BALANCE,
  computeBrickHitScore,
  computeBrickBreakScore,
  computeFlushBreakScore,
  computeLevelClearBonus
} from '../games/turdanoid_logic.js';

/**
 * Pins Classic scoring to the b3821b4 / turdanoid_logic contract so campaign
 * best scores (turdanoid_v2_best) stay comparable across releases.
 */
describe('Turdanoid Classic scoring compat (b3821b4)', () => {
  const BEST_KEY = 'turdanoid_v2_best';

  it('keeps the documented balance constants', () => {
    expect(BEST_KEY).toBe('turdanoid_v2_best');
    expect(TURDANOID_BALANCE.scoring.brickHitBase).toBe(10);
    expect(TURDANOID_BALANCE.scoring.brickHitPerLevel).toBe(2);
    expect(TURDANOID_BALANCE.scoring.brickBreakPerLevel).toBe(5);
    expect(TURDANOID_BALANCE.scoring.flushBreakPerLevel).toBe(15);
    expect(TURDANOID_BALANCE.scoring.comboHitsPerMultStep).toBe(4);
    expect(TURDANOID_BALANCE.scoring.comboMultStep).toBe(0.5);
    expect(TURDANOID_BALANCE.levels.clearBonusBase).toBe(200);
    expect(TURDANOID_BALANCE.levels.clearBonusPerLevel).toBe(50);
  });

  it('matches brick hit formula: (10 + level×2) × combo × gold', () => {
    expect(computeBrickHitScore(1, 0)).toBe(12);
    expect(computeBrickHitScore(5, 0)).toBe(20);
    expect(computeBrickHitScore(2, 4)).toBe(21);
    expect(computeBrickHitScore(2, 8)).toBe(28);
    expect(computeBrickHitScore(10, 4, true)).toBe(90);
  });

  it('matches wall-break destroy bonus (5×level, gold via helper)', () => {
    expect(computeBrickBreakScore(1)).toBe(5);
    expect(computeBrickBreakScore(7)).toBe(35);
    expect(computeBrickBreakScore(7, true)).toBe(70);
  });

  it('matches Mega Flush destroy line (15×level, 3× destroy)', () => {
    expect(computeFlushBreakScore(1)).toBe(15);
    expect(computeFlushBreakScore(4)).toBe(60);
    expect(computeFlushBreakScore(4, true)).toBe(120);
    expect(computeFlushBreakScore(4, true)).toBe(computeBrickBreakScore(4, true) * 3);
  });

  it('matches level-clear bonus 200 + level×50', () => {
    expect(computeLevelClearBonus(1)).toBe(250);
    expect(computeLevelClearBonus(15)).toBe(950);
    expect(computeLevelClearBonus(30)).toBe(1700);
  });

  it('documents b3821b4 on-wall break path (no gold on direct pop)', () => {
    const wallPopAtLevel4 = 5 * 4;
    expect(wallPopAtLevel4).toBe(computeBrickBreakScore(4));
    const bombPopAtLevel4Gold = computeBrickBreakScore(4, true);
    expect(bombPopAtLevel4Gold).toBe(40);
  });
});
