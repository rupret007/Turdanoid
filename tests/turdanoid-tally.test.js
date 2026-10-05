import { describe, it, expect } from 'vitest';
import {
  buildClearTallyLines,
  formatTallyTime,
  lineDurationMs,
  animatedPoints,
  easeOutCubic
} from '../games/turdanoid-tally.js';

describe('Turdanoid level-clear tally', () => {
  it('builds five lines in display order', () => {
    const lines = buildClearTallyLines({
      level: 3,
      bonus: 350,
      stars: 2,
      bricks: 42,
      maxCombo: 8,
      levelMs: 125000,
      lives: 2
    });
    expect(lines).toHaveLength(5);
    expect(lines[0].kind).toBe('points');
    expect(lines[0].value).toBe(350);
    expect(lines[4].kind).toBe('stars');
    expect(lines[4].stars).toBe(2);
  });

  it('formats level time as m:ss', () => {
    expect(formatTallyTime(65000)).toBe('1:05');
    expect(formatTallyTime(9000)).toBe('0:09');
  });

  it('eases point count-up toward the bonus', () => {
    const line = { kind: 'points', value: 250 };
    expect(animatedPoints(line, 0)).toBe(0);
    expect(animatedPoints(line, 1)).toBe(250);
    expect(animatedPoints(line, 0.5)).toBeLessThan(250);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('shortens line duration when reduced motion is on', () => {
    const line = { kind: 'points', value: 100 };
    expect(lineDurationMs(line, true)).toBeLessThan(lineDurationMs(line, false));
  });
});
