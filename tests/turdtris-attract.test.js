import { describe, it, expect } from 'vitest';
import { createAttractField } from '../games/turdtris-attract.js';

describe('turdtris-attract', () => {
  it('keeps a bounded piece count and advances positions', () => {
    const field = createAttractField(400, 300, false);
    const before = field.pieces()[0].y;
    field.step(32);
    expect(field.pieces().length).toBeLessThanOrEqual(14);
    expect(field.pieces()[0].y).toBeGreaterThan(before);
  });

  it('uses fewer pieces when reduced motion is on', () => {
    const field = createAttractField(320, 240, true);
    expect(field.pieces().length).toBeLessThanOrEqual(6);
    field.step(1000);
    expect(field.pieces().length).toBeLessThanOrEqual(6);
  });
});
