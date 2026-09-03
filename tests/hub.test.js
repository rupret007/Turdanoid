import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hubHtml = readFileSync(join(root, 'index.html'), 'utf8');
const suiteJs = readFileSync(join(root, 'assets/turdsuite.js'), 'utf8');

const LIVE_GAMES = [
  'TurdAnoid.html',
  'turdtris.html',
  'turdjack.html',
  'crapeights.html',
  'turdrummy.html',
  'turdspades.html'
];

function bootHub(lastGame, url = 'http://localhost/') {
  const dom = new JSDOM(hubHtml, {
    url,
    runScripts: 'outside-only',
    beforeParse(window) {
      if (lastGame !== undefined) {
        window.localStorage.setItem('turdsuite_last_game', lastGame);
      }
    }
  });
  dom.window.eval(suiteJs);
  return dom;
}

describe('six-game hub last-played mark', () => {
  it('keeps the root door as six live games plus one Neon link', () => {
    expect(hubHtml.match(/class="game-card"/g)).toHaveLength(6);
    for (const href of LIVE_GAMES) {
      expect(hubHtml).toContain(`href="${href}"`);
    }
    expect(hubHtml).toContain('href="neon-arkanoid.html"');
    expect(hubHtml).toContain('bid tricks or Nil');
    expect(suiteJs).toContain(`const LIVE_HUB_GAMES = ['${LIVE_GAMES.join("', '")}']`);
    expect(suiteJs).not.toContain('neon-arkanoid.html');
  });

  it('marks the last opened live game without adding a seventh card', () => {
    const dom = bootHub('turdspades.html');
    const cards = [...dom.window.document.querySelectorAll('.game-card')];
    const marked = cards.filter((card) => card.classList.contains('last-played'));

    expect(cards).toHaveLength(6);
    expect(marked).toHaveLength(1);
    expect(marked[0].getAttribute('href')).toBe('turdspades.html');
    expect(marked[0].querySelector('.play')?.textContent).toContain('Play again');
    expect(dom.window.document.querySelectorAll('a[href="neon-arkanoid.html"]')).toHaveLength(1);
  });

  it('marks last-played on the GitHub Pages hub path', () => {
    const dom = bootHub('TurdAnoid.html', 'https://rupret007.github.io/Turdanoid/');
    expect(dom.window.document.querySelector('.game-card.last-played')?.getAttribute('href')).toBe(
      'TurdAnoid.html'
    );
  });

  it('ignores malformed last-played data and Neon', () => {
    const junk = bootHub('not-a-game.html');
    expect(junk.window.document.querySelectorAll('.game-card')).toHaveLength(6);
    expect(junk.window.document.querySelectorAll('.game-card.last-played')).toHaveLength(0);

    const neon = bootHub('neon-arkanoid.html');
    expect(neon.window.document.querySelectorAll('.game-card.last-played')).toHaveLength(0);
  });
});
