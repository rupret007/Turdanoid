/**
 * @vitest-environment node
 *
 * Save compatibility for TurdRummy (round 3). The snapshot below is the exact turdrummy.html entry
 * captured from commit b3821b4 (savecompat/b3821b4-saves.json), not a rebuilt fixture. It must still
 * restore through the live page with no card, score or message lost, and the stats key must keep its
 * stats envelope.
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
  'games/table-continue-core.js',
  'games/turdrummy-ai-core.js',
  'games/turdrummy-meld-core.js',
  'games/turdrummy-motion-core.js',
  'games/turdrummy-coach-core.js',
  'games/turdrummy-audio-core.js',
  'games/turdrummy-fx-core.js'
].map((file) => readFileSync(join(root, file), 'utf8'));
const sharedSuite = readFileSync(join(root, 'assets/turdsuite.js'), 'utf8');

// Exactly as written by commit b3821b4 (the turdrummy.html entry of turdsuite_continue_v1).
const B3821B4_CONTINUE_ENTRY = {
  updatedAt: 1791178508301,
  snapshot: {
    'kind': 'turdrummy',
    'v': 1,
    'round': 1,
    'dealer': 'player',
    'turn': 'player',
    'phase': 'draw',
    'playerScore': 0,
    'aiScore': 0,
    'stock': [
      {
        'id': 'D3-15',
        'suit': 'D',
        'rank': 3
      },
      {
        'id': 'S1-39',
        'suit': 'S',
        'rank': 1
      },
      {
        'id': 'S5-43',
        'suit': 'S',
        'rank': 5
      },
      {
        'id': 'C12-11',
        'suit': 'C',
        'rank': 12
      },
      {
        'id': 'D5-17',
        'suit': 'D',
        'rank': 5
      },
      {
        'id': 'D9-21',
        'suit': 'D',
        'rank': 9
      },
      {
        'id': 'D13-25',
        'suit': 'D',
        'rank': 13
      },
      {
        'id': 'H1-26',
        'suit': 'H',
        'rank': 1
      },
      {
        'id': 'S12-50',
        'suit': 'S',
        'rank': 12
      },
      {
        'id': 'H12-37',
        'suit': 'H',
        'rank': 12
      },
      {
        'id': 'C1-0',
        'suit': 'C',
        'rank': 1
      },
      {
        'id': 'C5-4',
        'suit': 'C',
        'rank': 5
      },
      {
        'id': 'S7-45',
        'suit': 'S',
        'rank': 7
      },
      {
        'id': 'C9-8',
        'suit': 'C',
        'rank': 9
      },
      {
        'id': 'D10-22',
        'suit': 'D',
        'rank': 10
      },
      {
        'id': 'H10-35',
        'suit': 'H',
        'rank': 10
      },
      {
        'id': 'D8-20',
        'suit': 'D',
        'rank': 8
      },
      {
        'id': 'C11-10',
        'suit': 'C',
        'rank': 11
      },
      {
        'id': 'H7-32',
        'suit': 'H',
        'rank': 7
      },
      {
        'id': 'C4-3',
        'suit': 'C',
        'rank': 4
      },
      {
        'id': 'D7-19',
        'suit': 'D',
        'rank': 7
      },
      {
        'id': 'H8-33',
        'suit': 'H',
        'rank': 8
      },
      {
        'id': 'S2-40',
        'suit': 'S',
        'rank': 2
      },
      {
        'id': 'C7-6',
        'suit': 'C',
        'rank': 7
      },
      {
        'id': 'C3-2',
        'suit': 'C',
        'rank': 3
      },
      {
        'id': 'D11-23',
        'suit': 'D',
        'rank': 11
      },
      {
        'id': 'C2-1',
        'suit': 'C',
        'rank': 2
      },
      {
        'id': 'S3-41',
        'suit': 'S',
        'rank': 3
      },
      {
        'id': 'H9-34',
        'suit': 'H',
        'rank': 9
      },
      {
        'id': 'H3-28',
        'suit': 'H',
        'rank': 3
      },
      {
        'id': 'S6-44',
        'suit': 'S',
        'rank': 6
      }
    ],
    'discard': [
      {
        'id': 'H13-38',
        'suit': 'H',
        'rank': 13
      }
    ],
    'playerHand': [
      {
        'id': 'C13-12',
        'suit': 'C',
        'rank': 13
      },
      {
        'id': 'D1-13',
        'suit': 'D',
        'rank': 1
      },
      {
        'id': 'D4-16',
        'suit': 'D',
        'rank': 4
      },
      {
        'id': 'D6-18',
        'suit': 'D',
        'rank': 6
      },
      {
        'id': 'D12-24',
        'suit': 'D',
        'rank': 12
      },
      {
        'id': 'H4-29',
        'suit': 'H',
        'rank': 4
      },
      {
        'id': 'H5-30',
        'suit': 'H',
        'rank': 5
      },
      {
        'id': 'H6-31',
        'suit': 'H',
        'rank': 6
      },
      {
        'id': 'H11-36',
        'suit': 'H',
        'rank': 11
      },
      {
        'id': 'S4-42',
        'suit': 'S',
        'rank': 4
      }
    ],
    'aiHand': [
      {
        'id': 'C6-5',
        'suit': 'C',
        'rank': 6
      },
      {
        'id': 'C8-7',
        'suit': 'C',
        'rank': 8
      },
      {
        'id': 'C10-9',
        'suit': 'C',
        'rank': 10
      },
      {
        'id': 'D2-14',
        'suit': 'D',
        'rank': 2
      },
      {
        'id': 'H2-27',
        'suit': 'H',
        'rank': 2
      },
      {
        'id': 'S8-46',
        'suit': 'S',
        'rank': 8
      },
      {
        'id': 'S9-47',
        'suit': 'S',
        'rank': 9
      },
      {
        'id': 'S10-48',
        'suit': 'S',
        'rank': 10
      },
      {
        'id': 'S11-49',
        'suit': 'S',
        'rank': 11
      },
      {
        'id': 'S13-51',
        'suit': 'S',
        'rank': 13
      }
    ],
    'selectedCardId': 'D6-18',
    'drawnCardId': null,
    'drawnCardSource': null,
    'playerSortMode': 'suit',
    'message': 'AI drew from discard, discarded K♥. Your draw.',
    'roundSummary': '',
    'lastAiAction': 'AI drew from discard, discarded K♥.',
    'roundOver': false,
    'matchOver': false,
    'initialized': true
  }
};

// Exactly as written by commit b3821b4 (turdrummy_stats_v1).
const B3821B4_STATS = '{"stats":{"roundsPlayed":0,"playerRoundWins":0,"aiRoundWins":0,"playerGins":0,"aiGins":0,"undercuts":0}}';

const openPages = [];

function bootWithSave(stored) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/turdrummy.html',
    beforeParse(window) {
      for (const src of coreSources) {window.eval(src);}
      for (const [key, value] of Object.entries(stored)) {window.localStorage.setItem(key, value);}
      window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      window.Element.prototype.getBoundingClientRect = function () {
        return { left: 10, top: 10, width: 50, height: 70, right: 60, bottom: 80, x: 10, y: 10 };
      };
      window.eval(sharedSuite);
    }
  });
  openPages.push(dom);
  return dom.window;
}

function savedEnvelope() {
  return JSON.stringify({ v: 1, games: { 'turdrummy.html': B3821B4_CONTINUE_ENTRY } });
}

afterEach(() => {
  openPages.splice(0).forEach((dom) => dom.window.close());
});

const idsOf = (cards) => cards.map((card) => card.id);

describe('b3821b4 save compatibility (turdrummy)', () => {
  it('restores the captured mid-round table with every card, score and the selected card intact', () => {
    const w = bootWithSave({ turdsuite_continue_v1: savedEnvelope(), turdrummy_stats_v1: B3821B4_STATS });
    const live = JSON.parse(w.eval(`JSON.stringify({
      round: state.round, turn: state.turn, phase: state.phase,
      playerScore: state.playerScore, aiScore: state.aiScore, selected: state.selectedCardId,
      message: state.message, initialized: state.initialized,
      stock: state.stock.map((c) => c.id), discard: state.discard.map((c) => c.id),
      playerHand: state.playerHand.map((c) => c.id), aiHand: state.aiHand.map((c) => c.id)
    })`));
    const saved = B3821B4_CONTINUE_ENTRY.snapshot;
    expect(live.initialized).toBe(true);
    expect(live.round).toBe(saved.round);
    expect(live.turn).toBe(saved.turn);
    expect(live.phase).toBe(saved.phase);
    expect(live.playerScore).toBe(saved.playerScore);
    expect(live.aiScore).toBe(saved.aiScore);
    expect(live.selected).toBe(saved.selectedCardId);
    expect(live.message).toBe(saved.message);
    expect(live.stock).toEqual(idsOf(saved.stock));
    expect(live.discard).toEqual(idsOf(saved.discard));
    expect(live.playerHand).toEqual(idsOf(saved.playerHand));
    expect(live.aiHand).toEqual(idsOf(saved.aiHand));
    // No data loss: all 52 cards are still accounted for, exactly once.
    const all = [...live.stock, ...live.discard, ...live.playerHand, ...live.aiHand];
    expect(all).toHaveLength(52);
    expect(new Set(all).size).toBe(52);
  });

  it('does not show the welcome guide over a restored table', () => {
    const w = bootWithSave({ turdsuite_continue_v1: savedEnvelope(), turdrummy_stats_v1: B3821B4_STATS });
    expect(w.document.getElementById('guideOverlay').classList.contains('show')).toBe(false);
    expect(w.document.querySelectorAll('#playerHand [data-hand-id]')).toHaveLength(10);
  });

  it('writes the continue snapshot back in the same b3821b4 shape, with the same cards', () => {
    const w = bootWithSave({ turdsuite_continue_v1: savedEnvelope(), turdrummy_stats_v1: B3821B4_STATS });
    const envelope = JSON.parse(w.localStorage.getItem('turdsuite_continue_v1'));
    expect(envelope.v).toBe(1);
    const again = envelope.games['turdrummy.html'].snapshot;
    const saved = B3821B4_CONTINUE_ENTRY.snapshot;
    expect(Object.keys(again).sort()).toEqual(Object.keys(saved).sort());
    expect(idsOf(again.stock)).toEqual(idsOf(saved.stock));
    expect(idsOf(again.playerHand)).toEqual(idsOf(saved.playerHand));
    expect(idsOf(again.aiHand)).toEqual(idsOf(saved.aiHand));
    expect(again.selectedCardId).toBe(saved.selectedCardId);
    expect(again.message).toBe(saved.message);
  });

  it('keeps the turdrummy_stats_v1 key and its stats envelope through a round end', () => {
    const w = bootWithSave({ turdsuite_continue_v1: savedEnvelope(), turdrummy_stats_v1: B3821B4_STATS });
    w.eval("finishRound('player', true, 0, [])");
    const stats = JSON.parse(w.localStorage.getItem('turdrummy_stats_v1'));
    expect(Object.keys(stats)).toEqual(['stats']);
    expect(Object.keys(stats.stats).sort()).toEqual(
      ['aiGins', 'aiRoundWins', 'playerGins', 'playerRoundWins', 'roundsPlayed', 'undercuts']
    );
    expect(stats.stats.roundsPlayed).toBe(1);
  });

  it('leaves the other suite keys alone when the Rummy table saves', () => {
    const w = bootWithSave({
      turdsuite_continue_v1: savedEnvelope(),
      turdrummy_stats_v1: B3821B4_STATS,
      turdsuite_last_game: 'turdspades.html',
      turdtrisHighScore: '44'
    });
    w.eval('renderAll()');
    expect(w.localStorage.getItem('turdsuite_last_game')).toBe('turdspades.html');
    expect(w.localStorage.getItem('turdtrisHighScore')).toBe('44');
  });
});
