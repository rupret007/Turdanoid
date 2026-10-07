import { describe, expect, it } from 'vitest';
import { handMeterState, renderHandMeterHtml } from '../games/turdjack-hand-meter.js';

describe('turdjack-hand-meter', () => {
  it('marks danger zone for 17–21', () => {
    expect(handMeterState(16, false).danger).toBe(false);
    expect(handMeterState(17, false).danger).toBe(true);
    expect(handMeterState(21, true).danger).toBe(true);
    expect(handMeterState(22, false).label).toBe('Bust');
  });

  it('renders 21 pips', () => {
    const html = renderHandMeterHtml(handMeterState(12, false));
    expect(html).toContain('hand-meter');
    expect(html.match(/class="pip/g)?.length).toBe(21);
  });
});
