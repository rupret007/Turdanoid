import { describe, it, expect } from 'vitest';
import {
  DasTracker,
  DAS_DELAY_MS,
  ARR_MS,
  MOBILE_REPEAT_MS,
  MOBILE_REPEAT_INITIAL_DELAY_MS
} from '../games/turdtris-input.js';

describe('Turdtris DAS', () => {
  it('fires one step immediately on press', () => {
    const das = new DasTracker();
    expect(das.pressLeft()).toEqual({ moveLeft: 1, moveRight: 0 });
    expect(das.pressRight()).toEqual({ moveLeft: 0, moveRight: 1 });
  });

  it('repeats after the delay at ARR intervals', () => {
    const das = new DasTracker();
    das.pressLeft();
    let moves = 0;
    let t = 0;
    while (t < DAS_DELAY_MS + ARR_MS * 3) {
      const step = 8;
      const { moveLeft } = das.tick(step);
      moves += moveLeft;
      t += step;
    }
    expect(moves).toBeGreaterThanOrEqual(3);
  });

  it('stops repeating when released', () => {
    const das = new DasTracker();
    das.pressRight();
    das.tick(DAS_DELAY_MS + ARR_MS * 2);
    das.releaseRight();
    const { moveRight } = das.tick(ARR_MS * 4);
    expect(moveRight).toBe(0);
  });

  it('mobile repeat interval is snappier than legacy 90ms', () => {
    expect(MOBILE_REPEAT_MS).toBeLessThan(90);
    expect(MOBILE_REPEAT_INITIAL_DELAY_MS).toBeGreaterThan(MOBILE_REPEAT_MS);
    expect(MOBILE_REPEAT_INITIAL_DELAY_MS).toBeLessThan(DAS_DELAY_MS + 20);
  });
});
