import { describe, expect, it, vi } from 'vitest';
import {
  createJackConfirmAsk,
  handleConfirmKeydown,
  JACK_CONFIRM_IDS,
  nextFocusable
} from '../games/turdjack-confirm-modal.js';

function mountConfirmModal(doc) {
  const overlay = doc.createElement('div');
  overlay.id = JACK_CONFIRM_IDS.overlay;
  overlay.style.display = 'none';
  overlay.setAttribute('aria-hidden', 'true');

  const title = doc.createElement('h2');
  title.id = JACK_CONFIRM_IDS.title;
  const message = doc.createElement('p');
  message.id = JACK_CONFIRM_IDS.message;
  overlay.append(title, message);

  for (const [id, label] of [
    [JACK_CONFIRM_IDS.decline, 'No'],
    [JACK_CONFIRM_IDS.accept, 'Yes']
  ]) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.id = id;
    button.textContent = label;
    overlay.append(button);
  }

  doc.body.replaceChildren(overlay);
}

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
    mountConfirmModal(doc);
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
    mountConfirmModal(document);
    const win = { requestAnimationFrame(fn) { fn(); } };
    const ask = createJackConfirmAsk(document, win);
    const promise = ask({ message: 'Even money?' });
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(promise).resolves.toBe(false);
    document.body.replaceChildren();
  });

  it('focuses the open dialog immediately and preserves the first Tab through the next frame', async () => {
    mountConfirmModal(document);
    const trigger = document.createElement('button');
    trigger.id = 'trigger';
    trigger.textContent = 'Deal';
    document.body.prepend(trigger);
    const frames = [];
    const win = { requestAnimationFrame(fn) { frames.push(fn); } };
    trigger.focus();
    const ask = createJackConfirmAsk(document, win);
    try {
      const promise = ask({ message: 'Buy insurance?' });
      expect(document.activeElement.id).toBe(JACK_CONFIRM_IDS.decline);
      document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      expect(document.activeElement.id).toBe(JACK_CONFIRM_IDS.accept);
      for (const frame of frames) { frame(); }
      expect(document.activeElement.id).toBe(JACK_CONFIRM_IDS.accept);
      document.getElementById(JACK_CONFIRM_IDS.accept).click();
      await expect(promise).resolves.toBe(true);
      expect(document.activeElement).toBe(trigger);
    } finally {
      document.body.replaceChildren();
    }
  });
});
