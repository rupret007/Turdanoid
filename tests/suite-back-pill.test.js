import { describe, expect, it } from 'vitest';

import {
  BACK_PILL_RESERVE_GAP,
  BACK_PILL_TAP_SIZE,
  NARROW_BACK_PILL_MAX_WIDTH,
  backPillReserveX,
  boxesIntersect,
  isBackPillOverlapTarget,
  isFullViewportBackdrop,
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

  it('computes horizontal reserve only when pill is top-placed', () => {
    expect(backPillReserveX({}, 1280)).toBe(0);
    expect(backPillReserveX({}, 390)).toBe(8 + 6 + BACK_PILL_TAP_SIZE + BACK_PILL_RESERVE_GAP);
    expect(backPillReserveX({ suiteBack: 'bottom' }, 320)).toBe(0);
  });

  it('classifies overlap targets and full-viewport backdrops', () => {
    expect(isBackPillOverlapTarget('div', '', 'Score')).toBe(true);
    expect(isBackPillOverlapTarget('div', '', '   ')).toBe(false);
    expect(isBackPillOverlapTarget('button', '', '')).toBe(true);
    expect(isBackPillOverlapTarget('div', '', '', true)).toBe(true);
    expect(isFullViewportBackdrop({ left: 0, top: 0, right: 390, bottom: 844 }, 390, 844)).toBe(true);
    expect(isFullViewportBackdrop({ left: 0, top: 0, right: 44, bottom: 44 }, 390, 844)).toBe(false);
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
