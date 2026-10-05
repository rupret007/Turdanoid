import { describe, it, expect } from 'vitest';
import {
  CORNER_INDEX_WIDTH,
  CORNER_INDEX_HEIGHT,
  minFanStepPx,
  minFanStepRatio,
  cornerIndexRect
} from '../games/turdrummy-hand-visibility.js';
import { fanLayout } from '../games/turdrummy-meld.js';

describe('TurdRummy hand corner index', () => {
  it('uses a 16×26 px top-left index hit box', () => {
    expect(CORNER_INDEX_WIDTH).toBe(16);
    expect(CORNER_INDEX_HEIGHT).toBe(26);
    const r = cornerIndexRect({ left: 10, top: 20 });
    expect(r.right - r.left).toBe(16);
    expect(r.bottom - r.top).toBe(26);
  });

  it('requires fan step at least wide enough for the index strip', () => {
    expect(minFanStepPx(48)).toBe(16);
    expect(minFanStepRatio(48)).toBeCloseTo(16 / 48, 5);
    const layout = fanLayout({
      cardWidth: 48,
      count: 10,
      groupCount: 3,
      availableWidth: 330,
      groupGap: 8,
      largestGroup: 3,
      indexStripPx: CORNER_INDEX_WIDTH
    });
    expect(layout.step).toBeGreaterThanOrEqual(16);
  });
});
