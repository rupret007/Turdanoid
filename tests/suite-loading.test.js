// @vitest-environment node
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../assets/suite-loading.js', import.meta.url), 'utf8');
const pages = [];
function boot() {
  const dom = new JSDOM('<!doctype html><html><head></head><body><button id="play">Play</button></body></html>', {
    url: 'https://arcade.example/band/play/turdtris', runScripts: 'outside-only'
  });
  pages.push(dom);
  const w = dom.window;
  const timers = new Map();
  let next = 0;
  w.setTimeout = vi.fn(callback => { timers.set(++next, callback); return next; });
  w.clearTimeout = vi.fn(id => timers.delete(id));
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.eval(source);
  return { w, expire() { [...timers.values()].forEach(callback => callback()); } };
}
afterEach(() => pages.splice(0).forEach(dom => dom.window.close()));

describe('game download recovery', () => {
  it('offers manual recovery after a stalled boot without deleting records', () => {
    const { w, expire } = boot();
    w.localStorage.setItem('turdsuite_continue_v1', 'existing saved table');
    expire();
    const dialog = w.document.querySelector('dialog');
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain("couldn't finish loading");
    expect(dialog.querySelector('button').textContent).toBe('Try again');
    expect(dialog.querySelector('a').href).toBe('https://arcade.example/band/play/');
    expect(w.document.activeElement).toBe(dialog.querySelector('button'));
    expect(w.localStorage.getItem('turdsuite_continue_v1')).toBe('existing saved table');
    expect(w.SuiteLoading.state).toBe('failed');
  });

  it('retires a timed-out dialog when a slow game actually becomes ready', () => {
    const { w, expire } = boot();
    const play = w.document.getElementById('play');
    play.focus();
    expire();
    w.SuiteLoading.ready();
    expect(w.document.querySelector('dialog')).toBeNull();
    expect(w.document.activeElement).toBe(play);
    expire();
    expect(w.document.querySelector('dialog')).toBeNull();
  });

  it('keeps normal play clear of loading UI and ignores later cosmetic failures', () => {
    const { w, expire } = boot();
    w.SuiteLoading.ready();
    const required = w.document.createElement('script');
    required.dataset.gameRequired = '';
    w.document.head.append(required);
    required.dispatchEvent(new w.Event('error'));
    w.dispatchEvent(new w.ErrorEvent('error', { message: 'optional cosmetic' }));
    expire();
    expect(w.SuiteLoading.state).toBe('ready');
    expect(w.document.querySelector('dialog')).toBeNull();
  });

  it.each(['script', 'link'])('immediately explains a failed required %s, but tolerates an optional asset', kind => {
    const { w } = boot();
    const script = w.document.createElement(kind);
    w.document.head.append(script);
    script.dispatchEvent(new w.Event('error'));
    expect(w.SuiteLoading.state).toBe('pending');
    script.dataset.gameRequired = '';
    script.dispatchEvent(new w.Event('error'));
    expect(w.SuiteLoading.state).toBe('failed');
    expect(w.document.querySelector('dialog').open).toBe(true);
  });

  it('stops the deadline while away and re-arms an unfinished history return', () => {
    const { w, expire } = boot();
    w.dispatchEvent(new w.PageTransitionEvent('pagehide'));
    expire();
    expect(w.document.querySelector('dialog')).toBeNull();
    w.dispatchEvent(new w.PageTransitionEvent('pageshow', { persisted: true }));
    expire();
    expect(w.document.querySelector('dialog').open).toBe(true);
  });
});
