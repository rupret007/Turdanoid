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

function bootHub(lastGame, url = 'http://localhost/', extras = {}) {
  const dom = new JSDOM(hubHtml, {
    url,
    runScripts: 'outside-only'
  });
  if (lastGame !== undefined) {
    dom.window.localStorage.setItem('turdsuite_last_game', lastGame);
  }
  if (extras.continueStore !== undefined) {
    dom.window.localStorage.setItem('turdsuite_continue_v1', extras.continueStore);
  }
  if (extras.continueGames) {
    dom.window.localStorage.setItem(
      'turdsuite_continue_v1',
      JSON.stringify({ v: 1, games: extras.continueGames })
    );
  }
  dom.window.eval(suiteJs);
  if (dom.window.document.readyState === 'loading') {
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  }
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
    const slashed = bootHub('TurdAnoid.html', 'https://rupret007.github.io/Turdanoid/');
    expect(
      slashed.window.document.querySelector('.game-card.last-played')?.getAttribute('href')
    ).toBe('TurdAnoid.html');
    expect(slashed.window.document.querySelector('.suite-back-pill')).toBeNull();

    const bare = bootHub('turdspades.html', 'https://rupret007.github.io/Turdanoid');
    expect(bare.window.document.querySelector('.game-card.last-played')?.getAttribute('href')).toBe(
      'turdspades.html'
    );
    expect(bare.window.document.querySelector('.suite-back-pill')).toBeNull();
  });

  it('ignores malformed last-played data and Neon', () => {
    const junk = bootHub('not-a-game.html');
    expect(junk.window.document.querySelectorAll('.game-card')).toHaveLength(6);
    expect(junk.window.document.querySelectorAll('.game-card.last-played')).toHaveLength(0);

    const neon = bootHub('neon-arkanoid.html');
    expect(neon.window.document.querySelectorAll('.game-card.last-played')).toHaveLength(0);
  });
});

describe('six-game hub continue mark', () => {
  it('marks an in-progress table as Continue without adding a card', () => {
    const dom = bootHub('turdtris.html', 'http://localhost/', {
      continueGames: {
        'turdspades.html': {
          updatedAt: 1,
          snapshot: { kind: 'turdspades', v: 1, msg: 'Your play.' }
        }
      }
    });
    const cards = [...dom.window.document.querySelectorAll('.game-card')];
    const continuing = cards.filter((card) => card.classList.contains('in-progress'));
    const last = cards.filter((card) => card.classList.contains('last-played'));

    expect(cards).toHaveLength(6);
    expect(continuing).toHaveLength(1);
    expect(continuing[0].getAttribute('href')).toBe('turdspades.html');
    expect(continuing[0].querySelector('.play')?.textContent).toContain('Continue');
    expect(last).toHaveLength(1);
    expect(last[0].getAttribute('href')).toBe('turdtris.html');
    expect(last[0].querySelector('.play')?.textContent).toContain('Play again');
    expect(dom.window.document.querySelectorAll('a[href="neon-arkanoid.html"]')).toHaveLength(1);
  });

  it('prefers Continue when the last opened game still has a table', () => {
    const dom = bootHub('turdspades.html', 'http://localhost/', {
      continueGames: {
        'turdspades.html': {
          updatedAt: 1,
          snapshot: { kind: 'turdspades', v: 1, msg: 'Your play.' }
        }
      }
    });
    const card = dom.window.document.querySelector('.game-card.last-played');
    expect(card?.classList.contains('in-progress')).toBe(true);
    expect(card?.querySelector('.play')?.textContent).toContain('Continue');
  });

  it('ignores malformed continue data, script payloads, and Neon', () => {
    const junk = bootHub(undefined, 'http://localhost/', { continueStore: 'not-json' });
    expect(junk.window.document.querySelectorAll('.game-card.in-progress')).toHaveLength(0);

    const dirty = bootHub(undefined, 'http://localhost/', {
      continueGames: {
        'turdspades.html': {
          snapshot: { kind: 'turdspades', v: 1, msg: '<img src=x onerror=alert(1)>' }
        }
      }
    });
    expect(dirty.window.document.querySelectorAll('.game-card.in-progress')).toHaveLength(0);

    const neon = bootHub(undefined, 'http://localhost/', {
      continueGames: {
        'neon-arkanoid.html': {
          snapshot: { kind: 'turdspades', v: 1, msg: 'nope' }
        }
      }
    });
    expect(neon.window.document.querySelectorAll('.game-card.in-progress')).toHaveLength(0);
    expect(neon.window.document.querySelectorAll('.game-card')).toHaveLength(6);
  });

  it('refuses to remember Neon or a seventh game from the suite API', () => {
    const dom = bootHub();
    expect(
      dom.window.Suite.table.remember('neon-arkanoid.html', { kind: 'turdspades', v: 1 })
    ).toBe(false);
    expect(dom.window.Suite.table.remember('chicken.html', { kind: 'crapeights', v: 1 })).toBe(
      false
    );
    expect(
      dom.window.Suite.table.remember('turdspades.html', {
        kind: 'turdspades',
        v: 1,
        msg: 'Safe status'
      })
    ).toBe(true);
    expect(dom.window.Suite.table.has('turdspades.html')).toBe(true);
  });
});
