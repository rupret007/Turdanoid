import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Script } from 'node:vm';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

import * as Core from '../games/turdomania-core.js';

const html = readFileSync(resolve(process.cwd(), 'turdomania.html'), 'utf8');
const windows = [];

afterEach(() => {
  windows.splice(0).forEach((win) => win.close());
});

function denyStorage(win, mode) {
  const fail = () => {
    throw new win.DOMException('Storage denied', 'SecurityError');
  };
  if (mode === 'getter') {
    Object.defineProperty(win, 'localStorage', { configurable: true, get: fail });
  } else {
    Object.defineProperty(win.Storage.prototype, mode, { configurable: true, value: fail });
  }
}

function boot({ denial, saved = {}, reduced = true } = {}) {
  const dom = new JSDOM(html, {
    url: `http://localhost/turdomania.html?seed=42&fullsize=1&reducedMotion=${reduced ? 1 : 0}`,
    runScripts: 'outside-only'
  });
  const win = dom.window;
  windows.push(win);
  const errors = [];
  win.addEventListener('error', (event) => errors.push(event.error));
  win.matchMedia = () => ({ matches: false });
  win.requestAnimationFrame = (fn) => { fn(); return 1; };
  win.cancelAnimationFrame = () => {};
  for (const [key, value] of Object.entries(saved)) {
    win.localStorage.setItem(key, value);
  }
  if (denial) { denyStorage(win, denial); }
  win.__core = Core;
  // Execute both shipped inline scripts, replacing only the module import for JSDOM.
  for (const script of win.document.querySelectorAll('script:not([src])')) {
    const source = script.textContent.replace("import * as Core from './games/turdomania-core.js';", 'const Core = window.__core;');
    new Script(source, { filename: 'turdomania-inline.js' }).runInContext(dom.getInternalVMContext());
  }
  return { win, errors, el: (id) => win.document.getElementById(id) };
}

function fixture(page, rows) {
  // Use the existing page debug state to reach an ending with one real pointer action.
  page.win.__turdomania.state.board = Core.boardFromRows(rows);
  page.win.dispatchEvent(new page.win.Event('resize'));
}

function pop(page) {
  page.win.document.querySelector('.tile[data-col="0"][data-row="0"]').dispatchEvent(
    new page.win.MouseEvent('pointerdown', { bubbles: true, cancelable: true })
  );
}

function expectBoard(page, count, score) {
  expect(page.win.document.querySelectorAll('.tile')).toHaveLength(count);
  expect(page.el('left').textContent).toBe(String(count));
  expect(page.el('score').textContent).toBe(String(score));
}

