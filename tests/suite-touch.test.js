import { describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import {
  ensureTouchManipulationOnRoot,
  installSuiteTouchPolicy,
  shouldPreventDefaultOnRapidTouchEnd
} from '../assets/suite-touch.js';

describe('suite-touch', () => {
  it('does not preventDefault on rapid touchend (legacy guard removed)', () => {
    expect(shouldPreventDefaultOnRapidTouchEnd()).toBe(false);
  });

  it('adds root touch-manipulation class for CSS zoom guard', () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body class="suite-no-zoom"></body></html>');
    const doc = dom.window.document;
    ensureTouchManipulationOnRoot(doc);
    expect(doc.documentElement.classList.contains('suite-touch-manipulation')).toBe(true);
  });

  it('two quick taps on a button both fire click', async () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body class="suite-no-zoom"></body></html>', {
      pretendToBeVisual: true
    });
    const doc = dom.window.document;
    const win = dom.window;
    installSuiteTouchPolicy(doc);

    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Tap';
    doc.body.appendChild(btn);

    let clicks = 0;
    btn.addEventListener('click', () => {
      clicks += 1;
    });

    const touchEnd = () => {
      const ev = new win.TouchEvent('touchend', {
        bubbles: true,
        cancelable: true,
        composed: true
      });
      const prevented = !btn.dispatchEvent(ev);
      expect(prevented).toBe(false);
      expect(ev.defaultPrevented).toBe(false);
      btn.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    };

    touchEnd();
    touchEnd();

    expect(clicks).toBe(2);
  });

  it('installSuiteTouchPolicy is idempotent per document', () => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const doc = dom.window.document;
    const spy = vi.spyOn(doc.documentElement.classList, 'add');
    installSuiteTouchPolicy(doc);
    installSuiteTouchPolicy(doc);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
