import { describe, it, expect } from 'vitest';
import { perfTier, capsForDevice, clampPoolLength } from '../games/turdanoid-perf.js';

describe('Turdanoid perf caps', () => {
  it('classifies low-tier mobile GPUs', () => {
    expect(perfTier(3, 4)).toBe('low');
    expect(perfTier(1, 2)).toBe('low');
  });

  it('returns monotonic caps by tier', () => {
    const low = capsForDevice(3, 2);
    const high = capsForDevice(1, 8);
    expect(low.particles).toBeLessThan(high.particles);
    expect(low.shards).toBeLessThan(high.shards);
    expect(low.tier).toBe('low');
    expect(high.tier).toBe('high');
  });

  it('clamps pool length', () => {
    expect(clampPoolLength(200, 160)).toBe(160);
    expect(clampPoolLength(10, 160)).toBe(10);
  });
});
