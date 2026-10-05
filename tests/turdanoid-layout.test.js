import { describe, it, expect } from 'vitest';
import { computePlayfield, ASPECT, REF_WIDTH, REF_HEIGHT } from '../games/turdanoid-layout.js';

describe('Turdanoid layout', () => {
  it('keeps reference aspect constants', () => {
    expect(REF_WIDTH).toBe(390);
    expect(REF_HEIGHT).toBe(844);
    expect(ASPECT).toBeCloseTo(390 / 844, 5);
  });

  it('uses full stage on phone portrait', () => {
    const r = computePlayfield(390, 844);
    expect(r.wide).toBe(false);
    expect(r.canvasW).toBe(390);
    expect(r.canvasH).toBe(844);
  });

  it('letterboxes wide desktop with height-first portrait shell', () => {
    const r = computePlayfield(1280, 800);
    expect(r.wide).toBe(true);
    expect(r.canvasH).toBeGreaterThanOrEqual(480);
    expect(r.canvasH).toBeLessThanOrEqual(800);
    expect(r.canvasW / r.canvasH).toBeCloseTo(ASPECT, 2);
    expect(r.canvasW).toBeLessThan(1280 * 0.6);
  });

  it('does not treat squat mobile landscape as wide theater', () => {
    const r = computePlayfield(390, 320);
    expect(r.wide).toBe(false);
  });
});
