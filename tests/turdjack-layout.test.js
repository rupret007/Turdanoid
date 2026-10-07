import { describe, expect, it } from 'vitest';
import {
  showFeltBetCircle,
  showHandScorePill,
  useCompactBetweenHandsHud,
  useCompactSeatTitles,
  useTableFirstPlayLayout,
  playFocusScrollBehavior
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

  it('enables table-first chrome on phones during play', () => {
    expect(useTableFirstPlayLayout(390, 844, true)).toBe(true);
    expect(useTableFirstPlayLayout(900, 900, true)).toBe(false);
    expect(playFocusScrollBehavior(true)).toBe('instant');
  });

  it('collapses the main HUD between hands at 390 and below only', () => {
    expect(useCompactBetweenHandsHud(320, false)).toBe(true);
    expect(useCompactBetweenHandsHud(390, false)).toBe(true);
    expect(useCompactBetweenHandsHud(391, false)).toBe(false);
    expect(useCompactBetweenHandsHud(320, true)).toBe(false);
    expect(useCompactBetweenHandsHud(1280, false)).toBe(false);
  });
});
