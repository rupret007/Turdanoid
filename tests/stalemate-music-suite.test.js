import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

import {
  MUSIC_PREF_KEY,
  createSuiteMusic,
  readMusicEnabled,
  writeMusicEnabled
} from '../assets/suite-music.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const suiteJs = readFileSync(join(root, 'assets/turdsuite.js'), 'utf8');
const hubHtml = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'assets/turdsuite.css'), 'utf8');

const HUB_GAMES = [
  'TurdAnoid.html',
  'turdtris.html',
  'turdjack.html',
  'crapeights.html',
  'turdrummy.html',
  'turdspades.html',
  'turdomania.html'
];

const ALL_PLAY_PAGES = [...HUB_GAMES, 'neon-arkanoid.html'];

class MockAudio {
  constructor() {
    this.loop = false;
    this.paused = true;
    this.src = '';
    this._listeners = {};
  }

  setAttribute() {}

  addEventListener(type, fn) {
    this._listeners[type] = this._listeners[type] || [];
    this._listeners[type].push(fn);
  }

  play() {
    this.paused = false;
    this._listeners.play?.forEach((fn) => fn());
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this._listeners.pause?.forEach((fn) => fn());
  }
}

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    data
  };
}

function bootSuiteDom(url, storageSeed = {}) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url,
    runScripts: 'outside-only',
    storageQuota: 10_000_000
  });
  for (const [k, v] of Object.entries(storageSeed)) {
    dom.window.localStorage.setItem(k, v);
  }
  dom.window.__SUITE_SKIP_MODULES = true;
  dom.window.eval(suiteJs);
  if (dom.window.document.readyState === 'loading') {
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  }
  return dom;
}

describe('stalemate.music preference', () => {
  it('defaults to on and migrates turdtrisMusic_v1 off into stalemate.music', () => {
    const storage = memoryStorage({ turdtrisMusic_v1: '0' });
    expect(readMusicEnabled(storage)).toBe(false);
    expect(storage.data[MUSIC_PREF_KEY]).toBe('off');
  });

  it('persists off across reload reads', () => {
    const storage = memoryStorage();
    writeMusicEnabled(storage, false);
    expect(storage.data[MUSIC_PREF_KEY]).toBe('off');
    expect(readMusicEnabled(storage)).toBe(false);
    expect(readMusicEnabled(memoryStorage({ [MUSIC_PREF_KEY]: 'off' }))).toBe(false);
  });

  it('playTrackAt leaves audio unpaused when music is on', () => {
    const audio = new MockAudio();
    const player = createSuiteMusic({
      isSuiteMuted: () => false,
      resolveSrc: (path) => `https://example.test/assets/${path}`,
      AudioCtor: function () {
        return audio;
      }
    });
    player.playTrackAt(0);
    expect(player.isPlaying()).toBe(true);
    expect(audio.src).toContain('manic.m4a');
  });
});

