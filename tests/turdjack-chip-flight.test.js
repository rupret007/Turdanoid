import { describe, expect, it } from 'vitest';
import { clearFlyingChips, FLYING_CHIP_CLASS } from '../games/turdjack-chip-flight.js';

describe('turdjack-chip-flight', () => {
  it('removes flying chip nodes', () => {
    const root = document.createElement('div');
    const chip = document.createElement('span');
    chip.className = FLYING_CHIP_CLASS;
    root.appendChild(chip);
    expect(clearFlyingChips(root)).toBe(1);
    expect(root.querySelector(`.${FLYING_CHIP_CLASS}`)).toBeNull();
  });
});
