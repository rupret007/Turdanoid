import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import {
  DIFFICULTY_KEY,
  SUITE_DIFFICULTY_TUNING,
  applyGravityMs,
  applySpeedMultiplier,
  applySpawnMultiplier,
  applyStartingLives,
  loadDifficulty,
  mapCardAiDifficulty,
  normalizeDifficulty,
  saveDifficulty
} from '../games/suite-difficulty.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hubHtml = readFileSync(join(root, 'index.html'), 'utf8');
const coreJs = readFileSync(join(root, 'games/table-continue-core.js'), 'utf8');
const suiteJs = readFileSync(join(root, 'assets/turdsuite.js'), 'utf8');

const LIVE_GAMES = [
  'TurdAnoid.html',
  'turdtris.html',
  'turdjack.html',
  'crapeights.html',
  'turdrummy.html',
  'turdspades.html',
  'turdomania.html'
];

function memoryStore(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    }
  };
}

function denyLocalStorage(win) {
  Object.defineProperty(win, 'localStorage', {
    configurable: true,
    get() {
      throw new win.DOMException('The operation is insecure.', 'SecurityError');
    }
  });
}

function bootSuite(url = 'http://localhost/turdtris.html') {
  const dom = new JSDOM(hubHtml, { url, runScripts: 'outside-only' });
  dom.window.__SUITE_SKIP_MODULES = true;
  dom.window.eval(coreJs);
  dom.window.eval(suiteJs);
  if (dom.window.document.readyState === 'loading') {
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  }
  return dom;
}

describe('suite-difficulty core', () => {
  it('defaults to normal and normalizes junk', () => {
    expect(normalizeDifficulty(undefined)).toBe('normal');
    expect(normalizeDifficulty('HARD')).toBe('hard');
    expect(normalizeDifficulty('chaos')).toBe('normal');
    expect(loadDifficulty(null)).toBe('normal');
  });

  it('persists and reloads the choice', () => {
    const store = memoryStore();
    expect(saveDifficulty(store, 'easy')).toBe(true);
    expect(store.getItem(DIFFICULTY_KEY)).toBe('easy');
    expect(loadDifficulty(store)).toBe('easy');
    saveDifficulty(store, 'hard');
    expect(loadDifficulty(store)).toBe('hard');
  });

  it('falls back to normal when storage throws on read', () => {
    const store = memoryStore({
      getItem() {
        throw new Error('denied');
      }
    });
    expect(loadDifficulty(store)).toBe('normal');
  });

  it('leaves normal tuning identical to shipped balance', () => {
    expect(SUITE_DIFFICULTY_TUNING.normal).toEqual({ speed: 1, lives: 0, spawn: 1 });
    expect(applySpeedMultiplier(5.56, 'normal')).toBe(5.56);
    expect(applySpawnMultiplier(0.32, 'normal')).toBe(0.32);
    expect(applyStartingLives(3, 'normal')).toBe(3);
    expect(applyGravityMs(800, 'normal')).toBe(800);
  });

  it('scales easy and hard away from normal', () => {
    expect(applySpeedMultiplier(10, 'easy')).toBeLessThan(10);
    expect(applySpeedMultiplier(10, 'hard')).toBeGreaterThan(10);
    expect(applyStartingLives(3, 'easy')).toBe(4);
    expect(applyStartingLives(3, 'hard')).toBe(2);
    expect(mapCardAiDifficulty('hard', 'sharp')).toBe('sharp');
    expect(mapCardAiDifficulty('hard', 'hard')).toBe('hard');
  });
});

describe('Suite.difficulty facade', () => {
  it('defaults to normal when storage is denied', () => {
    const dom = bootSuite();
    denyLocalStorage(dom.window);
    expect(dom.window.Suite.difficulty.get()).toBe('normal');
    expect(() => dom.window.Suite.difficulty.set('hard')).not.toThrow();
    expect(dom.window.Suite.difficulty.get()).toBe('hard');
  });

  it('persists across reload', () => {
    const dom = bootSuite();
    dom.window.Suite.difficulty.set('easy');
    const dom2 = bootSuite();
    dom2.window.localStorage.setItem(DIFFICULTY_KEY, 'easy');
    dom2.window.Suite.difficulty.load();
    expect(dom2.window.Suite.difficulty.get()).toBe('easy');
  });
});

describe('live games read suite difficulty', () => {
  for (const page of LIVE_GAMES) {
    it(`${page} wires suite difficulty`, () => {
      const src = readFileSync(join(root, page), 'utf8');
      const readsSuite =
        src.includes('Suite.difficulty') ||
        src.includes('turdsuite_difficulty_v1') ||
        src.includes('suite-difficulty');
      expect(readsSuite, page).toBe(true);
    });
  }

  it('exposes a segmented control stylesheet hook', () => {
    const css = readFileSync(join(root, 'assets/turdsuite.css'), 'utf8');
    expect(css).toMatch(/\.suite-difficulty-btn[\s\S]*min-height: 44px/);
  });
});

describe('TurdSpades difficulty placement', () => {
  it('opts out of the floating shared picker so it cannot cover the Hub button on phones', () => {
    const spadesHtml = readFileSync(join(root, 'turdspades.html'), 'utf8');
    expect(spadesHtml).toMatch(/<body[^>]*data-suite-no-difficulty="1"/);
    // Its own in-table select still syncs with Suite.difficulty.
    const client = readFileSync(join(root, 'games/turdspades-client.js'), 'utf8');
    expect(client).toContain('Suite.difficulty.set(next)');
  });
});
