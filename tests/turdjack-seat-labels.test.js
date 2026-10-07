import { describe, expect, it } from 'vitest';
import { seatAriaLabel, seatLabel, SEAT_LABELS } from '../games/turdjack-seat-labels.js';

describe('turdjack-seat-labels', () => {
  it('exposes full and short copy', () => {
    expect(SEAT_LABELS.player.short).toBe('You');
    expect(seatLabel('split', 'short')).toBe('Split');
    expect(seatLabel('dealer', 'full')).toContain('Toilet Boss');
  });

  it('aria label keeps the full seat name', () => {
    expect(seatAriaLabel('player')).toMatch(/Poop Luck/);
  });
});
