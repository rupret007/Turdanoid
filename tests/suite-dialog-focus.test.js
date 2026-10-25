// @vitest-environment node
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../games/suite-dialog-focus.js', import.meta.url), 'utf8');
const pages = [];
function boot() {
  const dom = new JSDOM('<body><main><button id="open">Guide</button><section id="sheet" role="dialog"><button id="first">Start</button><button id="last">Close</button></section><button id="fallback">Play</button></main><aside id="already" inert>Other panel</aside></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
  pages.push(dom);
  const w = dom.window;
  w.document.getElementById('already').inert = true;
  w.eval(source);
  const get = id => w.document.getElementById(id);
  const key = (name, shiftKey = false) => w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, shiftKey }));
  return { w, get, key, api: w.SuiteDialogFocus };
}
afterEach(() => pages.splice(0).forEach(page => page.window.close()));

describe('card dialog focus', () => {
  it('focuses the first action and contains forward/backward Tab without enabling the background', () => {
    const { get, key, api } = boot();
    get('open').focus();
    api.open(get('sheet'));
    expect(get('first').ownerDocument.activeElement).toBe(get('first'));
    expect(get('open').inert).toBe(true);
    key('Tab', true);
    expect(get('last').ownerDocument.activeElement).toBe(get('last'));
    key('Tab');
    expect(get('first').ownerDocument.activeElement).toBe(get('first'));
    get('fallback').focus();
    expect(get('first').ownerDocument.activeElement).toBe(get('first'));
  });

  it('uses Escape to close, restores the actual trigger and preserves preexisting inert state', async () => {
    const { get, key, api } = boot();
    get('open').focus();
    api.open(get('sheet'), { onEscape: () => api.close(get('sheet')) });
    key('Escape');
    await Promise.resolve();
    expect(get('open').ownerDocument.activeElement).toBe(get('open'));
    expect(get('open').inert).toBe(false);
    expect(get('already').inert).toBe(true);
  });

  it('skips replaced or disabled return controls after a synchronous game redraw', async () => {
    const { get, api } = boot();
    get('open').focus();
    api.open(get('sheet'), { fallbackFocus: () => get('fallback') });
    api.close(get('sheet'));
    get('open').remove();
    await Promise.resolve();
    expect(get('fallback').ownerDocument.activeElement).toBe(get('fallback'));
  });

  it('isolates asynchronously inserted suite controls, then restores them on close', async () => {
    const { w, get, api } = boot();
    api.open(get('sheet'));
    const control = w.document.createElement('button');
    w.document.body.append(control);
    await Promise.resolve();
    expect(control.inert).toBe(true);
    api.close(get('sheet'));
    expect(control.inert).toBe(false);
  });

  it('returns to the menu summary when a guide action closes its phone menu', async () => {
    const { w, get, api } = boot();
    const menu = w.document.createElement('details');
    menu.open = true;
    menu.innerHTML = '<summary>Table menu</summary><button>Guide</button>';
    w.document.querySelector('main').append(menu);
    menu.querySelector('button').focus();
    api.open(get('sheet'));
    menu.open = false;
    api.close(get('sheet'));
    await Promise.resolve();
    expect(w.document.activeElement).toBe(menu.querySelector('summary'));
  });
});
