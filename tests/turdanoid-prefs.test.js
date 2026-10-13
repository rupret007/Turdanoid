/**
 * Live-page prefs: settings and high score persist through the versioned
 * localStorage blob, with a one-way migration from the older single keys.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import { PREFS_KEY, LEGACY_KEYS, DEFAULT_PREFS } from '../games/turdanoid-storage.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(rootDir, 'TurdAnoid.html'), 'utf8');
const levelsCore = readFileSync(join(rootDir, 'games/turdanoid-levels-core.js'), 'utf8');
const storageCore = readFileSync(join(rootDir, 'games/turdanoid-storage-core.js'), 'utf8');

function makeCtxStub() {
  const gradient = { addColorStop() {} };
  const target = {};
  return new Proxy(target, {
    get(t, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => gradient;
      }
      if (prop in t) {
        return t[prop];
      }
      return () => {};
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    }
  });
}

function bootPage(seed = {}) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/TurdAnoid.html',
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = () => makeCtxStub();
      window.requestAnimationFrame = () => 0;
      window.cancelAnimationFrame = () => {};
      window.eval(levelsCore);
      window.eval(storageCore);
      Object.entries(seed).forEach(([key, value]) => window.localStorage.setItem(key, value));
    }
  });
  const g = dom.window.__turdanoid;
  if (!g) {
    throw new Error('TurdAnoid test hook (window.__turdanoid) missing');
  }
  return { dom, g, ls: dom.window.localStorage };
}

function readPrefs(ls) {
  const raw = ls.getItem(PREFS_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe('TurdAnoid page prefs persistence', () => {
  it('keeps the versioned key and the documented legacy aliases in the page', () => {
    expect(html).toContain(PREFS_KEY);
    expect(html).toContain(LEGACY_KEYS.best);
    expect(html).toContain(LEGACY_KEYS.sound);
    expect(html).toContain('turdanoid_v3_ambient');
    expect(html).toContain('turdanoid_v3_haptic');
  });

  it('loads defaults without writing a prefs blob', () => {
    const { g, ls } = bootPage();
    expect(g.best).toBe(0);
    expect(g.soundOn).toBe(true);
    expect(g.soundBlocked()).toBe(false);
    expect(ls.getItem(PREFS_KEY)).toBeNull();
    expect(ls.getItem(LEGACY_KEYS.best)).toBeNull();
    expect(g.loadGamePrefs()).toEqual(DEFAULT_PREFS);
  });

  it('migrates a legacy best and mute setting on boot', () => {
    const { g, ls } = bootPage({
      turdanoid_v2_best: '4200',
      turdanoid_v2_sound: '0'
    });
    expect(g.best).toBe(4200);
    expect(g.soundOn).toBe(false);
    expect(g.soundBlocked()).toBe(true);
    expect(readPrefs(ls)).toEqual({
      v: 1,
      best: 4200,
      soundOn: false,
      ambientOn: false,
      hapticOn: true,
      bossBest: 0
    });
    expect(ls.getItem(LEGACY_KEYS.best)).toBe('4200');
    expect(ls.getItem(LEGACY_KEYS.sound)).toBe('0');
  });

  it('writes the versioned blob and remirrors the classic best on game over', () => {
    const { g, ls, dom } = bootPage();
    g.startGame();
    g.score = 6400;
    g.gameOver(false);
    expect(g.best).toBe(6400);
    expect(dom.window.document.getElementById('endBest').textContent).toBe('6,400');
    expect(readPrefs(ls)).toMatchObject({ v: 1, best: 6400, soundOn: true });
    expect(ls.getItem(LEGACY_KEYS.best)).toBe('6400');
    g.startGame();
    g.score = 200;
    g.gameOver(false);
    expect(g.best).toBe(6400);
    expect(readPrefs(ls).best).toBe(6400);
  });

  it('persists mute through the versioned blob without dropping suite mute', () => {
    const { g, ls, dom } = bootPage({ turdsuite_muted: '0' });
    const sound = dom.window.document.getElementById('btnSound');
    sound.click();
    expect(g.soundOn).toBe(false);
    expect(readPrefs(ls).soundOn).toBe(false);
    expect(ls.getItem(LEGACY_KEYS.sound)).toBe('0');
    expect(ls.getItem('turdsuite_muted')).toBe('0');
    sound.click();
    expect(g.soundOn).toBe(true);
    expect(readPrefs(ls).soundOn).toBe(true);
    expect(ls.getItem(LEGACY_KEYS.sound)).toBe('1');
  });

  it('prefers the versioned blob over a stale legacy best', () => {
    const { g, ls } = bootPage({
      [PREFS_KEY]: JSON.stringify({
        v: 1,
        best: 8800,
        soundOn: false,
        ambientOn: true,
        hapticOn: false,
        bossBest: 300
      }),
      turdanoid_v2_best: '12',
      turdanoid_v2_sound: '1'
    });
    expect(g.best).toBe(8800);
    expect(g.soundOn).toBe(false);
    expect(g.loadGamePrefs()).toMatchObject({
      best: 8800,
      soundOn: false,
      ambientOn: true,
      hapticOn: false,
      bossBest: 300
    });
    expect(ls.getItem(LEGACY_KEYS.best)).toBe('12');
  });

  it('recovers a malformed blob from the legacy high score', () => {
    const { g, ls } = bootPage({
      [PREFS_KEY]: '<script>alert(1)</script>',
      turdanoid_v2_best: '1500',
      turdanoid_v2_sound: '1'
    });
    expect(g.best).toBe(1500);
    expect(g.soundOn).toBe(true);
    expect(readPrefs(ls).best).toBe(1500);
  });

  it('ignores a poisoned legacy best and keeps a finite score', () => {
    const { g } = bootPage({
      turdanoid_v2_best: '<script>1e999</script>',
      turdanoid_v2_sound: 'not-a-flag'
    });
    expect(g.best).toBe(0);
    expect(g.soundOn).toBe(true);
  });
});
