/**
 * Page-level suite difficulty behavior (real HTML + jsdom).
 *
 * Mutation traps (each applied one-at-a-time; full suite run; never committed):
 * M1 TurdAnoid lives fixed at 3 — caught by "TurdAnoid hard mode applies fewer starting lives"
 * M2 TurdAnoid ball speed ignoring difficulty — caught by "TurdAnoid hard mode increases launch ball speed"
 * M3 Turdtris drop speed ignoring difficulty — caught by "Turdtris hard mode shortens gravity interval"
 * M4 Crappy Eights drawer change saving nothing — caught by "Crappy Eights drawer difficulty persists suite key"
 * M5 Turdomania ignoring shared level — caught by "Turdomania boots at the saved suite difficulty level"
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

import { mountDifficultyPicker } from '../assets/suite-difficulty-ui.js';
import { validEightsSnapshot } from './continue-fixtures.js';
import { inlineTurdomaniaImports, installTurdomaniaModules } from './turdomania-page-harness.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const turdanoidHtml = readFileSync(join(root, 'TurdAnoid.html'), 'utf8');
const turdtrisHtml = readFileSync(join(root, 'turdtris.html'), 'utf8').replace(
  /<script type="module"[^>]*>[\s\S]*?<\/script>\s*/g,
  ''
);
const turdomaniaHtml = inlineTurdomaniaImports(readFileSync(join(root, 'turdomania.html'), 'utf8'))
  .replace(/<script type="module"[^>]*>/, '<script>');
const turdrummyHtml = readFileSync(join(root, 'turdrummy.html'), 'utf8');
const crapeightsHtml = readFileSync(join(root, 'crapeights.html'), 'utf8');
const suiteJs = readFileSync(join(root, 'assets/turdsuite.js'), 'utf8');
const coreJs = readFileSync(join(root, 'games/table-continue-core.js'), 'utf8');
const levelsCore = readFileSync(join(root, 'games/turdanoid-levels-core.js'), 'utf8');
const storageCore = readFileSync(join(root, 'games/turdanoid-storage-core.js'), 'utf8');
const turdrummyCores = [
  'games/turdrummy-ai-core.js',
  'games/turdrummy-meld-core.js',
  'games/turdrummy-motion-core.js',
  'games/turdrummy-coach-core.js',
  'games/turdrummy-audio-core.js',
  'games/turdrummy-fx-core.js'
].map((file) => readFileSync(join(root, file), 'utf8'));
const crapeightsSources = [
  'table-continue-core',
  'crapeights-ai',
  'crapeights-presentation',
  'crapeights-table',
  'crapeights-hand',
  'crapeights-effects'
].map((name) => readFileSync(join(root, 'games', `${name}.js`), 'utf8'));

const openPages = [];

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

function wireSuite(window, difficulty = 'normal') {
  window.__SUITE_SKIP_MODULES = true;
  window.eval(coreJs);
  window.eval(suiteJs);
  try {
    window.localStorage.setItem('turdsuite_difficulty_v1', difficulty);
    window.Suite.difficulty.load();
  } catch {
    /* ignore */
  }
}

function bootTurdanoid(difficulty = 'normal') {
  const dom = new JSDOM(turdanoidHtml, {
    runScripts: 'dangerously',
    url: 'http://localhost/TurdAnoid.html',
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = () => makeCtxStub();
      window.requestAnimationFrame = () => 0;
      window.cancelAnimationFrame = () => {};
      window.eval(levelsCore);
      window.eval(storageCore);
      wireSuite(window, difficulty);
    }
  });
  openPages.push(dom);
  const g = dom.window.__turdanoid;
  if (!g) {
    throw new Error('TurdAnoid test hook missing');
  }
  return { dom, g, w: dom.window };
}

function bootTurdtris(difficulty = 'normal') {
  const dom = new JSDOM(turdtrisHtml, {
    runScripts: 'dangerously',
    url: 'http://localhost/turdtris.html',
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = () => makeCtxStub();
      window.requestAnimationFrame = () => 1;
      window.cancelAnimationFrame = () => {};
      wireSuite(window, difficulty);
    }
  });
  openPages.push(dom);
  return dom.window;
}

function bootTurdomania(difficulty = 'normal') {
  const dom = new JSDOM(turdomaniaHtml, {
    runScripts: 'dangerously',
    url: 'http://localhost/turdomania.html',
    beforeParse(window) {
      installTurdomaniaModules(window);
      window.requestAnimationFrame = () => 1;
      window.cancelAnimationFrame = () => {};
      window.matchMedia = () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {}
      });
      wireSuite(window, difficulty);
    }
  });
  openPages.push(dom);
  return dom.window;
}

function bootTurdrummy(stored = {}) {
  let nextTimer = 1;
  const timers = new Map();
  const dom = new JSDOM(turdrummyHtml, {
    runScripts: 'dangerously',
    url: 'http://localhost/turdrummy.html',
    beforeParse(window) {
      for (const src of turdrummyCores) {
        window.eval(src);
      }
      for (const [key, value] of Object.entries(stored)) {
        window.localStorage.setItem(key, value);
      }
      window.setTimeout = (callback, delay) => {
        const id = nextTimer++;
        timers.set(id, { callback, delay });
        return id;
      };
      window.clearTimeout = (id) => timers.delete(id);
      window.setInterval = () => nextTimer++;
      window.clearInterval = () => {};
      window.requestAnimationFrame = () => nextTimer++;
      window.cancelAnimationFrame = () => {};
      window.Element.prototype.getBoundingClientRect = function () {
        return { left: 10, top: 10, width: 50, height: 70, right: 60, bottom: 80, x: 10, y: 10 };
      };
      wireSuite(window, stored.turdsuite_difficulty_v1 || 'normal');
    }
  });
  openPages.push(dom);
  mountDifficultyPicker(dom.window.document, dom.window.Suite.difficulty);
  return dom.window;
}

