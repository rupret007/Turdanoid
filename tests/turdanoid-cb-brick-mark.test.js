import { describe, expect, it } from 'vitest';

import { paintCbHeavyBrickMark } from '../games/turdanoid-brick.js';

describe('paintCbHeavyBrickMark', () => {
  it('only marks heavy bricks when colorblind mode is on', () => {
    const calls = [];
    const ctx = {
      save() {
        calls.push('save');
      },
      restore() {
        calls.push('restore');
      },
      beginPath() {
        calls.push('beginPath');
      },
      rect() {
        calls.push('rect');
      },
      clip() {
        calls.push('clip');
      },
      stroke() {
        calls.push('stroke');
      },
      moveTo() {},
      lineTo() {},
      strokeStyle: '',
      lineWidth: 1
    };

    paintCbHeavyBrickMark(ctx, { maxHp: 3 }, 0, 0, 40, 18, true);
    expect(calls).toEqual([]);

    paintCbHeavyBrickMark(ctx, { heavy: true }, 0, 0, 40, 18, false);
    expect(calls).toEqual([]);

    paintCbHeavyBrickMark(ctx, { heavy: true }, 2, 3, 40, 18, true);
    expect(calls).toContain('clip');
    expect(calls).toContain('save');
    expect(calls).toContain('restore');
    expect(calls.filter((c) => c === 'stroke').length).toBeGreaterThan(1);
  });

  it('clips hatch strokes to the brick rectangle', () => {
    let clipAfterRect = false;
    let sawRect = false;
    const ctx = {
      save() {},
      restore() {},
      beginPath() {},
      rect() {
        sawRect = true;
      },
      clip() {
        clipAfterRect = sawRect;
      },
      stroke() {},
      moveTo() {},
      lineTo() {},
      strokeStyle: '',
      lineWidth: 1
    };

    paintCbHeavyBrickMark(ctx, { heavy: true }, 5, 6, 30, 14, true);
    expect(clipAfterRect).toBe(true);
  });
});
