import { describe, it, expect } from 'vitest';
import { comboHitFrequency, brickBreakFrequency } from '../games/turdanoid-audio.js';

describe('Turdanoid audio helpers', () => {
  it('ladders combo hit pitch', () => {
    expect(comboHitFrequency(0)).toBe(440);
    expect(comboHitFrequency(4)).toBe(440 + 4 * 30);
  });

  it('scales break tone with level and combo', () => {
    expect(brickBreakFrequency(1, 0)).toBeLessThan(brickBreakFrequency(10, 8));
  });
});
