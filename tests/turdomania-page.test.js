// @vitest-environment node
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Core from '../games/turdomania-core.js';

const html = readFileSync(new URL('../turdomania.html', import.meta.url), 'utf8');
const pages = [];

function boot(reduced = false) {
  const dom = new JSDOM(html, {
    url: `http://localhost/turdomania.html?seed=42&fullsize=1&reducedMotion=${Number(reduced)}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  pages.push(dom);
  const w = dom.window;
  w.matchMedia = () => ({ matches: false });
  w.setTimeout = vi.fn((callback, delay) => setTimeout(callback, delay));
  w.clearTimeout = (id) => clearTimeout(id);
  w.__core = Core;
  for (const script of w.document.querySelectorAll('script:not([src])')) {
    // JSDOM cannot load ES modules; supply the real imported core to the page.
    w.eval(script.textContent.replace("import * as Core from './games/turdomania-core.js';", 'const Core = window.__core;'));
  }
  return {
    w,
    $: (selector) => w.document.querySelector(selector),
    state: () => w.__turdomania.state,
    key: (key) => w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true }))
  };
}

function pop(game) {
  const { board } = game.state();
  for (let c = 0; c < board.length; c++) {
    for (let r = 0; r < board[c].length; r++) {
      const group = Core.findGroup(board, c, r);
      if (group.length >= 2) {
        const expected = Core.play(game.state(), c, r).state;
        game.$(`[data-col="${c}"][data-row="${r}"]`).dispatchEvent(
          new game.w.Event('pointerdown', { bubbles: true, cancelable: true })
        );
        return expected;
      }
    }
  }
  throw new Error('Seeded board must have a playable group');
}

function expectBoard(game, expected = game.state()) {
  const tiles = Array.from(game.w.document.querySelectorAll('#board .tile'));
  const ids = expected.board.flat().map((tile) => `tile-${tile.id}`).sort();
  expect(tiles.map((tile) => tile.id).sort()).toEqual(ids);
  expect(new Set(tiles.map((tile) => tile.id)).size).toBe(tiles.length);
  expect(game.$('#left').textContent).toBe(String(ids.length));
  expect(game.$('#score').textContent).toBe(String(expected.score));
  expect(game.state()).toEqual(expected);
  for (const tile of tiles) {
    expect(expected.board[Number(tile.dataset.col)][Number(tile.dataset.row)].id).toBe(Number(tile.dataset.id));
  }
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  pages.splice(0).forEach((dom) => dom.window.close());
  vi.clearAllTimers();
  vi.useRealTimers();
});

const resets = [
  ['New Board', (game) => game.$('#newBtn').click()],
  ['N shortcut', (game) => game.key('n')],
  ['Undo', (game) => game.key('u')],
  ['difficulty', (game) => {
    game.$('#levelSel').value = 'hard';
    game.$('#levelSel').dispatchEvent(new game.w.Event('change', { bubbles: true }));
  }],
  ['Undo then New Board', (game) => { game.key('u'); game.$('#newBtn').click(); }]
];

describe.each([false, true])('Turdomania page pop lifecycle (reduced motion: %s)', (reduced) => {
  it.each(resets)('%s keeps one node per new tile after pending timers finish', (_name, reset) => {
    const game = boot(reduced);
    pop(game);
    reset(game);
    const fresh = game.state();
    expect(fresh.moves).toBe(0);
    expectBoard(game, fresh);
    const live = game.$('#live').textContent;
    vi.advanceTimersByTime(1000);
    expectBoard(game, fresh);
    expect(game.$('#live').textContent).toBe(live);
    expect(game.$('#overlay').classList.contains('show')).toBe(false);
  });

  it('accepts a pop immediately after repeated New Board and completes it once', () => {
    const game = boot(reduced);
    pop(game);
    game.$('#newBtn').click();
    game.$('#newBtn').click();
    const expected = pop(game);
    vi.advanceTimersByTime(170);
    expectBoard(game, expected);
    expect(game.state().moves).toBe(1);
    const live = game.$('#live').textContent;
    expect(live).toMatch(/^Popped /);
    vi.advanceTimersByTime(1000);
    expectBoard(game, expected);
    expect(game.$('#live').textContent).toBe(live);
  });

  it('completes normal pops and undo without leaving duplicate tiles', () => {
    const game = boot(reduced);
    const initial = game.state();
    const expected = pop(game);
    if (reduced) {
      expectBoard(game, expected);
      expect(vi.getTimerCount()).toBe(0);
    } else {
      expect(game.$('.popping')).not.toBeNull();
      vi.advanceTimersByTime(170);
      expectBoard(game, expected);
    }
    game.key('u');
    expectBoard(game, initial);
  });
});

it('cancels the old completion and rejects it even if already queued during a new pop', () => {
  const game = boot();
  pop(game);
  const callIndex = game.w.setTimeout.mock.calls.findIndex(([, delay]) => delay === 170);
  expect(callIndex).toBeGreaterThanOrEqual(0);
  const [staleFinish] = game.w.setTimeout.mock.calls[callIndex];
  const oldTimer = game.w.setTimeout.mock.results[callIndex].value;
  const cancel = vi.spyOn(game.w, 'clearTimeout');
  game.$('#newBtn').click();
  expect(cancel).toHaveBeenCalledWith(oldTimer);
  const expected = pop(game);
  const popping = game.$('.popping');
  expect(popping).not.toBeNull();
  const live = game.$('#live').textContent;
  staleFinish();
  expect(game.$('.popping')).toBe(popping);
  expect(game.$('#live').textContent).toBe(live);
  // A stale completion must not unlock input during the new animation.
  pop(game);
  vi.advanceTimersByTime(170);
  expectBoard(game, expected);
});
