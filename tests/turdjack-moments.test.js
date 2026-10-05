import { describe, expect, it } from 'vitest';
import {
  momentKindFromStatus,
  momentBannerCopy,
  bankrollTweenSteps,
  tableEdgeStreakLabel
} from '../games/turdjack-moments.js';

describe('turdjack-moments', () => {
  it('detects blackjack moment', () => {
    expect(momentKindFromStatus('Blackjack! Paid $150')).toBe('blackjack');
    expect(momentBannerCopy('blackjack')).toBe('CRAPJACK!');
  });

  it('tweens bankroll in steps', () => {
    const steps = bankrollTweenSteps(100, 200, 5);
    expect(steps[steps.length - 1]).toBe(200);
  });

  it('shows streak edge labels', () => {
    expect(tableEdgeStreakLabel(3, 0)).toContain('Heater');
    expect(tableEdgeStreakLabel(0, 4)).toContain('Cold');
  });

  it('covers split and double banners', () => {
    expect(momentBannerCopy('split')).toContain('SPLIT');
    expect(momentBannerCopy('double')).toContain('DOUBLE');
  });
});
