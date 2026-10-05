/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildMomentTableState, MOMENT_KINDS } from '../games/turdrummy-moment-fixtures.js';

vi.setConfig({ testTimeout: 30000 });

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'turdrummy.html'), 'utf8');
const extraScripts = [
  'games/turdrummy-ai-core.js',
  'games/turdrummy-meld-core.js',
  'games/turdrummy-motion-core.js',
  'games/turdrummy-coach-core.js',
  'games/turdrummy-presentation-core.js',
  'games/turdrummy-moment-fixtures-core.js'
].map((f) => readFileSync(join(root, f), 'utf8'));

const openPages = [];

function boot() {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/turdrummy.html?moment=knock',
    beforeParse(window) {
      for (const src of extraScripts) {
        window.eval(src);
      }
      window.localStorage.setItem('turdrummyCoach_v1', '1');
      if (window.Suite && window.Suite.guide) {
        window.Suite.guide.markSeen('turdrummy.html');
      }
    }
  });
  openPages.push(dom);
  const w = dom.window;
  return {
    w,
    val(expression) {
      return w.eval(expression);
    }
  };
}

afterEach(() => {
  openPages.splice(0).forEach((dom) => dom.window.close());
});

describe('moment fixtures', () => {
  it('exposes four QA kinds with disjoint 20-card hands', () => {
    expect(MOMENT_KINDS.sort()).toEqual(['gin', 'knock', 'match-win', 'undercut']);
    for (const kind of MOMENT_KINDS) {
      const t = buildMomentTableState(kind);
      expect(t.playerHand).toHaveLength(10);
      expect(t.aiHand).toHaveLength(10);
      const ids = new Set([...t.playerHand, ...t.aiHand].map((c) => c.id));
      expect(ids.size).toBe(20);
    }
  });

  it('playMoment finishes the round with the expected scoring branch', () => {
    const page = boot();
    const w = page.w;
    expect(typeof w.TurdRummyDev.playMoment).toBe('function');
    w.TurdRummyDev.playMoment('gin');
    expect(page.val('state.roundOver')).toBe(true);
    expect(page.val('state.roundSummary')).toMatch(/GIN/i);
    expect(w.document.getElementById('roundBanner').classList.contains('show')).toBe(true);
  });

  it('match-win moment ends the match and queues the trophy', () => {
    const page = boot();
    page.w.TurdRummyDev.playMoment('match-win');
    expect(page.val('state.matchOver')).toBe(true);
    expect(page.val('state.playerScore')).toBeGreaterThanOrEqual(100);
    expect(page.val('state.roundSummary')).toMatch(/Match winner: Player/i);
  });

  it('skipPresentation clears the banner without waiting the full timer', () => {
    const page = boot();
    const w = page.w;
    w.TurdRummyDev.playMoment('knock');
    expect(w.document.getElementById('roundBanner').classList.contains('show')).toBe(true);
    w.TurdRummyDev.skipPresentation();
    expect(w.document.getElementById('roundBanner').classList.contains('show')).toBe(false);
  });
});
