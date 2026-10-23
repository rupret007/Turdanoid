import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

import {
  BRICK_MATERIAL_TOP_CB,
  COLORBLIND_STORAGE_KEY,
  MIN_PALETTE_CONTRAST,
  TURDTRIS_PIECE_COLORS_CB,
  attachSuiteArcadeA11y,
  contrastRatio,
  createArcadeA11yToggle,
  ensureArcadeA11yMount,
  minPairwiseContrastOnBg,
  rectInsideViewport,
  rectsOverlap,
  motionIntensity,
  readColorblindEnabled,
  remapBrickColors,
  writeColorblindEnabled
} from '../games/suite-arcade-a11y.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const suiteJs = readFileSync(join(root, 'assets/turdsuite.js'), 'utf8');
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

describe('suite-arcade-a11y core', () => {
  it('detects rectangle overlap for Playwright HUD guards', () => {
    const a = { left: 0, top: 0, right: 50, bottom: 50 };
    const b = { left: 40, top: 40, right: 80, bottom: 80 };
    expect(rectsOverlap(a, b)).toBe(true);
    expect(rectsOverlap(a, { left: 60, top: 60, right: 90, bottom: 90 })).toBe(false);
    expect(rectInsideViewport(a, 320, 568)).toBe(true);
    expect(rectInsideViewport({ left: -5, top: 0, right: 40, bottom: 40 }, 320, 568)).toBe(false);
  });

  it('persists colorblind toggle in localStorage', () => {
    expect(COLORBLIND_STORAGE_KEY).toBe('turdsuite_colorblind_v1');
    const storage = memoryStorage();
    expect(readColorblindEnabled(storage)).toBe(false);
    writeColorblindEnabled(storage, true);
    expect(storage.data[COLORBLIND_STORAGE_KEY]).toBe('1');
    expect(readColorblindEnabled(storage)).toBe(true);
    writeColorblindEnabled(storage, false);
    expect(readColorblindEnabled(storage)).toBe(false);
  });

  it('softens shake, flash, and particles when reduced motion is on', () => {
    const full = motionIntensity(false);
    const reduced = motionIntensity(true);
    expect(reduced.shakeScale).toBeLessThan(full.shakeScale);
    expect(reduced.flashScale).toBe(0);
    expect(reduced.particleScale).toBeLessThan(full.particleScale);
    expect(reduced.allowAutoScroll).toBe(false);
  });

  it('keeps colorblind palettes above minimum contrast on playfield ink', () => {
    const bg = '#061018';
    const pieces = Object.values(TURDTRIS_PIECE_COLORS_CB);
    expect(minPairwiseContrastOnBg(pieces, bg)).toBeGreaterThanOrEqual(MIN_PALETTE_CONTRAST);
    const bricks = Object.values(BRICK_MATERIAL_TOP_CB);
    expect(minPairwiseContrastOnBg(bricks, bg)).toBeGreaterThanOrEqual(MIN_PALETTE_CONTRAST);
    expect(contrastRatio(TURDTRIS_PIECE_COLORS_CB.Z, TURDTRIS_PIECE_COLORS_CB.S)).toBeGreaterThan(1.2);
  });

  it('remaps brick colors only when colorblind mode is enabled', () => {
    const base = { c1: '#3ecf9a', c2: '#1a7a58', glow: 'x', material: 'sewer' };
    expect(remapBrickColors(base, false)).toEqual(base);
    const cb = remapBrickColors(base, true);
    expect(cb.c1).toBe(BRICK_MATERIAL_TOP_CB.sewer);
  });

  it('keeps tar and metal separable in colorblind brick palettes', () => {
    expect(BRICK_MATERIAL_TOP_CB.tar).not.toBe(BRICK_MATERIAL_TOP_CB.metal);
    expect(BRICK_MATERIAL_TOP_CB.tar).toMatch(/^#[0-9a-f]{6}$/i);
    expect(contrastRatio(BRICK_MATERIAL_TOP_CB.tar, BRICK_MATERIAL_TOP_CB.metal)).toBeGreaterThan(1.15);
  });
});

describe('suite-arcade-a11y wiring', () => {
  let dom;

  afterEach(() => {
    dom?.window?.close();
  });

  it('mounts the toggle in the table action dock on Crappy Eights (not a fixed body slot)', () => {
    dom = new JSDOM(
      `<!DOCTYPE html><html><body>
        <div class="topbar"><div class="actions"></div><div class="mobile-menu"></div></div>
        <section class="table"><div class="action-dock"><button id="smartBtn">Smart</button></div></section>
      </body></html>`,
      { url: 'http://localhost/crapeights.html', runScripts: 'outside-only' }
    );
    Object.defineProperty(dom.window, 'innerWidth', { value: 390, configurable: true });
    const mount = ensureArcadeA11yMount(dom.window.document);
    expect(mount?.classList.contains('suite-a11y-table-dock-slot')).toBe(true);
    expect(dom.window.document.querySelector('.suite-a11y-body-slot')).toBeNull();
  });

  it('injects a 44px colorblind toggle on game pages', () => {
    dom = new JSDOM(
      '<!DOCTYPE html><html><body><div class="topbar"><div class="mobile-menu"></div></div></body></html>',
      {
        url: 'http://localhost/turdjack.html',
        runScripts: 'outside-only'
      }
    );
    const Suite = {};
    attachSuiteArcadeA11y(Suite, memoryStorage(), dom.window.document);
    ensureArcadeA11yMount(dom.window.document);
    const btn = createArcadeA11yToggle(dom.window.document, Suite);
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    expect(css).toMatch(/\.suite-arcade-a11y-toggle \{[\s\S]*?min-height: 44px/);
    btn.click();
    expect(Suite.isColorblindMode()).toBe(true);
    expect(dom.window.document.documentElement.classList.contains('suite-colorblind')).toBe(true);
  });

  it('does not inject the toggle on the suite hub (no game HUD)', () => {
    dom = new JSDOM(
      '<!DOCTYPE html><html><body><main id="hub-games" class="games" aria-label="Choose a game"></main></body></html>',
      { url: 'http://localhost/', runScripts: 'outside-only' }
    );
    const Suite = {};
    attachSuiteArcadeA11y(Suite, memoryStorage(), dom.window.document);
    expect(createArcadeA11yToggle(dom.window.document, Suite)).toBeNull();
  });

  it.each(['Enter', ' '])('keeps %j activation events out of game shortcuts', (key) => {
    dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'http://localhost/TurdAnoid.html' });
    const Suite = {};
    attachSuiteArcadeA11y(Suite, memoryStorage(), dom.window.document);
    const leaked = [];
    for (const target of [dom.window.document, dom.window]) {
      for (const type of ['keydown', 'keyup']) {
        target.addEventListener(type, (event) => leaked.push([type, event.key]));
      }
    }
    const btn = createArcadeA11yToggle(dom.window.document, Suite);
    btn.focus();
    for (const type of ['keydown', 'keyup']) {
      const event = new dom.window.KeyboardEvent(type, { key, bubbles: true, cancelable: true });
      btn.dispatchEvent(event);
      // Native button activation must remain available to the browser.
      expect(event.defaultPrevented).toBe(false);
    }
    expect(leaked).toEqual([]);
    btn.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(leaked).toEqual([['keydown', 'Tab'], ['keydown', 'Tab']]);
  });

  it('turdsuite boot loads the arcade a11y module path', () => {
    expect(suiteJs).toContain('suite-arcade-a11y.js');
    expect(suiteJs).toContain('createArcadeA11yToggle');
    expect(suiteJs).toContain('getReducedMotion');
  });

  for (const page of HUB_GAMES) {
    it(`${page} loads turdsuite.js for shared arcade a11y`, () => {
      const html = readFileSync(join(root, page), 'utf8');
      expect(html).toContain('assets/turdsuite.js');
    });
  }
});
