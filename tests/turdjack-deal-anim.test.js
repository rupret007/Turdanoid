import { describe, expect, it } from 'vitest';
import {
  useDealFlight,
  dealFlightDurationMs,
  dealerRevealPauseMs
} from '../games/turdjack-deal-anim.js';

describe('turdjack-deal-anim', () => {
  it('disables flight when reduced motion', () => {
    expect(useDealFlight(true)).toBe(false);
    expect(useDealFlight(false)).toBe(true);
  });

  it('shortens dealer reveal pause under reduced motion', () => {
    expect(dealerRevealPauseMs(true)).toBe(0);
    expect(dealerRevealPauseMs(false)).toBeGreaterThan(0);
  });

  it('caps deal flight duration', () => {
    expect(dealFlightDurationMs(2000, false)).toBeLessThanOrEqual(520);
    expect(dealFlightDurationMs(2000, true)).toBe(0);
  });
});