describe('Turdomania page with denied storage', () => {
  for (const denial of ['getter', 'getItem', 'setItem']) {
    it(`${denial}: boots, pops, undoes, starts boards and changes difficulty`, () => {
      const page = boot({ denial });
      expectBoard(page, 120, 0);
      expect(page.el('best').textContent).toBe('0');
      expect(page.el('levelSel').value).toBe('normal');
      fixture(page, [[0, 0, 0, 1, 1]]);
      pop(page);
      expectBoard(page, 2, 1);
      expect(page.el('undoBtn').disabled).toBe(false);
      page.el('undoBtn').click();
      expectBoard(page, 5, 0);
      expect(page.el('undoBtn').disabled).toBe(true);
      page.el('newBtn').click();
      expectBoard(page, 120, 0);
      page.el('levelSel').value = 'easy';
      page.el('levelSel').dispatchEvent(new page.win.Event('change'));
      expect(page.win.__turdomania.state.level).toBe('easy');
      expectBoard(page, 80, 0);
      page.el('newBtn').click();
      expect(page.el('levelSel').value).toBe('easy');
      expectBoard(page, 80, 0);
      expect(page.errors).toEqual([]);
    });

    for (const reduced of [true, false]) {
      it(`${denial}: finishes clear and clogged boards with reduced motion ${reduced}`, async () => {
        const page = boot({ denial, reduced });
        for (const cleared of [false, true]) {
          const rows = [cleared ? [0, 0, 0] : [0, 0, 0, 1]];
          fixture(page, rows);
          pop(page);
          if (!reduced) { await new Promise((resolve) => setTimeout(resolve, 220)); }
          const score = cleared ? 1001 : 1;
          expectBoard(page, cleared ? 0 : 1, score);
          expect(page.el('overlay').classList.contains('show')).toBe(true);
          expect(page.el('overTitle').textContent).toContain(cleared ? 'Squeaky clean!' : 'Clogged!');
          expect(page.el('overText').textContent).toContain(`Final ${score}.`);
          page.el('overUndoBtn').click();
          expectBoard(page, rows[0].length, 0);
          expect(page.el('overlay').classList.contains('show')).toBe(false);
          pop(page);
          if (!reduced) { await new Promise((resolve) => setTimeout(resolve, 220)); }
          expect(page.el('overlay').classList.contains('show')).toBe(true);
          page.el('againBtn').click();
          expectBoard(page, 120, 0);
          expect(page.el('overlay').classList.contains('show')).toBe(false);
          expect(page.win.document.activeElement).toBe(page.el('board'));
        }
        expect(page.errors).toEqual([]);
      });
    }
  }

  it('keeps playing when storage access is revoked after boot', () => {
    const page = boot();
    fixture(page, [[0, 0, 0, 1, 1]]);
    denyStorage(page.win, 'getter');
    pop(page);
    expectBoard(page, 2, 1);
    pop(page);
    expectBoard(page, 0, 1001);
    expect(page.el('overlay').classList.contains('show')).toBe(true);
    page.el('overUndoBtn').click();
    expectBoard(page, 2, 1);
    page.el('newBtn').click();
    expectBoard(page, 120, 0);
    expect(page.errors).toEqual([]);
  });

  it('loads valid preferences and per-level best scores and persists improvements', () => {
    const page = boot({ saved: {
      [Core.PREFS_KEY]: JSON.stringify({ v: 1, level: 'easy' }),
      [Core.BEST_KEY]: JSON.stringify({ v: 1, best: { easy: 50, normal: 60, hard: 70 } })
    } });
    expectBoard(page, 80, 0);
    expect(page.el('levelSel').value).toBe('easy');
    expect(page.el('best').textContent).toBe('50');
    fixture(page, [[0, 0, 0]]);
    pop(page);
    expect(page.el('best').textContent).toBe('1001');
    expect(Core.readBest(page.win.localStorage)).toEqual({ easy: 1001, normal: 60, hard: 70 });
    page.el('againBtn').click();
    expect(page.el('best').textContent).toBe('1001');
    page.el('levelSel').value = 'hard';
    page.el('levelSel').dispatchEvent(new page.win.Event('change'));
    expectBoard(page, 168, 0);
    expect(page.el('best').textContent).toBe('70');
    expect(JSON.parse(page.win.localStorage.getItem(Core.PREFS_KEY))).toEqual({ v: 1, level: 'hard' });
    const reloaded = boot({ saved: {
      [Core.PREFS_KEY]: page.win.localStorage.getItem(Core.PREFS_KEY),
      [Core.BEST_KEY]: page.win.localStorage.getItem(Core.BEST_KEY)
    } });
    expect(reloaded.el('levelSel').value).toBe('hard');
    expect(reloaded.el('best').textContent).toBe('70');
    expect(page.errors).toEqual([]);
    expect(reloaded.errors).toEqual([]);
  });

  it('still loads readable saves when writes fail, without claiming they were updated', () => {
    const saved = {
      [Core.PREFS_KEY]: JSON.stringify({ v: 1, level: 'easy' }),
      [Core.BEST_KEY]: JSON.stringify({ v: 1, best: { easy: 50, normal: 60, hard: 70 } })
    };
    const page = boot({ denial: 'setItem', saved });
    expect(page.el('levelSel').value).toBe('easy');
    expect(page.el('best').textContent).toBe('50');
    fixture(page, [[0, 0, 0]]);
    pop(page);
    expectBoard(page, 0, 1001);
    expect(page.el('overlay').classList.contains('show')).toBe(true);
    page.el('levelSel').value = 'hard';
    page.el('levelSel').dispatchEvent(new page.win.Event('change'));
    expectBoard(page, 168, 0);
    expect(page.el('best').textContent).toBe('70');
    expect(page.win.localStorage.getItem(Core.PREFS_KEY)).toBe(saved[Core.PREFS_KEY]);
    expect(page.win.localStorage.getItem(Core.BEST_KEY)).toBe(saved[Core.BEST_KEY]);
    expect(page.errors).toEqual([]);
  });
});
