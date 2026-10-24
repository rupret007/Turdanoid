import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { validSpadesSnapshot } from './continue-fixtures.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hubHtml = readFileSync(join(root, 'index.html'), 'utf8');
const coreJs = readFileSync(join(root, 'games/table-continue-core.js'), 'utf8');
const suiteJs = readFileSync(join(root, 'assets/turdsuite.js'), 'utf8');

function bootSuite(url = 'http://localhost/turdspades.html') {
  const dom = new JSDOM(hubHtml, {
    url,
    runScripts: 'outside-only'
  });
  dom.window.__SUITE_SKIP_MODULES = true;
  dom.window.eval(coreJs);
  dom.window.eval(suiteJs);
  return dom;
}

function denyLocalStorage(win) {
  Object.defineProperty(win, 'localStorage', {
    configurable: true,
    get() {
      throw new win.DOMException('The operation is insecure.', 'SecurityError');
    }
  });
}

function installStorage(win, store) {
  Object.defineProperty(win, 'localStorage', {
    configurable: true,
    get() {
      return store;
    }
  });
}

function memoryStore(methods = {}) {
  const data = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
    ...methods
  };
}

describe('suite facade storage failures', () => {
  it('returns no-save / unseen when the localStorage getter throws', () => {
    const dom = bootSuite();
    const { Suite } = dom.window;
    denyLocalStorage(dom.window);

    expect(() => Suite.table.load('turdspades.html')).not.toThrow();
    expect(Suite.table.load('turdspades.html')).toBeNull();
    expect(Suite.table.has('turdspades.html')).toBe(false);
    expect(Suite.table.list()).toEqual([]);
    expect(Suite.table.clear('turdspades.html')).toBe(false);
    expect(Suite.table.remember('turdspades.html', validSpadesSnapshot())).toBe(false);
    expect(() => Suite.guide.hasSeen('turdspades.html')).not.toThrow();
    expect(Suite.guide.hasSeen('turdspades.html')).toBe(false);
    expect(Suite.guide.mark('turdspades.html')).toBe(false);
  });

  it('boots the hub without Continue marks when storage property access throws', () => {
    const dom = new JSDOM(hubHtml, {
      url: 'http://localhost/',
      runScripts: 'outside-only'
    });
    denyLocalStorage(dom.window);
    dom.window.__SUITE_SKIP_MODULES = true;
    expect(() => {
      dom.window.eval(coreJs);
      dom.window.eval(suiteJs);
    }).not.toThrow();
    if (dom.window.document.readyState === 'loading') {
      dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    }
    expect(dom.window.Suite).toBeTruthy();
    expect(() => dom.window.Suite.table.list()).not.toThrow();
    expect(dom.window.Suite.table.list()).toEqual([]);
    expect(dom.window.Suite.guide.hasSeen('turdspades.html')).toBe(false);
    expect(dom.window.document.querySelectorAll('.game-card')).toHaveLength(8);
    expect(dom.window.document.querySelectorAll('.game-card.in-progress')).toHaveLength(0);
    expect(dom.window.document.querySelector('.hero-resume')).toBeNull();
  });

  it('does not advertise Continue when setItem throws', () => {
    const dom = bootSuite();
    const { Suite } = dom.window;
    installStorage(
      dom.window,
      memoryStore({
        setItem() {
          throw new dom.window.DOMException('Quota exceeded', 'QuotaExceededError');
        }
      })
    );

    expect(Suite.table.remember('turdspades.html', validSpadesSnapshot())).toBe(false);
    expect(Suite.table.load('turdspades.html')).toBeNull();
    expect(Suite.table.has('turdspades.html')).toBe(false);
    expect(Suite.table.list()).toEqual([]);
    expect(Suite.guide.mark('turdspades.html')).toBe(false);
    expect(Suite.guide.hasSeen('turdspades.html')).toBe(false);
  });

  it('returns empty defaults when getItem throws on an acquired store', () => {
    const dom = bootSuite();
    const { Suite } = dom.window;
    installStorage(
      dom.window,
      memoryStore({
        getItem() {
          throw new dom.window.DOMException('The operation is insecure.', 'SecurityError');
        }
      })
    );

    expect(Suite.table.load('turdspades.html')).toBeNull();
    expect(Suite.table.has('turdspades.html')).toBe(false);
    expect(Suite.table.list()).toEqual([]);
    expect(Suite.table.clear('turdspades.html')).toBe(false);
    expect(Suite.guide.hasSeen('turdspades.html')).toBe(false);
  });

  it('still remembers and restores a valid table when storage works', () => {
    const dom = bootSuite();
    const { Suite } = dom.window;
    expect(Suite.table.remember('turdspades.html', validSpadesSnapshot())).toBe(true);
    expect(Suite.table.load('turdspades.html')?.round).toBe(2);
    expect(Suite.table.has('turdspades.html')).toBe(true);
    expect(Suite.table.list()).toEqual(['turdspades.html']);
    expect(Suite.guide.hasSeen('turdspades.html')).toBe(false);
    expect(Suite.guide.mark('turdspades.html')).toBe(true);
    expect(Suite.guide.hasSeen('turdspades.html')).toBe(true);
    expect(Suite.table.clear('turdspades.html')).toBe(true);
    expect(Suite.table.load('turdspades.html')).toBeNull();
    expect(Suite.table.has('turdspades.html')).toBe(false);
  });
});
