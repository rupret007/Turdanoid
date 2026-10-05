import { describe, expect, it } from 'vitest';
import { buildFeltInlay } from '../games/turdjack-felt.js';

describe('turdjack-felt', () => {
  it('embeds payout and dealer rule in SVG data url', () => {
    const url = buildFeltInlay('3:2', true);
    expect(url.startsWith('url("data:image/svg+xml,')).toBe(true);
    const decoded = decodeURIComponent(url.slice('url("data:image/svg+xml,'.length, -2));
    expect(decoded).toContain('3:2');
    expect(decoded).toContain('STANDS ON 17');
  });

  it('reflects H17 tables', () => {
    const decoded = decodeURIComponent(
      buildFeltInlay('6:5', false).replace(/^url\("data:image\/svg\+xml,/, '').replace(/"\)$/, '')
    );
    expect(decoded).toContain('6:5');
    expect(decoded).toContain('HITS SOFT 17');
  });
});
