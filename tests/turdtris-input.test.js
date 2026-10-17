import { describe, it, expect } from 'vitest';
import {
  DasTracker,
  DAS_DELAY_MS,
  ARR_MS,
  MAX_TICK_MS,
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

  it.each(['Left', 'Right'])('keeps %s repeats independent of frame duration', (direction) => {
    const elapsed = DAS_DELAY_MS + ARR_MS * 3;
    const slowFrame = new DasTracker();
    const fastFrames = new DasTracker();
    slowFrame[`press${direction}`]();
    fastFrames[`press${direction}`]();

    let fastMoves = 0;
    for (let ms = 0; ms < elapsed; ms++) {
      fastMoves += fastFrames.tick(1)[`move${direction}`];
    }

    expect(fastMoves).toBe(3);
    let slowMoves = 0;
    for (let ms = 0; ms < elapsed; ms += MAX_TICK_MS) {
      slowMoves += slowFrame.tick(Math.min(MAX_TICK_MS, elapsed - ms))[`move${direction}`];
    }
    expect(slowMoves).toBe(fastMoves);
    // Both paths must retain the same remainder for the next repeat.
    expect(slowFrame.tick(ARR_MS - 1)[`move${direction}`]).toBe(0);
    expect(fastFrames.tick(ARR_MS - 1)[`move${direction}`]).toBe(0);
    expect(slowFrame.tick(1)[`move${direction}`]).toBe(1);
    expect(fastFrames.tick(1)[`move${direction}`]).toBe(1);
  });

  it('mobile repeat interval is snappier than legacy 90ms', () => {
    expect(MOBILE_REPEAT_MS).toBeLessThan(90);
    expect(MOBILE_REPEAT_INITIAL_DELAY_MS).toBeGreaterThan(MOBILE_REPEAT_MS);
    expect(MOBILE_REPEAT_INITIAL_DELAY_MS).toBeLessThan(DAS_DELAY_MS + 20);
  });

  it('treats non-finite tick deltas as zero', () => {
    const das = new DasTracker();
    das.pressRight();
    das.tick(DAS_DELAY_MS + ARR_MS);
    expect(das.tick(Number.NaN)).toEqual({ moveLeft: 0, moveRight: 0 });
    expect(das.tick(Number.POSITIVE_INFINITY)).toEqual({ moveLeft: 0, moveRight: 0 });
    expect(das.tick(Number.NEGATIVE_INFINITY)).toEqual({ moveLeft: 0, moveRight: 0 });
  });

  it(`caps tick deltas at ${MAX_TICK_MS}ms`, () => {
    const das = new DasTracker();
    das.pressLeft();
    while (das.leftDas < DAS_DELAY_MS) {
      das.tick(MAX_TICK_MS);
    }
    expect(das.tick(10_000).moveLeft).toBe(1);
    expect(MAX_TICK_MS).toBe(33);
  });
});
