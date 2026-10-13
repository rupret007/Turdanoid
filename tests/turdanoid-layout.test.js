import { describe, it, expect } from 'vitest';
import {
  computePlayfield,
  hudMetrics,
  lifePipsHtml,
  splitHypeLine,
  ASPECT,
  REF_WIDTH,
  REF_HEIGHT
} from '../games/turdanoid-layout.js';

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

  it('reserves HUD space for the phone back pill and keeps tracking readable', () => {
    const phone = hudMetrics(390);
    expect(phone.narrow).toBe(true);
    expect(phone.left).toBeGreaterThanOrEqual(68);
    expect(phone.minTap).toBe(44);
    expect(phone.trackingButton).toBeLessThanOrEqual(0.08);
    expect(hudMetrics(1280).left).toBe(10);
    expect(hudMetrics(1280).narrow).toBe(false);
    expect(hudMetrics(390).hideLabelsBelow).toBe(0);
    expect(hudMetrics(390).maxLifePips).toBe(5);
  });

  it('reserves phone control space once at every compact width', () => {
    for (const width of [360, 390, 430]) {
      const phone = hudMetrics(width);
      expect(phone.narrow).toBe(true);
      expect(phone.right).toBe(108);
      expect(phone.innerRightMargin).toBe(0);
      expect(phone.left + phone.right).toBeLessThan(width * 0.55);
    }
    expect(hudMetrics(1280).right).toBe(10);
    expect(hudMetrics(1280).innerRightMargin).toBe(104);
  });

  it('renders countable porcelain life pips instead of mashed glyphs', () => {
    expect(lifePipsHtml(0)).toBe('—');
    expect(lifePipsHtml(3)).toBe(
      '<i class="life-pip" aria-hidden="true"></i><i class="life-pip" aria-hidden="true"></i><i class="life-pip" aria-hidden="true"></i>'
    );
    expect(lifePipsHtml(1)).toContain('life-pip');
    expect(lifePipsHtml(7)).toContain('×7');
    expect(lifePipsHtml(7).match(/life-pip/g)).toHaveLength(5);
  });

  it('splits world intro lines so the hype plaque can wrap', () => {
    const split = splitHypeLine('Bathroom Tiles · Level 1 · Classic Wall');
    expect(split.kicker).toBe('Bathroom Tiles');
    expect(split.title).toBe('Level 1 · Classic Wall');
    expect(splitHypeLine('Boss Flush — Sewer King').kicker).toBe('');
    expect(splitHypeLine('Boss Flush — Sewer King').title).toBe('Boss Flush — Sewer King');
  });
});
