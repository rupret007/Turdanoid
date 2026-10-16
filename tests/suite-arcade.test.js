import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

import {
  ARCADE_KEY,
  buildShareText,
  clearProgress,
  getLeaderboard,
  insertLeaderboard,
  listProgressPages,
  loadProgress,
  parseArcadeStore,
  recordEnd,
  recordLeaderboard,
  saveProgress,
  shareScore
} from '../games/suite-arcade.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hubHtml = readFileSync(join(root, 'index.html'), 'utf8');
const suiteJs = readFileSync(join(root, 'assets/turdsuite.js'), 'utf8');
const arcadeCore = readFileSync(join(root, 'games/suite-arcade-core.js'), 'utf8');

const LIVE_PAGES = [
  'TurdAnoid.html',
  'turdtris.html',
  'turdjack.html',
  'crapeights.html',
  'turdrummy.html',
  'turdspades.html',
  'turdomania.html'
];

function memoryStorage(seed = {}) {
  const data = { ...seed };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    }
  };
}

describe('suite-arcade storage', () => {
  it('parses corrupt JSON as an empty store', () => {
    expect(parseArcadeStore('{{')).toEqual({ v: 1, games: {} });
    expect(parseArcadeStore(JSON.stringify({ v: 2, games: {} }))).toEqual({ v: 1, games: {} });
  });

  it('rejects prototype-pollution keys in stored JSON', () => {
    const dirty =
      '{"v":1,"games":{"turdtris.html":{"progress":{"v":1,"bucket":"classic","score":10,"level":2,"__proto__":{"hacked":1}}}}}';
    expect(parseArcadeStore(dirty).games).toEqual({});
  });

  it('keeps top ten high scores per bucket', () => {
    const storage = memoryStorage();
    for (let i = 1; i <= 12; i++) {
      recordLeaderboard(storage, 'turdtris.html', { bucket: 'classic', value: i * 10, rank: 'high' });
    }
    const board = getLeaderboard(storage, 'turdtris.html', 'classic');
    expect(board).toHaveLength(10);
    expect(board[0].value).toBe(120);
    expect(board[9].value).toBe(30);
  });

  it('orders sprint times low-to-high', () => {
    const list = insertLeaderboard([], { value: 90000, at: 1 }, 'low');
    const next = insertLeaderboard(list, { value: 80000, at: 2 }, 'low');
    expect(next[0].value).toBe(80000);
    expect(next[1].value).toBe(90000);
  });

  it('saves and clears mid-run progress without touching leaderboards', () => {
    const storage = memoryStorage();
    recordLeaderboard(storage, 'TurdAnoid.html', { bucket: 'classic', value: 500, rank: 'high' });
    expect(saveProgress(storage, 'TurdAnoid.html', { bucket: 'classic', score: 120, level: 4 })).toBe(true);
    expect(loadProgress(storage, 'TurdAnoid.html')?.level).toBe(4);
    expect(listProgressPages(storage)).toEqual(['TurdAnoid.html']);
    expect(clearProgress(storage, 'TurdAnoid.html')).toBe(true);
    expect(loadProgress(storage, 'TurdAnoid.html')).toBeNull();
    expect(getLeaderboard(storage, 'TurdAnoid.html', 'classic')[0].value).toBe(500);
  });

  it('recordEnd writes a score and clears progress', () => {
    const storage = memoryStorage();
    saveProgress(storage, 'turdomania.html', { bucket: 'hard', score: 40, level: 1 });
    recordEnd(storage, 'turdomania.html', { bucket: 'hard', value: 900, rank: 'high' });
    expect(loadProgress(storage, 'turdomania.html')).toBeNull();
    expect(getLeaderboard(storage, 'turdomania.html', 'hard')[0].value).toBe(900);
  });
});

describe('suite-arcade share', () => {
  it('builds share text with score and stalemate link only', () => {
    const text = buildShareText({
      page: 'turdtris.html',
      scoreLine: '12,400 pts'
    });
    expect(text).toContain('Turdtris: 12,400 pts');
    expect(text).toContain('https://stalemate.band/play/turdtris');
    expect(text).not.toMatch(/email|password|@/i);
  });

  it('falls back to clipboard when navigator.share is missing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const toast = vi.fn();
    const result = await shareScore(
      { page: 'TurdAnoid.html', scoreLine: '900 pts' },
      { navigator: {}, clipboard: { writeText }, toast }
    );
    expect(result.method).toBe('copy');
    expect(writeText).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Score link copied');
  });

  it('uses navigator.share when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const result = await shareScore(
      { page: 'crapeights.html', scoreLine: '200 pts' },
      { navigator: { share }, clipboard: null, toast: vi.fn() }
    );
    expect(result.method).toBe('share');
    expect(share).toHaveBeenCalled();
  });
});

describe('suite-arcade hub wiring', () => {
  it('exposes Suite.arcade on the suite runtime', () => {
    expect(suiteJs).toContain('Suite.arcade');
    expect(suiteJs).toContain('TurdSuiteArcade');
    expect(arcadeCore).toContain(ARCADE_KEY);
  });

  it('loads arcade core on the hub door', () => {
    expect(hubHtml).toContain('games/suite-arcade-core.js');
  });
});

describe('suite-arcade per-game wiring', () => {
  for (const page of LIVE_PAGES) {
    it(`wires ${page} to the shared arcade module`, () => {
      const html = readFileSync(join(root, page), 'utf8');
      expect(html).toContain('games/suite-arcade-core.js');
      expect(html).toContain('games/suite-arcade-bridge.js');
      expect(html).toMatch(/TurdSuiteArcadeBridge|Suite\.arcade/);
    });
  }

  it('does not wire hidden Neon Arkanoid', () => {
    const neon = readFileSync(join(root, 'neon-arkanoid.html'), 'utf8');
    expect(neon).not.toContain('games/suite-arcade-core.js');
  });
});

describe('suite-arcade facade with storage failures', () => {
  it('returns safe defaults when localStorage throws', () => {
    const dom = new JSDOM(hubHtml, { url: 'http://localhost/turdtris.html', runScripts: 'outside-only' });
    dom.window.__SUITE_SKIP_MODULES = true;
    dom.window.eval(readFileSync(join(root, 'games/table-continue-core.js'), 'utf8'));
    dom.window.eval(arcadeCore);
    dom.window.eval(suiteJs);
    Object.defineProperty(dom.window, 'localStorage', {
      configurable: true,
      get() {
        throw new dom.window.DOMException('denied', 'SecurityError');
      }
    });
    const { Suite } = dom.window;
    expect(Suite.arcade.getLeaderboard('turdtris.html', 'classic')).toEqual([]);
    expect(Suite.arcade.loadRun('turdtris.html')).toBeNull();
    expect(Suite.arcade.listRuns()).toEqual([]);
    expect(Suite.arcade.saveRun('turdtris.html', { score: 1, level: 1 })).toBe(false);
  });
});
