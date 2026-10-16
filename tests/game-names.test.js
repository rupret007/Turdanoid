import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readPage(file) {
  return new JSDOM(readFileSync(join(root, file), 'utf8'));
}

describe.each([
  ['TurdAnoid.html', 'TurdAnoid', '#titleScreen h1'],
  ['turdtris.html', 'Turdtris', '.topbar h1']
])('%s marketing name', (file, name, headingSelector) => {
  it('uses the same name on the hub card and game heading', () => {
    const hub = readPage('index.html');
    const game = readPage(file);
    try {
      const cardHeading = hub.window.document.querySelector(`.game-card[href="${file}"] h2`);
      const gameHeading = game.window.document.querySelector(headingSelector);
      expect(cardHeading?.textContent.trim()).toBe(name);
      expect(gameHeading?.textContent.trim()).toBe(name);
      // Native heading text must also supply the name to assistive technology.
      for (const heading of [cardHeading, gameHeading]) {
        expect(heading.hasAttribute('aria-label')).toBe(false);
        expect(heading.hasAttribute('aria-labelledby')).toBe(false);
        expect(heading.closest('[aria-hidden="true"]')).toBeNull();
      }
    } finally {
      hub.window.close();
      game.window.close();
    }
  });

  it('keeps the browser title consistent with the marketing name', () => {
    const game = readPage(file);
    try {
      expect(game.window.document.title.split(' — ')[0]).toBe(name);
    } finally {
      game.window.close();
    }
  });
});

it('gives the Turdtris welcome heading the same name as the visible logo', () => {
  const game = readPage('turdtris.html');
  try {
    const document = game.window.document;
    const logo = document.querySelector('#welcomeGuide .attract-logo');
    const heading = document.querySelector('#welcomeGuide h2');
    expect(logo?.textContent.trim()).toBe('Turdtris');
    expect(heading?.textContent.trim()).toBe(logo.textContent.trim());
    expect(logo.getAttribute('aria-hidden')).toBe('true');
    expect(heading.closest('[aria-hidden="true"]')).toBeNull();
    expect(heading.hasAttribute('hidden')).toBe(false);
    expect(heading.hasAttribute('aria-label')).toBe(false);
    expect(heading.hasAttribute('aria-labelledby')).toBe(false);
  } finally {
    game.window.close();
  }
});
