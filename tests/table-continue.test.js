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
  hasSeenGuide,
  listContinuePages,
  loadContinue,
  markGuideSeen,
  parseContinueStore,
  rememberContinue,
  validateEightsSnapshot,
  validateRummySnapshot,
  validateSnapshot,
  validateSpadesSnapshot
} from '../games/table-continue.js';

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

function spadeDeck() {
  const cards = [];
  let id = 0;
  for (const suit of ['C', 'D', 'H', 'S']) {
    for (let rank = 2; rank <= 14; rank += 1) {
      cards.push({ id: `${suit}${rank}-${id}`, suit, rank });
      id += 1;
    }
  }
  return cards;
}

function rummyDeck() {
  const cards = [];
  let id = 0;
  for (const suit of ['C', 'D', 'H', 'S']) {
    for (let rank = 1; rank <= 13; rank += 1) {
      cards.push({ id: `${suit}${rank}-${id}`, suit, rank });
      id += 1;
    }
  }
  return cards;
}

function eightsDeck() {
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const cards = [];
  let id = 1;
  for (const suit of ['C', 'D', 'H', 'S']) {
    for (const rank of ranks) {
      cards.push({ id, suit, rank });
      id += 1;
    }
  }
  return cards;
}

function validSpadesSnapshot() {
  const deck = spadeDeck();
  return {
    kind: 'turdspades',
    v: 1,
    round: 2,
    dealer: 0,
    leader: 1,
    currentPlayer: 0,
    bidTurn: 0,
    phase: 'play',
    scores: [40, 12],
    bags: [3, 1],
    bids: [4, 3, 4, 3],
    tricks: [1, 0, 0, 0],
    hands: [deck.slice(0, 12), deck.slice(12, 25), deck.slice(25, 38), deck.slice(38, 51)],
    trick: [{ player: 1, card: deck[51] }],
    spadesBroken: true,
    selected: deck[0].id,
    bidChoice: 4,
    sortMode: 'suit',
    msg: 'Your play.',
    summary: 'Race to 250.',
    lastRoundTone: 'neutral'
  };
}

function validRummySnapshot() {
  const deck = rummyDeck();
  return {
    kind: 'turdrummy',
    v: 1,
    round: 3,
    dealer: 'player',
    turn: 'player',
    phase: 'draw',
    playerScore: 45,
    aiScore: 20,
    playerHand: deck.slice(0, 10),
    aiHand: deck.slice(10, 20),
    discard: deck.slice(20, 21),
    stock: deck.slice(21),
    selectedCardId: null,
    drawnCardId: null,
    drawnCardSource: null,
    playerSortMode: 'suit',
    message: 'Your draw.',
    roundSummary: '',
    lastAiAction: '',
    roundOver: false,
    matchOver: false,
    initialized: true
  };
}

function validEightsSnapshot() {
  const deck = eightsDeck();
  return {
    kind: 'crapeights',
    v: 1,
    players: [
      { name: 'You', human: true, score: 40, hand: deck.slice(0, 7) },
      { name: 'Casey', human: false, score: 12, hand: deck.slice(7, 14) },
      { name: 'Jordan', human: false, score: 0, hand: deck.slice(14, 21) },
      { name: 'Riley', human: false, score: 8, hand: deck.slice(21, 28) }
    ],
    deck: deck.slice(29),
    discard: deck.slice(28, 29),
    roundNumber: 2,
    currentPlayer: 0,
    direction: 1,
    activeSuit: 'C',
    pendingDrawCards: 0,
    pendingSkips: 0,
    roundActive: true,
    hasDrawnThisTurn: false,
    selectedCardId: deck[0].id,
    pendingWildCard: null,
    historyLog: ['10:01 Round 2 started.'],
    nextCardId: 53,
    overlay: null
  };
}

describe('table continue store', () => {
  it('keeps the six-game door and only three table continues', () => {
    expect(LIVE_HUB_GAMES).toEqual([
      'TurdAnoid.html',
      'turdtris.html',
      'turdjack.html',
      'crapeights.html',
      'turdrummy.html',
      'turdspades.html'
    ]);
    expect(TABLE_CONTINUE_GAMES).toEqual(['crapeights.html', 'turdrummy.html', 'turdspades.html']);
    expect(CONTINUE_KEY).toBe('turdsuite_continue_v1');
    expect(GUIDE_SEEN_KEY).toBe('turdsuite_guides_seen_v1');
  });

  it('accepts honest table snapshots and rejects Neon or a seventh game', () => {
    expect(validateSpadesSnapshot(validSpadesSnapshot())?.round).toBe(2);
    expect(validateRummySnapshot(validRummySnapshot())?.playerScore).toBe(45);
    expect(validateEightsSnapshot(validEightsSnapshot())?.roundNumber).toBe(2);
    expect(validateSnapshot('neon-arkanoid.html', validSpadesSnapshot())).toBeNull();
    expect(validateSnapshot('hub.html', validSpadesSnapshot())).toBeNull();
    expect(validateSnapshot('TurdAnoid.html', validSpadesSnapshot())).toBeNull();
  });

  it('rejects XSS, prototype keys, and short decks', () => {
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
  });

  it('remembers, lists, and clears only the matching live table', () => {
    const storage = memoryStorage();
    expect(rememberContinue(storage, 'turdspades.html', validSpadesSnapshot())).toBe(true);
    expect(hasContinue(storage, 'turdspades.html')).toBe(true);
    expect(listContinuePages(storage)).toEqual(['turdspades.html']);
    expect(loadContinue(storage, 'turdspades.html')?.scores).toEqual([40, 12]);
    expect(rememberContinue(storage, 'neon-arkanoid.html', validSpadesSnapshot())).toBe(false);
    expect(clearContinue(storage, 'turdspades.html')).toBe(true);
    expect(hasContinue(storage, 'turdspades.html')).toBe(false);
  });

  it('ignores malformed continue JSON instead of inventing a table', () => {
    expect(parseContinueStore('not-json').games).toEqual({});
    expect(
      parseContinueStore(
        JSON.stringify({
          v: 1,
          games: {
            'not-a-game.html': { snapshot: validSpadesSnapshot() },
            'turdspades.html': { snapshot: { kind: 'turdspades', v: 1, msg: '<script>' } }
          }
        })
      ).games
    ).toEqual({});
  });

  it('ships continue hooks on the live table pages and keeps TurdAnoid on the suite runtime', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const rummy = readFileSync(join(root, 'turdrummy.html'), 'utf8');
    const eights = readFileSync(join(root, 'crapeights.html'), 'utf8');
    const anoid = readFileSync(join(root, 'TurdAnoid.html'), 'utf8');
    const suite = readFileSync(join(root, 'assets/turdsuite.js'), 'utf8');

    expect(rummy).toContain('function tryRestoreTable');
    expect(rummy).toContain('turdrummy_stats_v1');
    expect(rummy).toContain('JSON.stringify({\n          stats: state.stats\n        })');
    expect(rummy).toContain('<div class="overlay" id="guideOverlay">');
    expect(rummy).not.toContain('<div class="overlay show" id="guideOverlay">');
    expect(rummy).toContain('el.guideOverlay.classList.remove("show")');
    expect(eights).toContain("Suite.table.remember('crapeights.html'");
    expect(anoid).toContain('assets/turdsuite.js');
    expect(anoid).not.toContain('turdsuite.js" defer');
    expect(anoid).toContain('data-suite-no-bg="1"');
    expect(suite).toContain("const CONTINUE_KEY = 'turdsuite_continue_v1'");
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
