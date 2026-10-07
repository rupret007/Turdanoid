import { describe, expect, it } from 'vitest';
import {
  coachButtonIdForAction,
  coachWhyLine,
  isOptimalDecision
} from '../games/turdjack-coach.js';

describe('turdjack-coach', () => {
  it('maps actions to existing button ids', () => {
    expect(coachButtonIdForAction('hit')).toBe('hitBtn');
    expect(coachButtonIdForAction('stand')).toBe('standBtn');
    expect(coachButtonIdForAction('unknown')).toBeNull();
  });

  it('detects optimal decisions', () => {
    expect(isOptimalDecision('hit', 'hit')).toBe(true);
    expect(isOptimalDecision('stand', 'hit')).toBe(false);
  });

  it('formats coach why line', () => {
    expect(coachWhyLine({ action: 'double', reason: 'Press value.' })).toContain('Double');
  });
});
