import { describe, expect, it } from 'vitest';

import {
  NARROW_BACK_PILL_MAX_WIDTH,
  boxesIntersect,
  pillOverlapsControls,
  resolveBackPillPlacement
} from '../assets/suite-back-pill.js';

describe('suite-back-pill', () => {
  it('places pill top on narrow viewports by default', () => {
    expect(resolveBackPillPlacement({}, 390)).toBe('top');
    expect(resolveBackPillPlacement({}, 320)).toBe('top');
    expect(resolveBackPillPlacement({}, NARROW_BACK_PILL_MAX_WIDTH)).toBe('top');
    expect(resolveBackPillPlacement({}, NARROW_BACK_PILL_MAX_WIDTH + 1)).toBe('bottom');
  });

  it('honours body data-suite-back overrides', () => {
    expect(resolveBackPillPlacement({ suiteBack: 'bottom' }, 320)).toBe('bottom');
    expect(resolveBackPillPlacement({ suiteBack: 'top' }, 1280)).toBe('top');
  });

  it('detects bounding-box overlap', () => {
    const pill = { left: 0, top: 0, right: 44, bottom: 44 };
    const clear = { left: 60, top: 0, right: 120, bottom: 44 };
    const dock = { left: 10, top: 700, right: 380, bottom: 844 };
    expect(boxesIntersect(pill, clear)).toBe(false);
    expect(boxesIntersect(pill, { left: 40, top: 40, right: 80, bottom: 80 })).toBe(true);
    expect(pillOverlapsControls(pill, [clear, dock])).toBe(false);
    expect(pillOverlapsControls(pill, [dock])).toBe(false);
  });
});
