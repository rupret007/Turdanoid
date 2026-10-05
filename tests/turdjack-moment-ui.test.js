import { describe, expect, it } from 'vitest';
import { momentDisplayMs } from '../games/turdjack-moment-ui.js';

describe('turdjack-moment-ui', () => {
  it('caps celebration time for reduced motion', () => {
    expect(momentDisplayMs(true)).toBeLessThanOrEqual(500);
    expect(momentDisplayMs(false)).toBe(1200);
  });
});
