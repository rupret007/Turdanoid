import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CONTINUE_KEY,
  GUIDE_SEEN_KEY,
  LIVE_HUB_GAMES,
  TABLE_CONTINUE_GAMES,
  clearContinue,
  hasContinue,
  hasLiveContinue,
  hasSeenGuide,
  isLiveSnapshot,
  listLiveContinuePages,
  loadContinue,
  markGuideSeen,
  parseContinueStore,
  rememberContinue,
  validateEightsSnapshot,
  validateJackSnapshot,
  validateRummySnapshot,
  validateSnapshot,
  validateSpadesSnapshot
} from '../games/table-continue.js';
import {
  validEightsSnapshot,
  validJackSnapshot,
  validRummySnapshot,
  validSpadesSnapshot
} from './continue-fixtures.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
    get data() {
      return data;
    }
  };
}

describe('table continue store', () => {
  it('keeps the six-game door and four live table continues', () => {
    expect(LIVE_HUB_GAMES).toEqual([
      'TurdAnoid.html',
      'turdtris.html',
      'turdjack.html',
      'crapeights.html',
      'turdrummy.html',
      'turdspades.html'
    ]);
    expect(TABLE_CONTINUE_GAMES).toEqual([
      'turdjack.html',
      'crapeights.html',
      'turdrummy.html',
      'turdspades.html'
    ]);
    expect(CONTINUE_KEY).toBe('turdsuite_continue_v1');
    expect(GUIDE_SEEN_KEY).toBe('turdsuite_guides_seen_v1');
  });

  it('accepts honest table snapshots and rejects Neon, arcade, or a seventh game', () => {
    expect(validateSpadesSnapshot(validSpadesSnapshot())?.round).toBe(2);
    expect(validateRummySnapshot(validRummySnapshot())?.playerScore).toBe(45);
    expect(validateEightsSnapshot(validEightsSnapshot())?.roundNumber).toBe(2);
    expect(validateJackSnapshot(validJackSnapshot())?.currentBet).toBe(20);
    expect(validateSnapshot('neon-arkanoid.html', validSpadesSnapshot())).toBeNull();
    expect(validateSnapshot('hub.html', validSpadesSnapshot())).toBeNull();
    expect(validateSnapshot('TurdAnoid.html', validSpadesSnapshot())).toBeNull();
    expect(validateSnapshot('turdtris.html', validJackSnapshot())).toBeNull();
  });

  it('rejects XSS, prototype keys, short decks, and incomplete Crapjack shoes', () => {
    const dirty = validSpadesSnapshot();
    dirty.msg = 'Status <img src=x onerror=alert(1)>';
    expect(validateSpadesSnapshot(dirty)).toBeNull();

    const proto = validRummySnapshot();
    Object.defineProperty(proto, '__proto__', { value: { polluted: true }, enumerable: true });
    expect(validateRummySnapshot(proto)).toBeNull();

    const short = validEightsSnapshot();
    short.players.forEach((player) => {
      player.hand = [];
    });
    short.deck = [];
    short.discard = [];
    expect(validateEightsSnapshot(short)).toBeNull();

    const dup = validEightsSnapshot();
    dup.players[0].hand[0] = { ...dup.players[1].hand[0] };
    expect(validateEightsSnapshot(dup)).toBeNull();

    const thinJack = validJackSnapshot();
    thinJack.shoe = thinJack.shoe.slice(0, 10);
    expect(validateJackSnapshot(thinJack)).toBeNull();

    const quoteJack = validJackSnapshot();
    quoteJack.status = 'Nice <script>alert(1)</script>';
    expect(validateJackSnapshot(quoteJack)).toBeNull();

    const settled = validJackSnapshot();
    settled.roundActive = false;
    expect(validateJackSnapshot(settled)).toBeNull();
  });

  it('remembers only playable tables and hides finished matches from Continue', () => {
    const storage = memoryStorage();
    expect(rememberContinue(storage, 'turdspades.html', validSpadesSnapshot())).toBe(true);
    expect(rememberContinue(storage, 'turdjack.html', validJackSnapshot())).toBe(true);
    expect(hasContinue(storage, 'turdspades.html')).toBe(true);
    expect(hasLiveContinue(storage, 'turdjack.html')).toBe(true);
    expect(listLiveContinuePages(storage)).toEqual(['turdjack.html', 'turdspades.html']);
    expect(loadContinue(storage, 'turdjack.html')?.bankroll).toBe(980);
    expect(rememberContinue(storage, 'neon-arkanoid.html', validSpadesSnapshot())).toBe(false);
    expect(
      rememberContinue(storage, 'turdspades.html', { kind: 'turdspades', v: 1, msg: 'Safe status' })
    ).toBe(false);

    const finished = validSpadesSnapshot();
    finished.phase = 'matchEnd';
    expect(rememberContinue(storage, 'turdspades.html', finished)).toBe(true);
    expect(hasContinue(storage, 'turdspades.html')).toBe(true);
    expect(hasLiveContinue(storage, 'turdspades.html')).toBe(false);
    expect(isLiveSnapshot('turdspades.html', finished)).toBe(false);
    expect(listLiveContinuePages(storage)).toEqual(['turdjack.html']);

    expect(clearContinue(storage, 'turdjack.html')).toBe(true);
    expect(hasLiveContinue(storage, 'turdjack.html')).toBe(false);
  });

  it('ignores malformed continue JSON instead of inventing a table', () => {
    expect(parseContinueStore('not-json').games).toEqual({});
    expect(
      parseContinueStore(
        JSON.stringify({
          v: 1,
          games: {
            'not-a-game.html': { snapshot: validSpadesSnapshot() },
            'turdspades.html': { snapshot: { kind: 'turdspades', v: 1, msg: '<script>' } },
            'turdjack.html': { snapshot: { kind: 'turdjack', v: 1, roundActive: true } }
          }
        })
      ).games
    ).toEqual({});
  });

  it('ships continue hooks on the live table pages and keeps arcade mid-run parked', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const rummy = readFileSync(join(root, 'turdrummy.html'), 'utf8');
    const eights = readFileSync(join(root, 'crapeights.html'), 'utf8');
    const jack = readFileSync(join(root, 'turdjack.html'), 'utf8');
    const anoid = readFileSync(join(root, 'TurdAnoid.html'), 'utf8');
    const suite = readFileSync(join(root, 'assets/turdsuite.js'), 'utf8');
    const hub = readFileSync(join(root, 'index.html'), 'utf8');

    expect(rummy).toContain('function tryRestoreTable');
    expect(rummy).toContain('turdrummy_stats_v1');
    expect(rummy).toContain('JSON.stringify({\n          stats: state.stats\n        })');
    expect(rummy).toContain('<div class="overlay" id="guideOverlay">');
    expect(rummy).not.toContain('<div class="overlay show" id="guideOverlay">');
    expect(eights).toContain("Suite.table.remember('crapeights.html'");
    expect(jack).toContain("Suite.table.remember('turdjack.html'");
    expect(jack).toContain('function tryRestoreTable');
    expect(jack).toContain('if (roundActive) return;');
    expect(jack).not.toContain('historyText.innerHTML');
    expect(anoid).toContain('assets/turdsuite.js');
    expect(anoid).toContain('games/table-continue-core.js');
    expect(anoid).not.toContain('turdsuite.js" defer');
    expect(anoid).toContain('data-suite-no-bg="1"');
    expect(hub).toContain('games/table-continue-core.js');
    expect(suite).toContain(
      "const CONTINUE_KEY = (TableContinue && TableContinue.CONTINUE_KEY) || 'turdsuite_continue_v1'"
    );
    expect(suite).toContain('TurdSuiteTableContinue');
    expect(suite).not.toContain('neon-arkanoid.html');
  });

  it('tracks returning-player guides without accepting unknown pages', () => {
    const storage = memoryStorage();
    expect(hasSeenGuide(storage, 'turdjack.html')).toBe(false);
    expect(markGuideSeen(storage, 'turdjack.html')).toBe(true);
    expect(hasSeenGuide(storage, 'turdjack.html')).toBe(true);
    expect(markGuideSeen(storage, 'neon-arkanoid.html')).toBe(false);
    expect(hasSeenGuide(storage, 'neon-arkanoid.html')).toBe(false);
  });
});