describe('site-wide music UI', () => {
  let dom;

  afterEach(() => {
    dom?.window?.close();
  });

  it('injects a 44px music toggle on hub and game pages', () => {
    dom = bootSuiteDom('http://localhost/turdjack.html');
    const btn = dom.window.document.getElementById('suite-music-toggle');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(css).toMatch(/\.suite-music-toggle \{[\s\S]*?min-height: 44px/);
  });

  it('toggle persists stalemate.music off and keeps music paused after reload', () => {
    dom = bootSuiteDom('http://localhost/');
    dom.window.Suite.setMusicEnabled(false);
    expect(dom.window.localStorage.getItem(MUSIC_PREF_KEY)).toBe('off');
    dom.window.close();

    dom = bootSuiteDom('http://localhost/', { [MUSIC_PREF_KEY]: 'off' });
    expect(dom.window.Suite.isMusicEnabled()).toBe(false);
    const btn = dom.window.document.getElementById('suite-music-toggle');
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });

  it('hub Listen to Manic stays on-site and does not link to YouTube', () => {
    expect(hubHtml).not.toMatch(/youtube\.com/i);
    expect(hubHtml).not.toMatch(/youtu\.be/i);
    expect(suiteJs).toContain('suite-listen-manic');
    expect(suiteJs).toContain('playManic');
    dom = bootSuiteDom('http://localhost/');
    const manic = dom.window.document.getElementById('suite-listen-manic');
    expect(manic).not.toBeNull();
    expect(manic.textContent).toContain('Listen to Manic');
    expect(manic.tagName).toBe('BUTTON');
  });

  it('brands the hub as Stalemate Arcade and removes the Neon Arkanoid promo link', () => {
    expect(hubHtml).toContain('<title>Stalemate Arcade');
    expect(hubHtml).toContain('Stalemate Arcade</h1>');
    expect(hubHtml).not.toContain('href="neon-arkanoid.html"');
    expect(hubHtml).not.toContain('PLAY THE ORIGINAL NEON ARKANOID');
  });
});

describe('per-game Stalemate playlist wiring', () => {
  for (const page of ALL_PLAY_PAGES) {
    it(`${page} loads turdsuite and wires suite music`, () => {
      const html = readFileSync(join(root, page), 'utf8');
      expect(html).toContain('assets/turdsuite.js');
      const needsBlock =
        page !== 'neon-arkanoid.html' ||
        html.includes('setMusicGameBlocked');
      if (page === 'neon-arkanoid.html') {
        expect(html).toContain('setMusicGameBlocked');
      } else if (page === 'turdomania.html') {
        expect(html).toContain('setMusicGameBlocked');
        expect(html).toContain('armSuiteMusic');
      } else if (page === 'turdjack.html') {
        expect(html).toContain('setMusicGameBlocked');
        expect(html).toContain('syncSuiteMusic');
      } else {
        expect(html).toContain('setMusicGameBlocked');
      }
      expect(needsBlock).toBe(true);
    });
  }

  it('Crapjack arms playlist audio after a trusted pointer gesture when music is on', async () => {
    const audio = new MockAudio();
    const player = createSuiteMusic({
      isSuiteMuted: () => false,
      resolveSrc: (path) => `http://localhost/assets/${path}`,
      AudioCtor: function () {
        return audio;
      }
    });

    const dom = new JSDOM(
      '<!DOCTYPE html><body><button id="deal" type="button">Deal</button></body>',
      { runScripts: 'dangerously', url: 'http://localhost/turdjack.html' }
    );
    dom.window.Suite = {
      music: () => Promise.resolve(player),
      isMusicEnabled: () => true,
      setMusicGameBlocked: () => {}
    };
    dom.window.eval(`
      function armFromDeal() {
        window.Suite.music().then((p) => { if (p) p.armFromGesture(); });
      }
      document.getElementById('deal').addEventListener('pointerdown', armFromDeal, { once: true });
    `);
    dom.window.document.getElementById('deal').dispatchEvent(
      new dom.window.Event('pointerdown', { bubbles: true })
    );
    await Promise.resolve();
    expect(player.armed).toBe(true);
    expect(player.isPlaying()).toBe(true);
    dom.window.close();
  });

  it.each(HUB_GAMES)('%s stays silent when stalemate.music is off after gesture', async (page) => {
    const audio = new MockAudio();
    let musicOn = false;
    const player = createSuiteMusic({
      isSuiteMuted: () => !musicOn,
      resolveSrc: (path) => `http://localhost/assets/${path}`,
      AudioCtor: function () {
        return audio;
      }
    });
    player.armFromGesture();
    expect(player.isPlaying()).toBe(false);
    musicOn = true;
    player.sync();
    expect(player.isPlaying()).toBe(true);
    musicOn = false;
    player.sync();
    expect(player.isPlaying()).toBe(false);
  });
});

describe('Crapjack celebration dismiss target size', () => {
  it('moment banner enforces at least 44px touch target', () => {
    const html = readFileSync(join(root, 'turdjack.html'), 'utf8');
    const block = html.slice(html.indexOf('.moment-banner {'), html.indexOf('.moment-banner.show'));
    expect(block).toMatch(/min-height:\s*44px/);
    expect(block).toMatch(/min-width:\s*44px/);
  });
});
