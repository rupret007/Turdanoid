import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  CORNER_INDEX_WIDTH,
  CORNER_INDEX_HEIGHT,
  minFanStepPx,
  minFanStepRatio,
  cornerIndexRect
} from '../games/turdrummy-hand-visibility.js';
import { fanLayout } from '../games/turdrummy-meld.js';

const rummyHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'turdrummy.html'),
  'utf8'
);

describe('TurdRummy hand corner index', () => {
  it('uses a 16×26 px top-left index hit box', () => {
    expect(CORNER_INDEX_WIDTH).toBe(16);
    expect(CORNER_INDEX_HEIGHT).toBe(26);
    const r = cornerIndexRect({ left: 10, top: 20 });
    expect(r.right - r.left).toBe(16);
    expect(r.bottom - r.top).toBe(26);
  });

  it('requires fan step at least wide enough for the index strip', () => {
    expect(minFanStepPx(48)).toBe(16);
    expect(minFanStepRatio(48)).toBeCloseTo(16 / 48, 5);
    const layout = fanLayout({
      cardWidth: 48,
      count: 10,
      groupCount: 3,
      availableWidth: 330,
      groupGap: 8,
      largestGroup: 3,
      indexStripPx: CORNER_INDEX_WIDTH
    });
    expect(layout.step).toBeGreaterThanOrEqual(16);
  });

  it('adds card-face inset to the minimum step so the audit box stays on this card', () => {
    expect(minFanStepPx(44, 5)).toBe(21);
    expect(minFanStepRatio(44, 5)).toBeCloseTo(21 / 44, 5);
    const layout = fanLayout({
      cardWidth: 44,
      count: 10,
      groupCount: 3,
      availableWidth: 280,
      groupGap: 8,
      largestGroup: 4,
      indexStripPx: CORNER_INDEX_WIDTH + 5,
      minStepRatio: 21 / 44,
      readableRatio: 0.46
    });
    expect(layout.step).toBeGreaterThanOrEqual(21);
  });
});

describe('TurdRummy 320px hand chrome', () => {
  const phone = rummyHtml.slice(rummyHtml.lastIndexOf('@media (max-width: 360px)'));

  it('does not let the hub-pill reserve steal felt width from the fan', () => {
    expect(phone).toMatch(
      /body:not\(\[data-suite-back="bottom"\]\):has\(\.suite-back-pill\):has\(\.title-group\) \.table \{/
    );
    expect(phone).toMatch(/padding-left:\s*4px/);
  });

  it('keeps a wrapped second row on a 640px phone', () => {
    expect(rummyHtml).toMatch(/#playerHand\.is-wrapped \{ row-gap: 8px/);
    expect(rummyHtml).not.toMatch(/#playerHand\.is-wrapped \{ row-gap: 44px/);
    expect(phone).toMatch(/\.zone--center \.piles \{[\s\S]*?flex-wrap:\s*nowrap/);
  });

  it('does not let the shared selected-card scale cover neighbour indices', () => {
    expect(phone).toMatch(/#playerHand button\.card\.selected[\s\S]*?transform:\s*none/);
  });
});
