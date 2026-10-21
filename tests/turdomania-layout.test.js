// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

import { inlineTurdomaniaImports, installTurdomaniaModules } from './turdomania-page-harness.js';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'turdomania.html'), 'utf8');
const pages = [];

afterEach(() => {
  for (const page of pages.splice(0)) {
    page.window.close();
  }
});

function boot(width, height) {
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: 'http://localhost/turdomania.html?level=normal&seed=42'
  });
  pages.push(dom);
  const { window } = dom;
  const { document } = window;
  window.innerWidth = width;
  window.innerHeight = height;
  Object.defineProperty(document.documentElement, 'clientWidth', { get: () => window.innerWidth });
  Object.defineProperty(document.documentElement, 'clientHeight', { get: () => window.innerHeight });
  installTurdomaniaModules(window);
  window.matchMedia = () => ({ matches: false });
  let frame;
  window.requestAnimationFrame = (callback) => { frame = callback; return 1; };
  window.cancelAnimationFrame = () => { frame = null; };
  const scripts = document.querySelectorAll('script:not([src])');
  window.eval(scripts[0].textContent);
  return {
    document,
    cell: () => Number.parseInt(document.documentElement.style.getPropertyValue('--cell'), 10),
    start: () => window.eval(inlineTurdomaniaImports(scripts[1].textContent)),
    resize(w, h) {
      window.innerWidth = w;
      window.innerHeight = h;
      window.dispatchEvent(new window.Event('resize'));
      expect(frame).toBeTypeOf('function');
      frame(0);
    }
  };
}

describe('Turdomania playable cell sizes', () => {
  it.each([[120, 120], [240, 200], [320, 180]])(
    'keeps cells at least 22px before paint and at startup in a %ix%i viewport',
    (width, height) => {
      const page = boot(width, height);
      expect(page.cell()).toBe(22);
      page.start();
      expect(page.cell()).toBe(22);
      expect(page.document.querySelectorAll('#board .tile').length).toBeGreaterThan(0);
    }
  );

  it('preserves the board and the 22–56px range through resizing and rotation', () => {
    const page = boot(1440, 1200);
    expect(page.cell()).toBe(56);
    page.start();
    expect(page.cell()).toBe(56);
    const tiles = Array.from(page.document.querySelectorAll('#board .tile'), (tile) => tile.id);
    const board = page.document.getElementById('board');
    for (const [width, height, expected] of [[320, 180, 22], [390, 844, 35], [844, 390, 30], [1440, 1200, 56]]) {
      page.resize(width, height);
      expect(page.cell()).toBe(expected);
      expect(Array.from(board.querySelectorAll('.tile'), (tile) => tile.id)).toEqual(tiles);
      expect(page.document.getElementById('score').textContent).toBe('0');
      expect(page.document.documentElement.style.getPropertyValue('--board-w')).toBe(`${expected * 10}px`);
      expect(page.document.documentElement.style.getPropertyValue('--board-h')).toBe(`${expected * 12}px`);
    }
  });
});
