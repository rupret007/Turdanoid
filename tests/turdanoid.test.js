import { describe, it, expect } from 'vitest';
import { computeBallSpeed, TURDANOID_BALANCE } from '../games/turdanoid_logic';

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
});
