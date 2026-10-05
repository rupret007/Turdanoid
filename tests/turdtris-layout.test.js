import { describe, it, expect } from 'vitest';
import { shouldUseBoardFocusLayout, boardCanvasCssWidth } from '../games/turdtris-layout.js';

describe('turdtris-layout', () => {
  it('enables board focus at phone widths', () => {
    expect(shouldUseBoardFocusLayout(390)).toBe(true);
    expect(shouldUseBoardFocusLayout(1280)).toBe(false);
  });

  it('returns a bounded canvas width rule', () => {
    const { width, vwCap } = boardCanvasCssWidth(390, 844);
    expect(width).toContain('min(');
    expect(vwCap).toBeGreaterThanOrEqual(82);
  });
});