function bootCrapeights(initialStorage = {}) {
  const timers = new Map();
  let nextTimer = 1;
  const dom = new JSDOM(crapeightsHtml, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/crapeights.html',
    beforeParse(window) {
      window.__SUITE_SKIP_MODULES = true;
      window.setTimeout = (callback, delay) => {
        const id = nextTimer++;
        timers.set(id, { callback, delay });
        return id;
      };
      window.clearTimeout = (id) => timers.delete(id);
      window.setInterval = () => nextTimer++;
      window.clearInterval = () => {};
      window.requestAnimationFrame = () => nextTimer++;
      window.cancelAnimationFrame = () => {};
      window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.localStorage.setItem('crapeightsSoundOn_v1', '0');
      window.localStorage.setItem('turdsuite_muted', '1');
      window.localStorage.setItem(
        'turdsuite_continue_v1',
        JSON.stringify({
          v: 1,
          games: { 'crapeights.html': { updatedAt: 1, snapshot: validEightsSnapshot() } }
        })
      );
      for (const [key, value] of Object.entries(initialStorage)) {
        window.localStorage.setItem(key, value);
      }
      crapeightsSources.forEach((source) => window.eval(source));
      window.eval(coreJs);
      window.eval(suiteJs);
      window.Suite.difficulty.load();
      const core = window.TurdSuiteTableContinue;
      window.Suite.table = {
        load: (page) => core.loadContinue(window.localStorage, page),
        remember: (page, state) => core.rememberContinue(window.localStorage, page, state),
        clear: (page) => core.clearContinue(window.localStorage, page)
      };
      window.Suite.guide = { hasSeen: () => true, mark() {} };
      window.Suite.toast = () => {};
      window.Suite.isMuted = () => true;
    }
  });
  openPages.push(dom);
  return dom.window;
}

afterEach(() => {
  openPages.splice(0).forEach((dom) => dom.window.close());
});

describe('suite difficulty page behavior', () => {
  it('TurdAnoid hard mode applies fewer starting lives', () => {
    const { g } = bootTurdanoid('hard');
    g.startGame();
    expect(g.lives).toBe(2);
  });

  it('TurdAnoid hard mode increases launch ball speed vs normal', () => {
    const normal = bootTurdanoid('normal');
    normal.g.startGame();
    const normalSpeed = normal.g.balls[0].baseSpeed;
    const hard = bootTurdanoid('hard');
    hard.g.startGame();
    expect(hard.g.balls[0].baseSpeed).toBeGreaterThan(normalSpeed);
  });

  it('Turdtris hard mode shortens gravity interval vs normal', () => {
    const normal = bootTurdtris('normal');
    normal.eval('level = 4');
    const normalMs = normal.eval('getGravityMs()');
    const hard = bootTurdtris('hard');
    hard.eval('level = 4');
    const hardMs = hard.eval('getGravityMs()');
    expect(hardMs).toBeLessThan(normalMs);
  });

  it('Crappy Eights drawer reflects saved hard suite difficulty at startup', () => {
    const w = bootCrapeights({ turdsuite_difficulty_v1: 'hard' });
    expect(w.eval('aiDifficulty')).toBe('sharp');
    expect(w.document.getElementById('aiDifficulty').value).toBe('sharp');
  });

  it('Crappy Eights drawer difficulty persists suite key', () => {
    const w = bootCrapeights({ turdsuite_difficulty_v1: 'normal' });
    const sel = w.document.getElementById('aiDifficulty');
    sel.value = 'sharp';
    sel.dispatchEvent(new w.Event('change', { bubbles: true }));
    expect(w.localStorage.getItem('turdsuite_difficulty_v1')).toBe('hard');
    expect(w.eval('aiDifficulty')).toBe('sharp');
  });

  it('Crappy Eights maps legacy sharp suite storage to hard drawer value', () => {
    const w = bootCrapeights({ crapeights_difficulty_v1: 'sharp' });
    expect(w.eval('aiDifficulty')).toBe('sharp');
    expect(w.document.getElementById('aiDifficulty').value).toBe('sharp');
  });

  it('Turdomania boots at the saved suite difficulty level', () => {
    const w = bootTurdomania('hard');
    expect(w.__turdomania.state.level).toBe('hard');
    expect(w.__turdomania.Core.LEVELS.hard.kinds).toBeGreaterThan(w.__turdomania.Core.LEVELS.normal.kinds);
  });

  it('Turdrummy Bot button updates the shared picker without reload', () => {
    const w = bootTurdrummy({ turdsuite_difficulty_v1: 'normal', turdsuite_guides_seen_v1: '1' });
    w.eval('cycleDifficulty()');
    expect(w.localStorage.getItem('turdsuite_difficulty_v1')).toBe('hard');
    const hardBtn = w.document.querySelector('.suite-difficulty-btn[data-level="hard"]');
    expect(hardBtn).toBeTruthy();
    expect(hardBtn.getAttribute('aria-pressed')).toBe('true');
  });
});
