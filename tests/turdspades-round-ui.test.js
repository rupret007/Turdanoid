import { describe, it, expect, vi } from 'vitest';
import { showScoringReceipt } from '../games/turdspades-round-ui.js';

describe('turdspades-round-ui', () => {
  it('dismisses receipt overlay under reduced motion', async () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    vi.useFakeTimers();
    const pending = showScoringReceipt(root, { title: 'Round', lines: ['x'], total: 10 }, { reduced: true });
    expect(root.classList.contains('show')).toBe(true);
    await vi.advanceTimersByTimeAsync(150);
    await pending;
    expect(root.classList.contains('show')).toBe(false);
    vi.useRealTimers();
    root.remove();
  });
});
