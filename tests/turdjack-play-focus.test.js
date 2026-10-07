import { describe, expect, it } from 'vitest';
import {
  playFocusScrollBehavior,
  useTableFirstPlayLayout
} from '../games/turdjack-layout.js';
import { rectInsideViewport } from '../games/turdjack-play-focus.js';

describe('turdjack table-first play layout', () => {
  it('only applies during an active round on narrow or short viewports', () => {
    expect(useTableFirstPlayLayout(320, 640, false)).toBe(false);
    expect(useTableFirstPlayLayout(320, 640, true)).toBe(true);
    expect(useTableFirstPlayLayout(360, 740, true)).toBe(true);
    expect(useTableFirstPlayLayout(390, 844, true)).toBe(true);
    expect(useTableFirstPlayLayout(1280, 900, true)).toBe(false);
  });

  it('uses instant scroll when reduced motion is preferred', () => {
    expect(playFocusScrollBehavior(true)).toBe('instant');
    expect(playFocusScrollBehavior(false)).toBe('auto');
  });

  it('checks viewport containment with slack', () => {
    expect(rectInsideViewport({ top: 0, left: 0, bottom: 100, right: 50 }, 320, 640)).toBe(true);
    expect(rectInsideViewport({ top: -5, left: 0, bottom: 100, right: 50 }, 320, 640, 6)).toBe(true);
    expect(rectInsideViewport({ top: -10, left: 0, bottom: 100, right: 50 }, 320, 640, 2)).toBe(false);
    expect(rectInsideViewport({ top: 0, left: 0, bottom: 700, right: 50 }, 320, 640)).toBe(false);
  });
});
