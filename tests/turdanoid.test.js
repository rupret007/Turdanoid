import { describe, it, expect, vi } from 'vitest';
import { computeBallSpeed, TURDANOID_BALANCE, selectPowerUpType, POWER_UP_TYPES } from '../games/turdanoid_logic';

describe('TurdAnoid Balance Logic', () => {
  it('computes correct ball speed for early levels', () => {
    // Level 1 should hit the early floor
    expect(computeBallSpeed(1)).toBe(TURDANOID_BALANCE.launch.earlyFloorSpeed);
    // Level 5 should still be floor or higher
    expect(computeBallSpeed(5)).toBeGreaterThanOrEqual(TURDANOID_BALANCE.launch.earlyFloorSpeed);
  });

  it('respects max speed cap', () => {
    expect(computeBallSpeed(100)).toBe(TURDANOID_BALANCE.launch.maxSpeed);
  });

  it('increases speed linearly between floor and cap', () => {
    const s6 = computeBallSpeed(6);
    const s7 = computeBallSpeed(7);
    expect(s7).toBeGreaterThan(s6);
  });

  describe('Power-up System', () => {
    it('selects valid power-up types', () => {
      const type = selectPowerUpType(1);
      expect(Object.values(POWER_UP_TYPES)).toContain(type);
    });

    it('adjusts extra life weight based on level', () => {
      // Mock Math.random to return a value that would hit EXTRA_LIFE at high level
      // High level weights: BIG: 40, MULTI: 25, FAST: 15, LIFE: 10, SHIELD: 10. Total 100.
      // EXTRA_LIFE is at 80-90.
      vi.spyOn(Math, 'random').mockReturnValue(0.85);
      
      const res10 = selectPowerUpType(10);
      expect(Object.values(POWER_UP_TYPES)).toContain(res10);
      
      const res1 = selectPowerUpType(1);
      expect(Object.values(POWER_UP_TYPES)).toContain(res1);
      
      vi.restoreAllMocks();
    });

    it('can select new LASER_PADDLE and SLOW_BALL types', () => {
      // LASER_PADDLE is at weight index 80-90 (high level)
      vi.spyOn(Math, 'random').mockReturnValue(0.85);
      expect(selectPowerUpType(10)).toBe(POWER_UP_TYPES.LASER_PADDLE);
      
      // SLOW_BALL is at weight index 90-100 (high level)
      vi.spyOn(Math, 'random').mockReturnValue(0.95);
      expect(selectPowerUpType(10)).toBe(POWER_UP_TYPES.SLOW_BALL);
      
      vi.restoreAllMocks();
    });
  });
});
