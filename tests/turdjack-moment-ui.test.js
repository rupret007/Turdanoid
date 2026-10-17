import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  momentDisplayMs,
  showMomentBannerUi,
  wireMomentBannerSkip
} from '../games/turdjack-moment-ui.js';

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('turdjack-moment-ui', () => {
  it('caps celebration time for reduced motion', () => {
    expect(momentDisplayMs(true)).toBeLessThanOrEqual(500);
    expect(momentDisplayMs(false)).toBe(1200);
  });

  it('only exposes the celebration dismiss control while its message is visible', () => {
    vi.useFakeTimers();
    const banner = document.createElement('div');
    const table = document.createElement('div');
    table.appendChild(banner);
    const playShortcut = vi.fn();
    table.addEventListener('keydown', playShortcut);
    banner.setAttribute('aria-hidden', 'true');
    const onSkip = vi.fn();
    wireMomentBannerSkip(banner, onSkip);
    expect(banner.tabIndex).toBe(-1);
    expect(banner.hasAttribute('inert')).toBe(true);

    showMomentBannerUi(banner, () => 'Blackjack!', 'blackjack', false);
    expect(banner.tabIndex).toBe(0);
    expect(banner.hasAttribute('inert')).toBe(false);
    expect(banner.getAttribute('aria-label')).toContain(banner.textContent);
    const dismissKey = new window.KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', bubbles: true, cancelable: true
    });
    banner.dispatchEvent(dismissKey);
    expect(onSkip).toHaveBeenCalledOnce();
    expect(dismissKey.defaultPrevented).toBe(true);
    expect(playShortcut).not.toHaveBeenCalled();
    expect(banner.tabIndex).toBe(-1);
    expect(banner.hasAttribute('inert')).toBe(true);

    showMomentBannerUi(banner, () => 'You win!', 'win', true);
    vi.advanceTimersByTime(momentDisplayMs(true));
    expect(banner.getAttribute('aria-hidden')).toBe('true');
    expect(banner.tabIndex).toBe(-1);
    expect(banner.hasAttribute('inert')).toBe(true);
  });
});
