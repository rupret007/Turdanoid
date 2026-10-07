import { describe, expect, it } from 'vitest';
import {
  announceLive,
  dealerHitAnnouncement,
  dealerHitDelayMs,
  dealerRevealAnnouncement,
  roundResultAnnouncement
} from '../games/turdjack-a11y.js';

describe('turdjack-a11y', () => {
  it('skips dealer hit delay when reduced motion', () => {
    expect(dealerHitDelayMs(true)).toBe(0);
    expect(dealerHitDelayMs(false)).toBeGreaterThan(0);
  });

  it('formats dealer and round copy', () => {
    expect(dealerRevealAnnouncement(18)).toContain('18');
    expect(dealerHitAnnouncement(20)).toContain('20');
    expect(dealerHitAnnouncement(22)).toMatch(/bust/i);
    expect(roundResultAnnouncement('Main hand wins')).toMatch(/Round result/);
  });

  it('writes to jackLiveRegion', () => {
    const live = { textContent: '' };
    const doc = {
      getElementById(id) {
        return id === 'jackLiveRegion' ? live : null;
      }
    };
    announceLive(doc, 'Dealer stands.');
    expect(live.textContent).toBe('Dealer stands.');
  });
});
