import { describe, it, expect } from 'vitest';
import {
  TURDANOID_BALANCE,
  computeBallSpeed,
  computePaddleSpeed,
  computeDropChance,
  shouldDropPowerUp,
  selectPowerUpType,
  unlockedPowers,
  computeBrickHitScore,
  computeLevelClearBonus,
  POWERS
} from '../games/turdanoid_logic';

describe('TurdAnoid Balance Logic', () => {
  describe('Ball speed', () => {
    it('matches the shipped curve at level 1', () => {
      expect(computeBallSpeed(1)).toBeCloseTo(5.56);
    });

    it('increases with level', () => {
      expect(computeBallSpeed(7)).toBeGreaterThan(computeBallSpeed(6));
    });

    it('caps the level bonus at +3.0', () => {
      expect(computeBallSpeed(100)).toBeCloseTo(TURDANOID_BALANCE.ball.baseSpeed + 3.0);
      expect(computeBallSpeed(100)).toBe(computeBallSpeed(50));
    });
  });

  describe('Paddle speed', () => {
    it('matches the shipped curve and cap', () => {
      expect(computePaddleSpeed(1)).toBeCloseTo(7.2);
      expect(computePaddleSpeed(100)).toBeCloseTo(11);
    });
  });

  describe('Drop chance', () => {
    it('is 32% on level 1 with a full wall', () => {
      expect(computeDropChance(1, 100)).toBeCloseTo(0.32);
    });

    it('settles toward the 12% floor late game', () => {
      expect(computeDropChance(30, 100)).toBeCloseTo(0.12);
    });

    it('adds the last-stand boost below 24 bricks', () => {
      expect(computeDropChance(1, 10)).toBeCloseTo(0.38);
    });

    it('drives shouldDropPowerUp deterministically via injected rng', () => {
      expect(shouldDropPowerUp(1, 100, () => 0.31)).toBe(true);
      expect(shouldDropPowerUp(1, 100, () => 0.33)).toBe(false);
    });
  });

  describe('Power-up catalogue', () => {
    it('has the 19 shipped power-up types', () => {
      expect(POWERS.length).toBe(19);
      const names = POWERS.map((p) => p.t);
      for (const expected of [
        'enlarge', 'slow', 'catch', 'multi', 'life', 'laser',
        'paper', 'shield', 'fire', 'bomb', 'plunger', 'flush',
        'hotdog', 'ghost', 'skunk', 'gold', 'shrink', 'speed', 'reverse'
      ]) {
        expect(names).toContain(expected);
      }
    });

    it('unlocks progressively by level', () => {
      expect(unlockedPowers(1).map((p) => p.t)).toEqual([
        'enlarge', 'slow', 'catch', 'multi', 'life', 'laser'
      ]);
      expect(unlockedPowers(8).length).toBe(19);
    });

    it('never selects bad pickups before level 6', () => {
      // rng always low enough that the "pick bad" roll would succeed if allowed
      for (let level = 1; level <= 5; level++) {
        for (let i = 0; i < 50; i++) {
          const type = selectPowerUpType(level, Math.random);
          const def = POWERS.find((p) => p.t === type);
          expect(def.bad).toBeFalsy();
        }
      }
    });

    it('selects bad pickups at level 6+ when the bad roll hits', () => {
      // First rng call is the bad-pickup roll, second is the weighted pick
      const rolls = [0.05, 0.0];
      const rng = () => rolls.shift();
      const type = selectPowerUpType(6, rng);
      const def = POWERS.find((p) => p.t === type);
      expect(def.bad).toBe(true);
    });

    it('only selects unlocked types', () => {
      for (let i = 0; i < 100; i++) {
        const type = selectPowerUpType(3, Math.random);
        const def = POWERS.find((p) => p.t === type);
        expect(def.unlock).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('Scoring', () => {
    it('computes brick hit score with combo multiplier', () => {
      // level 2, no combo: 10 + 2*2 = 14
      expect(computeBrickHitScore(2, 1)).toBe(14);
      // 4 combo hits -> 1.5x
      expect(computeBrickHitScore(2, 4)).toBe(21);
      // gold doubles
      expect(computeBrickHitScore(2, 4, true)).toBe(42);
    });

    it('computes level clear bonus', () => {
      expect(computeLevelClearBonus(1)).toBe(250);
      expect(computeLevelClearBonus(30)).toBe(1700);
    });
  });
});
