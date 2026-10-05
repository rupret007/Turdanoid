import { describe, expect, it } from 'vitest';
import { formatHandTotalBadge, renderTotalBadgeHtml } from '../games/turdjack-totals.js';

describe('turdjack-totals', () => {
  it('hides dealer hole total', () => {
    expect(formatHandTotalBadge(10, false, true).text).toBe('?');
  });

  it('marks soft hands', () => {
    const badge = formatHandTotalBadge(18, true, false);
    expect(badge.mode).toBe('soft');
    const html = renderTotalBadgeHtml(badge);
    expect(html).toContain('mode-soft');
    expect(html).toContain('aria-label');
  });
});
