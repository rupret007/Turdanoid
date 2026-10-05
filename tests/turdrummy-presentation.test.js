import { describe, it, expect } from 'vitest';
import {
  ROUND_BANNER_VISIBLE_MS,
  PRESENTATION_AUTO_SKIP_MS,
  REVEAL_STAGGER_CAP_MS,
  trophyDelayMs
} from '../games/turdrummy-presentation.js';
import { staggerDelay } from '../games/turdrummy-motion.js';
import { REVEAL_STAGGER_STEP_MS } from '../games/turdrummy-presentation.js';

describe('round-end presentation timing', () => {
  it('keeps banner and auto-skip within the ~3s moment budget', () => {
    expect(ROUND_BANNER_VISIBLE_MS).toBeLessThanOrEqual(3000);
    expect(PRESENTATION_AUTO_SKIP_MS).toBeLessThanOrEqual(3000);
    expect(trophyDelayMs()).toBeLessThanOrEqual(3300);
  });

  it('stagger cap finishes a 10-card reveal before auto-skip', () => {
    const last = staggerDelay(9, REVEAL_STAGGER_STEP_MS, REVEAL_STAGGER_CAP_MS);
    expect(last).toBeLessThanOrEqual(REVEAL_STAGGER_CAP_MS);
    expect(last + 400).toBeLessThanOrEqual(PRESENTATION_AUTO_SKIP_MS);
  });
});
