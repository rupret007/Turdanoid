import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import {
  CRITTER_TYPES,
  pickCritterType,
  shouldRunAmbientMotion,
  syncAmbientMotionState
} from '../assets/suite-ambient.js';

describe('suite-ambient', () => {
  it('shouldRunAmbientMotion gates on hidden and reduced motion', () => {
    expect(shouldRunAmbientMotion(false, false)).toBe(true);
    expect(shouldRunAmbientMotion(true, false)).toBe(false);
    expect(shouldRunAmbientMotion(false, true)).toBe(false);
  });

  it('pickCritterType returns known critters', () => {
    expect(CRITTER_TYPES).toContain(pickCritterType(0.1));
    expect(CRITTER_TYPES).toContain(pickCritterType(0.9));
  });

  it('syncAmbientMotionState toggles pause class', () => {
    const dom = new JSDOM('<div class="suite-bg"></div>');
    const bg = dom.window.document.querySelector('.suite-bg');
    syncAmbientMotionState(bg, { hidden: true, reduced: false });
    expect(bg.classList.contains('suite-bg-paused')).toBe(true);
    syncAmbientMotionState(bg, { hidden: false, reduced: false });
    expect(bg.classList.contains('suite-bg-paused')).toBe(false);
    syncAmbientMotionState(bg, { hidden: false, reduced: true });
    expect(bg.classList.contains('suite-bg-static')).toBe(true);
  });
});
