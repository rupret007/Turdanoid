import { describe, it, expect } from 'vitest';
import { fanTransform, fanStyle, trickEntryPosition } from '../games/turdspades-layout.js';

describe('turdspades-layout', () => {
  it('fans cards around center index', () => {
    const left = fanTransform(0, 5);
    const right = fanTransform(4, 5);
    expect(left.rotate).toBeLessThan(0);
    expect(right.rotate).toBeGreaterThan(0);
  });

  it('exports fan CSS variables', () => {
    expect(fanStyle(2, 5)).toContain('--fan-r');
  });

  it('maps trick seats to table positions', () => {
    expect(trickEntryPosition('North').top).toBe('8%');
    expect(trickEntryPosition('West').left).toBe('14%');
  });
});
