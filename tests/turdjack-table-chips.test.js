import { describe, expect, it } from 'vitest';
import { buildFeltChipStackHtml, feltBetLabel } from '../games/turdjack-table-chips.js';

describe('turdjack-table-chips', () => {
  it('builds felt stack html for bets', () => {
    expect(buildFeltChipStackHtml(35)).toContain('felt-chip');
  });

  it('labels empty bet circle', () => {
    expect(feltBetLabel(0)).toBe('Bet');
    expect(feltBetLabel(50)).toBe('$50');
  });
});
