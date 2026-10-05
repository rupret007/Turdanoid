import { describe, it, expect } from 'vitest';
import {
  POWER_TYPES,
  TIMED_POWER_TYPES,
  INSTANT_POWER_TYPES,
  displayName
} from '../games/turdanoid-qa.js';

describe('Turdanoid QA metadata', () => {
  it('lists every power type with a readable label', () => {
    expect(POWER_TYPES.length).toBe(19);
    for (const t of POWER_TYPES) {
      expect(displayName(t).length).toBeGreaterThan(2);
    }
  });

  it('partitions timed vs instant powers', () => {
    expect(TIMED_POWER_TYPES.length + INSTANT_POWER_TYPES.length).toBe(POWER_TYPES.length);
    expect(INSTANT_POWER_TYPES).toContain('multi');
    expect(INSTANT_POWER_TYPES).toContain('bomb');
    expect(TIMED_POWER_TYPES).toContain('laser');
  });
});
