/**
 * @vitest-environment node
 *
 * Boots the live page in its own JSDOM window per case, so it does not need vitest's
 * global jsdom environment (that setup costs time on every file in the suite).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mountDifficultyPicker } from '../assets/suite-difficulty-ui.js';

// Each case boots the whole page in JSDOM; under the parallel full-suite run that can exceed vitest's 5s default.
vi.setConfig({ testTimeout: 30000 });

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'turdrummy.html'), 'utf8');
const suiteJs = readFileSync(join(root, 'assets/turdsuite.js'), 'utf8');
const tableContinueCore = readFileSync(join(root, 'games/table-continue-core.js'), 'utf8');
// Round-2 core modules are classic scripts; the page reads them off `window`, so JSDOM
// evaluates them before the page parses. Without them the page must still boot (layoff tests).
const coreSources = [
  'games/turdrummy-ai-core.js',
  'games/turdrummy-meld-core.js',
  'games/turdrummy-motion-core.js',
  'games/turdrummy-coach-core.js',
  'games/turdrummy-audio-core.js',
  'games/turdrummy-fx-core.js'
].map((file) => readFileSync(join(root, file), 'utf8'));

const openPages = [];

function boot({ reduced = false, canAnimate = true, stored = {}, storageFailure } = {}) {
  let nextTimer = 1;
  const timers = new Map();
  const animations = [];
  const errors = [];
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/turdrummy.html',
    beforeParse(window) {
      window.addEventListener('error', (event) => {
        errors.push(event.message);
        event.preventDefault();
      });
      for (const src of coreSources) {window.eval(src);}
      if (storageFailure === 'getter') {
        Object.defineProperty(window, 'localStorage', { get() {
          throw new window.DOMException('Storage blocked', 'SecurityError');
        } });
      } else if (storageFailure) {
        const storage = window.localStorage;
        Object.defineProperty(window, 'localStorage', { value: {
          getItem: storageFailure === 'read'
            ? () => { throw new window.DOMException('Storage blocked', 'SecurityError'); }
            : storage.getItem.bind(storage),
          setItem: storageFailure === 'write'
            ? () => { throw new window.DOMException('Storage full', 'QuotaExceededError'); }
            : storage.setItem.bind(storage),
          removeItem: storage.removeItem.bind(storage)
        } });
      }
      window.__SUITE_SKIP_MODULES = true;
      window.eval(tableContinueCore);
      window.eval(suiteJs);
      for (const [key, value] of Object.entries(stored)) {window.localStorage.setItem(key, value);}
      window.Suite?.difficulty?.load?.();
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
      window.Math.random = () => 0.42;
      window.matchMedia = (query) => ({
        matches: query.includes('reduce') ? reduced : false,
        media: query,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {}
      });
      // JSDOM has no layout: give every element a box so the page's flight code runs.
      window.Element.prototype.getBoundingClientRect = function () {
        return { left: 10, top: 10, width: 50, height: 70, right: 60, bottom: 80, x: 10, y: 10 };
      };
      if (canAnimate) {
        window.Element.prototype.animate = function (frames, options) {
          animations.push({ frames, options, node: this });
          return { onfinish: null, oncancel: null };
        };
      }
    }
  });
  openPages.push(dom);
  const w = dom.window;
  return {
    w,
    errors,
    animations,
    timers,
    run(code) {
      return w.eval(code);
    },
    json(expression) {
      return JSON.parse(w.eval(`JSON.stringify(${expression})`));
    },
    $(selector) {
      return w.document.querySelector(selector);
    },
    $$(selector) {
      return Array.from(w.document.querySelectorAll(selector));
    }
  };
}

// A deterministic knock-free fixture: 11 cards in three melds and a deadwood pair.
const FIXTURE_HAND = 'H3 H4 H5 C9 D9 S9 C10 D10 H10 D1 C13';
const FIXTURE_AI = 'H6 H7 C1 C2 C3 S4 S5 S6 S7 S8';

function setFixture(page, { phase = 'discard', playerScore = 0 } = {}) {
  page.run(`
    clearAiTurnTimeout();
    const deck = createDeck();
    const hand = (spec) => spec.split(' ').map((v) => deck.find((c) => c.suit === v[0] && c.rank === Number(v.slice(1))));
    state.playerHand = hand('${FIXTURE_HAND}');
    state.aiHand = hand('${FIXTURE_AI}');
    const used = new Set([...state.playerHand, ...state.aiHand].map((c) => c.id));
    state.stock = deck.filter((c) => !used.has(c.id));
    state.discard = [state.stock.pop()];
    const discard = state.playerHand.at(-1);
    Object.assign(state, {
      initialized: true, round: 1, turn: 'player', phase: '${phase}', playerScore: ${playerScore},
      selectedCardId: ${phase === 'discard' ? 'discard.id' : 'null'},
      drawnCardId: ${phase === 'discard' ? 'discard.id' : 'null'},
      drawnCardSource: ${phase === 'discard' ? "'stock'" : 'null'},
      roundOver: false, matchOver: false
    });
    renderAll();
  `);
}

afterEach(() => {
  openPages.splice(0).forEach((dom) => dom.window.close());
});

describe('storage failure recovery', () => {
  it.each(['getter', 'read', 'write'])('keeps a real round playable when storage %s fails', (storageFailure) => {
    const page = boot({ storageFailure, reduced: true });
    expect(page.errors).toEqual([]);
    page.run('closeGuide(); startFirstRoundIfNeeded();');
    expect(page.$$('#playerHand [data-hand-id]')).toHaveLength(10);
    // The opening dealer is the player, so execute the scheduled real bot turn.
    const aiTimer = page.run('aiTurnTimeoutId');
    page.timers.get(aiTimer).callback();
    page.timers.delete(aiTimer);
    expect(page.$('#drawStockBtn').disabled).toBe(false);
    page.$('#drawStockBtn').click();
    expect(page.$$('#playerHand [data-hand-id]')).toHaveLength(11);
    page.$('#playerHand [data-card-id]').click();
    page.$('#discardBtn').click();
    expect(page.$$('#playerHand [data-hand-id]')).toHaveLength(10);
    expect(() => page.run('cycleDifficulty(); finishCoach(); saveStats();')).not.toThrow();
    expect(page.$('#difficultyBtn').textContent).toContain('Sharp');
    expect(page.$('#coachCard').hidden).toBe(true);
    expect(page.errors).toEqual([]);
  });
});

describe('TurdRummy hand presentation', () => {
  it('groups the hand into meld brackets with a deadwood group last', () => {
    const page = boot();
    setFixture(page);
    const kinds = page.$$('#playerHand .hand-group').map((node) => node.dataset.kind);
    // The analyzer lists sets before runs; the page keeps that order so the brackets read the same way every time.
    expect(kinds).toEqual(['set', 'set', 'run', 'deadwood']);
    expect(page.$$('#playerHand [data-hand-id]')).toHaveLength(11);
    expect(page.$$('#playerHand .hand-group--deadwood [data-hand-id]').map((n) => n.dataset.rank + n.dataset.suit).sort())
      .toEqual(['AD', 'KC']);
  });

  it('keeps every hand card addressable by id, not by DOM position', () => {
    const page = boot();
    setFixture(page);
    const ids = page.$$('#playerHand [data-hand-id]').map((n) => n.dataset.handId).sort();
    const expected = page.json('state.playerHand.map((c) => c.id).sort()');
    expect(ids).toEqual(expected);
  });

  it('keeps keyboard focus on the same card after a re-render', () => {
    const page = boot();
    setFixture(page);
    const id = page.run("state.playerHand.find((c) => c.suit === 'C' && c.rank === 9).id");
    const target = page.$('#playerHand [data-card-id="' + id + '"]');
    target.focus();
    page.run('renderAll()');
    expect(page.w.document.activeElement.getAttribute('data-card-id')).toBe(target.getAttribute('data-card-id'));
  });

  it('turns the bot hand face-up at round end and tags it for a staggered flip', () => {
    const page = boot();
    setFixture(page);
    page.run("finishRound('player', true, 0, [])");
    const faces = page.$$('#opponentCards [data-hand-id]');
    expect(faces).toHaveLength(10);
    expect(faces.every((n) => n.classList.contains('card-flip'))).toBe(true);
    expect(page.$('#aiMeta').textContent).toBe('10 revealed');
  });
});

describe('reduced-motion gating', () => {
  it('creates card flights when motion is allowed', () => {
    const page = boot({ reduced: false, canAnimate: true });
    setFixture(page, { phase: 'draw' });
    page.run('playerDrawFromStock()');
    expect(page.$$('.fly-card').length).toBeGreaterThan(0);
    expect(page.animations.length).toBeGreaterThan(0);
  });

  it('creates no flights and no animations when prefers-reduced-motion is set', () => {
    const page = boot({ reduced: true, canAnimate: true });
    setFixture(page, { phase: 'draw' });
    page.run('playerDrawFromStock()');
    expect(page.$$('.fly-card')).toHaveLength(0);
    expect(page.animations).toHaveLength(0);
  });

  it('creates no flights when the environment cannot animate, even without reduced motion', () => {
    const page = boot({ reduced: false, canAnimate: false });
    setFixture(page, { phase: 'draw' });
    page.run('playerDrawFromStock()');
    expect(page.$$('.fly-card')).toHaveLength(0);
  });

  it('sets the deadwood counter instantly under reduced motion', () => {
    const page = boot({ reduced: true, canAnimate: true });
    setFixture(page);
    expect(page.$('#deadwoodValue').textContent).toBe(String(page.run('analyzeHand(state.playerHand).deadwoodScore')));
  });
});

describe('difficulty, coach, trophy and saves', () => {
  it('syncs the shared suite picker when the Bot button cycles difficulty', () => {
    const page = boot({ stored: { turdsuite_guides_seen_v1: '1' } });
    mountDifficultyPicker(page.w.document, page.w.Suite.difficulty);
    page.run('cycleDifficulty()');
    const hardBtn = page.$('.suite-difficulty-btn[data-level="hard"]');
    expect(hardBtn).toBeTruthy();
    expect(hardBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('cycles Easy, Normal, Sharp and saves the choice under its own key', () => {
    const page = boot();
    expect(page.$('#difficultyBtn').textContent).toContain('Normal');
    page.run('cycleDifficulty()');
    expect(page.w.localStorage.getItem('turdrummyDifficulty_v1')).toBe('sharp');
    page.run('cycleDifficulty()');
    expect(page.w.localStorage.getItem('turdrummyDifficulty_v1')).toBe('easy');
    expect(page.$('#difficultyBtn').textContent).toContain('Easy');
  });

  it('restores a saved difficulty on boot', () => {
    const page = boot({ stored: { turdrummyDifficulty_v1: 'sharp' } });
    expect(page.$('#difficultyBtn').textContent).toContain('Sharp');
  });

  it('shows the coach in round one and hides it once finished', () => {
    const page = boot();
    page.run('closeGuide(); startFirstRoundIfNeeded();');
    expect(page.$('#coachCard').hidden).toBe(false);
    expect(page.$('#coachStep').textContent).toBe('Coach 1 of 4');
    page.run('finishCoach()');
    expect(page.$('#coachCard').hidden).toBe(true);
    expect(page.w.localStorage.getItem('turdrummyCoach_v1')).toBe('1');
  });

  it('does not show the coach again once it has been completed', () => {
    const page = boot({ stored: { turdrummyCoach_v1: '1' } });
    page.run('closeGuide(); startFirstRoundIfNeeded();');
    expect(page.$('#coachCard').hidden).toBe(true);
  });

  it('shows the trophy from the saved stats key', () => {
    const savedStats = JSON.stringify({ stats: { roundsPlayed: 7, playerRoundWins: 4, playerGins: 1, aiRoundWins: 3, aiGins: 0, undercuts: 2 } });
    const page = boot({ stored: { turdrummy_stats_v1: savedStats } });
    setFixture(page, { playerScore: 95 });
    page.run("finishRound('player', true, 0, [])");
    page.run('showTrophy()');
    expect(page.$('#trophyOverlay').classList.contains('show')).toBe(true);
    expect(page.$('#trophyHeadline').textContent).toBe('Sewer Champion');
    // finishRound saved the round first, so the trophy must show the saved numbers, not stale ones.
    const saved = JSON.parse(page.w.localStorage.getItem('turdrummy_stats_v1')).stats;
    expect(saved.roundsPlayed).toBe(8);
    expect(page.$('#trophyStats').textContent).toContain(String(saved.roundsPlayed));
  });

  it('keeps the saved stats envelope shape ({ stats }) that older saves use', () => {
    const page = boot();
    setFixture(page);
    page.run("finishRound('player', true, 0, [])");
    const saved = JSON.parse(page.w.localStorage.getItem('turdrummy_stats_v1'));
    expect(Object.keys(saved)).toEqual(['stats']);
    expect(Object.keys(saved.stats)).toEqual(expect.arrayContaining(['roundsPlayed', 'playerRoundWins', 'aiRoundWins', 'playerGins', 'aiGins', 'undercuts']));
  });
});
