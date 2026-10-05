import { describe, it, expect } from 'vitest';
import { COACH_STORAGE_KEY, STEPS, coachSeen, markCoachSeen } from '../games/turdanoid-coach.js';

describe('Turdanoid coach', () => {
  it('tracks three onboarding steps under a versioned key', () => {
    expect(STEPS.length).toBe(3);
    expect(COACH_STORAGE_KEY).toBe('turdanoid_v3_coach_v1');
    const mem = new Map();
    const storage = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, v)
    };
    expect(coachSeen(storage)).toBe(false);
    markCoachSeen(storage);
    expect(coachSeen(storage)).toBe(true);
  });
});
