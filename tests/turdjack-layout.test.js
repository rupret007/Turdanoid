import { describe, expect, it } from 'vitest';
import {
  showFeltBetCircle,
  showHandScorePill,
  useCompactSeatTitles
} from '../games/turdjack-layout.js';

describe('turdjack-layout', () => {
  it('hides felt bet circle on phones during a hand', () => {
    expect(showFeltBetCircle(true, 390)).toBe(false);
    expect(showFeltBetCircle(true, 1280)).toBe(true);
    expect(showFeltBetCircle(false, 390)).toBe(true);
  });

  it('hides duplicate score pill on narrow widths', () => {
    expect(showHandScorePill(390)).toBe(false);
    expect(showHandScorePill(1000)).toBe(true);
  });

  it('uses compact seat titles at 680 and below', () => {
    expect(useCompactSeatTitles(320)).toBe(true);
    expect(useCompactSeatTitles(681)).toBe(false);
  });
});
