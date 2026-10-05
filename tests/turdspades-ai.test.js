import { describe, it, expect } from 'vitest';
import { explainAiPlay, formatCardLabel, teamContractNeed } from '../games/turdspades-ai.js';

describe('turdspades-ai hints', () => {
  it('formats card labels for hints', () => {
    expect(formatCardLabel({ suit: 'H', rank: 14 })).toBe('A\u2665');
    expect(formatCardLabel({ suit: 'S', rank: 11 })).toBe('J\u2660');
  });

  it('explains Nil cover plays', () => {
    const text = explainAiPlay({
      player: 1,
      card: { suit: 'H', rank: 12 },
      playerBid: 4,
      partnerBid: 0,
      teamNeed: 2,
      nilCover: true,
      leading: false
    });
    expect(text).toContain('covers partner');
    expect(text).toContain('Q');
  });

  it('computes partnership trick need', () => {
    expect(teamContractNeed([4, 3, 3, 2], [1, 0, 1, 0], 0, 2)).toBe(5);
    expect(teamContractNeed([0, 3, 4, 3], [0, 0, 0, 0], 0, 2)).toBe(4);
  });
});
