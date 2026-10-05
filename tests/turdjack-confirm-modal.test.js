import { describe, expect, it, vi } from 'vitest';
import {
  createJackConfirmAsk,
  handleConfirmKeydown,
  JACK_CONFIRM_IDS,
  nextFocusable
} from '../games/turdjack-confirm-modal.js';

describe('turdjack-confirm-modal', () => {
  it('Escape declines', () => {
    const onDecline = vi.fn();
    const onAccept = vi.fn();
    const handled = handleConfirmKeydown(
      { key: 'Escape', preventDefault: vi.fn() },
      { onAccept, onDecline }
    );
    expect(handled).toBe(true);
    expect(onDecline).toHaveBeenCalled();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('wraps focus between Yes and No', () => {
    const a = { tagName: 'BUTTON', disabled: false };
    const b = { tagName: 'BUTTON', disabled: false };
    expect(nextFocusable([a, b], a, 1)).toBe(b);
    expect(nextFocusable([a, b], b, 1)).toBe(a);
    expect(nextFocusable([a, b], b, -1)).toBe(a);
  });

  it('resolves accept and decline through the DOM controller', async () => {
    const doc = document.implementation.createHTMLDocument('jack');
    doc.body.innerHTML = `
      <div id="${JACK_CONFIRM_IDS.overlay}" style="display:none" aria-hidden="true">
        <h2 id="${JACK_CONFIRM_IDS.title}"></h2>
        <p id="${JACK_CONFIRM_IDS.message}"></p>
        <button type="button" id="${JACK_CONFIRM_IDS.decline}">No</button>
        <button type="button" id="${JACK_CONFIRM_IDS.accept}">Yes</button>
      </div>`;
    const win = { requestAnimationFrame(fn) { fn(); } };
    const ask = createJackConfirmAsk(doc, win);

    const declinePromise = ask({ message: 'Buy insurance for $50?' });
    expect(doc.getElementById(JACK_CONFIRM_IDS.overlay).style.display).toBe('flex');
    doc.getElementById(JACK_CONFIRM_IDS.decline).click();
    await expect(declinePromise).resolves.toBe(false);

    const acceptPromise = ask({ message: 'Reset bankroll?' });
    doc.getElementById(JACK_CONFIRM_IDS.accept).click();
    await expect(acceptPromise).resolves.toBe(true);
  });

  it('Escape on keydown declines via controller', async () => {
    document.body.innerHTML = `
      <div id="${JACK_CONFIRM_IDS.overlay}" style="display:none" aria-hidden="true">
        <h2 id="${JACK_CONFIRM_IDS.title}"></h2>
        <p id="${JACK_CONFIRM_IDS.message}"></p>
        <button type="button" id="${JACK_CONFIRM_IDS.decline}">No</button>
        <button type="button" id="${JACK_CONFIRM_IDS.accept}">Yes</button>
      </div>`;
    const win = { requestAnimationFrame(fn) { fn(); } };
    const ask = createJackConfirmAsk(document, win);
    const promise = ask({ message: 'Even money?' });
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(promise).resolves.toBe(false);
    document.body.innerHTML = '';
  });
});
