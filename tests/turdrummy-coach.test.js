import { describe, it, expect } from 'vitest';
import { COACH_KEY, COACH_STEPS, nextCoachIndex, loadCoachDone, markCoachDone } from '../games/turdrummy-coach.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
}

describe('coach step script', () => {
  it('teaches the four core ideas in order: draw, discard, melds, knock', () => {
    expect(COACH_STEPS.map((step) => step.id)).toEqual(['draw', 'discard', 'melds', 'knock']);
  });

  it('gives every step a highlight target the page knows about', () => {
    const spots = new Set(['stock', 'hand', 'knock']);
    for (const step of COACH_STEPS) {expect(spots.has(step.spot)).toBe(true);}
  });
});

describe('nextCoachIndex', () => {
  it('advances only on the event the current step teaches', () => {
    expect(nextCoachIndex(0, 'discarded')).toBe(0);
    expect(nextCoachIndex(0, 'drawn')).toBe(1);
    expect(nextCoachIndex(1, 'drawn')).toBe(1);
    expect(nextCoachIndex(1, 'discarded')).toBe(2);
  });

  it('moves a manual step on Next, and ignores real actions on it', () => {
    expect(nextCoachIndex(2, 'discarded')).toBe(2);
    expect(nextCoachIndex(2, 'next')).toBe(3);
  });

  it('reports finished as the step count, and stays there', () => {
    expect(nextCoachIndex(COACH_STEPS.length - 1, 'next')).toBe(COACH_STEPS.length);
    expect(nextCoachIndex(COACH_STEPS.length, 'next')).toBe(COACH_STEPS.length);
  });

  it('tolerates a bad index', () => {
    expect(nextCoachIndex(-3, 'drawn')).toBe(0);
    expect(nextCoachIndex(undefined, 'next')).toBe(1);
  });
});

describe('coach persistence', () => {
  it('uses a versioned, namespaced key separate from the guide-seen key', () => {
    expect(COACH_KEY).toBe('turdrummyCoach_v1');
  });

  it('is not done until it is marked, then stays done', () => {
    const storage = memoryStorage();
    expect(loadCoachDone(storage)).toBe(false);
    markCoachDone(storage);
    expect(storage.getItem(COACH_KEY)).toBe('1');
    expect(loadCoachDone(storage)).toBe(true);
  });

  it('treats a storage that throws as not done, without throwing', () => {
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(loadCoachDone(broken)).toBe(false);
    expect(() => markCoachDone(broken)).not.toThrow();
  });
});
