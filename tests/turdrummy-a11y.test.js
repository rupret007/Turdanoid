/**
 * @vitest-environment node
 *
 * Screen-reader contract for TurdRummy (round 3): the status box is the one live region, bot moves
 * and round results land in it, and a plain re-render does not rewrite (and so re-announce) it.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30000 });

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'turdrummy.html'), 'utf8');
const coreSources = [
  'games/turdrummy-ai-core.js',
  'games/turdrummy-meld-core.js',
  'games/turdrummy-motion-core.js',
  'games/turdrummy-coach-core.js',
  'games/turdrummy-audio-core.js',
  'games/turdrummy-fx-core.js'
].map((file) => readFileSync(join(root, file), 'utf8'));

const openPages = [];

function boot() {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/turdrummy.html',
    beforeParse(window) {
      for (const src of coreSources) {window.eval(src);}
      window.setTimeout = () => 1;
      window.clearTimeout = () => {};
      window.requestAnimationFrame = () => 1;
      window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      window.Element.prototype.getBoundingClientRect = function () {
        return { left: 10, top: 10, width: 50, height: 70, right: 60, bottom: 80, x: 10, y: 10 };
      };
    }
  });
  openPages.push(dom);
  const w = dom.window;
  // A fixed mid-round deal: the player has a meld and deadwood; the bot has no knock on its first move.
  w.eval(`
    closeGuide();
    clearAiTurnTimeout();
    const deck = createDeck();
    const hand = (spec) => spec.split(' ').map((v) => deck.find((c) => c.suit === v[0] && c.rank === Number(v.slice(1))));
    state.playerHand = hand('H3 H4 H5 C9 D9 S9 C10 D10 H10 D1 C13');
    state.aiHand = hand('C2 D5 S7 H12 C6 D8 S2 H9 C11 D13');
    const used = new Set([...state.playerHand, ...state.aiHand].map((c) => c.id));
    state.stock = deck.filter((c) => !used.has(c.id));
    state.discard = [state.stock.pop()];
    Object.assign(state, { initialized: true, round: 1, turn: 'player', phase: 'draw', roundOver: false, matchOver: false });
    renderAll();
  `);
  return w;
}

afterEach(() => {
  openPages.splice(0).forEach((dom) => dom.window.close());
});

describe('TurdRummy live region', () => {
  it('exposes one polite status region for the whole table', () => {
    const w = boot();
    const box = w.document.getElementById('messageBox');
    expect(box.getAttribute('role')).toBe('status');
    expect(box.getAttribute('aria-live')).toBe('polite');
    expect(w.document.querySelectorAll('[aria-live]')).toHaveLength(1);
  });

  it('does not rewrite the status when the same message re-renders (no repeated announcements)', () => {
    const w = boot();
    w.eval("setMessage('You drew from stock. Select a discard.', '')");
    const box = w.document.getElementById('messageBox');
    const before = box.firstChild;
    // Selecting a card re-renders the whole table with the same status text.
    w.eval('selectCard(state.playerHand[0].id); selectCard(state.playerHand[0].id);');
    expect(box.firstChild).toBe(before);
    expect(box.textContent).toContain('You drew from stock.');
  });

  it('announces the bot move in the status region', () => {
    const w = boot();
    w.eval("state.turn = 'ai'; state.phase = 'draw'; aiTurn();");
    const text = w.document.getElementById('messageBox').textContent;
    expect(text).toContain('AI drew from');
    expect(text).toContain('discarded');
  });

  it('announces the round result, with the summary, in the status region', () => {
    const w = boot();
    w.eval("finishRound('player', true, 0, [])");
    const text = w.document.getElementById('messageBox').textContent;
    expect(text).toContain('You called GIN!');
    expect(text).toContain('Round:');
    expect(text).toContain('defender deadwood');
  });
});
