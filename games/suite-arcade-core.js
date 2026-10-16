/* Shared local leaderboards, mid-run progress, and share helpers for the seven-game hub.
   Classic script: attaches TurdSuiteArcade on globalThis.
   Tests import games/suite-arcade.js, which re-exports this API. */
(function attachSuiteArcade(root) {
  'use strict';

  const ARCADE_KEY = 'turdsuite_arcade_v1';
  const ARCADE_VERSION = 1;
  const LEADERBOARD_CAP = 10;
  const SHARE_PLAY_BASE = 'https://stalemate.band/play/';
  const PROGRESS_MAX_BYTES = 24 * 1024;

  const LIVE_ARCADE_PAGES = [
    'TurdAnoid.html',
    'turdtris.html',
    'turdjack.html',
    'crapeights.html',
    'turdrummy.html',
    'turdspades.html',
    'turdomania.html'
  ];

  const PAGE_SLUG = {
    'TurdAnoid.html': 'turdanoid',
    'turdtris.html': 'turdtris',
    'turdjack.html': 'crapjack',
    'crapeights.html': 'crapeights',
    'turdrummy.html': 'turdrummy',
    'turdspades.html': 'turdspades',
    'turdomania.html': 'turdomania'
  };

  const PAGE_TITLE = {
    'TurdAnoid.html': 'Turdanoid',
    'turdtris.html': 'Turdtris',
    'turdjack.html': 'Crapjack 21',
    'crapeights.html': 'Crappy Eights',
    'turdrummy.html': 'TurdRummy',
    'turdspades.html': 'TurdSpades',
    'turdomania.html': 'Turdomania'
  };

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function hasDangerousKey(value) {
    return (
      Object.prototype.hasOwnProperty.call(value, '__proto__') ||
      Object.prototype.hasOwnProperty.call(value, 'constructor') ||
      Object.prototype.hasOwnProperty.call(value, 'prototype')
    );
  }

  function finiteInt(value, min, max) {
    if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value)) {
      return null;
    }
    if (value < min || value > max) {
      return null;
    }
    return value;
  }

  function cleanBucket(raw) {
    if (typeof raw !== 'string') {
      return 'default';
    }
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed || trimmed.length > 32 || /[<>]/.test(trimmed)) {
      return 'default';
    }
    return trimmed;
  }

  function emptyStore() {
    return { v: ARCADE_VERSION, games: {} };
  }

  function parseArcadeStore(raw) {
    if (raw === null || raw === undefined || raw === '') {
      return emptyStore();
    }
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!isPlainObject(parsed) || hasDangerousKey(parsed)) {
        return emptyStore();
      }
      if (parsed.v !== ARCADE_VERSION || !isPlainObject(parsed.games) || hasDangerousKey(parsed.games)) {
        return emptyStore();
      }
      const games = {};
      for (const page of Object.keys(parsed.games)) {
        if (!LIVE_ARCADE_PAGES.includes(page)) {
          continue;
        }
        const entry = parsed.games[page];
        if (!isPlainObject(entry) || hasDangerousKey(entry)) {
          continue;
        }
        const clean = {};
        if (isPlainObject(entry.progress) && !hasDangerousKey(entry.progress)) {
          const progress = sanitizeProgress(entry.progress);
          if (progress) {
            clean.progress = progress;
          }
        }
        if (isPlainObject(entry.boards) && !hasDangerousKey(entry.boards)) {
          const boards = {};
          for (const bucket of Object.keys(entry.boards)) {
            const list = sanitizeLeaderboard(entry.boards[bucket]);
            if (list.length) {
              boards[cleanBucket(bucket)] = list;
            }
          }
          if (Object.keys(boards).length) {
            clean.boards = boards;
          }
        }
        if (clean.progress || clean.boards) {
          games[page] = clean;
        }
      }
      return { v: ARCADE_VERSION, games };
    } catch (e) {
      return emptyStore();
    }
  }

  function sanitizeProgress(raw) {
    if (!isPlainObject(raw) || hasDangerousKey(raw) || raw.v !== 1) {
      return null;
    }
    if (raw.data !== undefined && raw.data !== null && (typeof raw.data !== 'object' || hasDangerousKey(raw.data))) {
      return null;
    }
    const bucket = cleanBucket(raw.bucket);
    const score = finiteInt(raw.score, 0, 999999999);
    const level = finiteInt(raw.level, 0, 99999);
    const savedAt = finiteInt(raw.savedAt, 0, 4102444800000);
    let data = null;
    if (raw.data !== undefined && raw.data !== null) {
      try {
        const serialized = JSON.stringify(raw.data);
        if (serialized.length > PROGRESS_MAX_BYTES) {
          return null;
        }
        data = JSON.parse(serialized);
      } catch (e) {
        return null;
      }
    }
    if (score === null && level === null && data === null) {
      return null;
    }
    return {
      v: 1,
      bucket,
      score: score === null ? 0 : score,
      level: level === null ? 0 : level,
      savedAt: savedAt === null ? Date.now() : savedAt,
      data
    };
  }

  function sanitizeLeaderboard(raw) {
    if (!Array.isArray(raw)) {
      return [];
    }
    const out = [];
    for (let i = 0; i < raw.length && out.length < LEADERBOARD_CAP; i++) {
      const row = raw[i];
      if (!isPlainObject(row) || hasDangerousKey(row)) {
        continue;
      }
      const value = finiteInt(row.value, -999999999, 999999999);
      const at = finiteInt(row.at, 0, 4102444800000);
      const rank = row.rank === 'low' ? 'low' : 'high';
      if (value === null) {
        continue;
      }
      out.push({ value, at: at === null ? 0 : at, rank });
    }
    return out;
  }

  function readStore(storage) {
    try {
      if (!storage || typeof storage.getItem !== 'function') {
        return emptyStore();
      }
      return parseArcadeStore(storage.getItem(ARCADE_KEY));
    } catch (e) {
      return emptyStore();
    }
  }

  function writeStore(storage, store) {
    try {
      if (!storage || typeof storage.setItem !== 'function') {
        return false;
      }
      const payload = JSON.stringify(store);
      if (payload.length > 128 * 1024) {
        return false;
      }
      storage.setItem(ARCADE_KEY, payload);
      return true;
    } catch (e) {
      return false;
    }
  }

  function ensureGame(store, page) {
    if (!store.games[page]) {
      store.games[page] = {};
    }
    return store.games[page];
  }

  function compareEntries(a, b, rank) {
    if (rank === 'low') {
      if (a.value !== b.value) {
        return a.value - b.value;
      }
      return (a.at || 0) - (b.at || 0);
    }
    if (a.value !== b.value) {
      return b.value - a.value;
    }
    return (a.at || 0) - (b.at || 0);
  }

  function insertLeaderboard(list, entry, rank) {
    const next = sanitizeLeaderboard(list).concat([
      { value: entry.value, at: entry.at || Date.now(), rank: rank === 'low' ? 'low' : 'high' }
    ]);
    next.sort((a, b) => compareEntries(a, b, rank === 'low' ? 'low' : 'high'));
    const seen = new Set();
    const deduped = [];
    for (let i = 0; i < next.length; i++) {
      const key = next[i].value + ':' + next[i].rank;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(next[i]);
      if (deduped.length >= LEADERBOARD_CAP) {
        break;
      }
    }
    return deduped;
  }

  function recordLeaderboard(storage, page, options) {
    if (!LIVE_ARCADE_PAGES.includes(page)) {
      return false;
    }
    const value = finiteInt(options && options.value, -999999999, 999999999);
    if (value === null) {
      return false;
    }
    const bucket = cleanBucket(options && options.bucket);
    const rank = options && options.rank === 'low' ? 'low' : 'high';
    const store = readStore(storage);
    const game = ensureGame(store, page);
    if (!game.boards) {
      game.boards = {};
    }
    game.boards[bucket] = insertLeaderboard(game.boards[bucket] || [], { value, at: Date.now() }, rank);
    return writeStore(storage, store);
  }

  function getLeaderboard(storage, page, bucket) {
    if (!LIVE_ARCADE_PAGES.includes(page)) {
      return [];
    }
    const store = readStore(storage);
    const game = store.games[page];
    if (!game || !game.boards) {
      return [];
    }
    const key = cleanBucket(bucket);
    return sanitizeLeaderboard(game.boards[key] || []);
  }

  function saveProgress(storage, page, snapshot) {
    if (!LIVE_ARCADE_PAGES.includes(page)) {
      return false;
    }
    const progress = sanitizeProgress(
      Object.assign({}, snapshot || {}, {
        v: 1,
        savedAt: Date.now()
      })
    );
    if (!progress) {
      return false;
    }
    const store = readStore(storage);
    const game = ensureGame(store, page);
    game.progress = progress;
    return writeStore(storage, store);
  }

  function loadProgress(storage, page) {
    if (!LIVE_ARCADE_PAGES.includes(page)) {
      return null;
    }
    const store = readStore(storage);
    const game = store.games[page];
    if (!game || !game.progress) {
      return null;
    }
    return sanitizeProgress(game.progress);
  }

  function clearProgress(storage, page) {
    if (!LIVE_ARCADE_PAGES.includes(page)) {
      return false;
    }
    const store = readStore(storage);
    const game = store.games[page];
    if (!game || !game.progress) {
      return false;
    }
    delete game.progress;
    if (!game.boards || !Object.keys(game.boards).length) {
      delete store.games[page];
    }
    return writeStore(storage, store);
  }

  function hasProgress(storage, page) {
    return !!loadProgress(storage, page);
  }

  function listProgressPages(storage) {
    const store = readStore(storage);
    return LIVE_ARCADE_PAGES.filter((page) => store.games[page] && store.games[page].progress);
  }

  function slugForPage(page) {
    return PAGE_SLUG[page] || 'turdanoid';
  }

  function titleForPage(page) {
    return PAGE_TITLE[page] || 'Turdanoid';
  }

  function buildShareText(options) {
    const page = options && options.page;
    const gameTitle = (options && options.gameTitle) || titleForPage(page);
    const scoreLine = String((options && options.scoreLine) || (options && options.score) || '').trim();
    const slug = (options && options.slug) || slugForPage(page);
    const url = SHARE_PLAY_BASE + slug;
    if (!scoreLine) {
      return gameTitle + ' — ' + url;
    }
    return gameTitle + ': ' + scoreLine + '\n' + url;
  }

  function shareScore(options, env) {
    const text = buildShareText(options || {});
    const url = SHARE_PLAY_BASE + ((options && options.slug) || slugForPage(options && options.page));
    const nav =
      (env && env.navigator) ||
      (typeof root.navigator !== 'undefined' ? root.navigator : null);
    const clipboard = env && env.clipboard;
    const toast = env && env.toast;
    const title = (options && options.gameTitle) || titleForPage(options && options.page);

    if (nav && typeof nav.share === 'function') {
      return Promise.resolve()
        .then(function () {
          return nav.share({ title, text, url });
        })
        .then(function () {
          return { method: 'share' };
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') {
            return { method: 'cancel' };
          }
          return copyShareFallback(text, clipboard, toast);
        });
    }
    return copyShareFallback(text, clipboard, toast);
  }

  function copyShareFallback(text, clipboard, toast) {
    const write =
      clipboard && typeof clipboard.writeText === 'function'
        ? clipboard.writeText(text)
        : legacyCopy(text);
    return Promise.resolve(write)
      .then(function () {
        if (typeof toast === 'function') {
          toast('Score link copied');
        }
        return { method: 'copy' };
      })
      .catch(function () {
        if (typeof toast === 'function') {
          toast('Could not copy link');
        }
        return { method: 'fail' };
      });
  }

  function legacyCopy(text) {
    if (typeof document === 'undefined') {
      throw new Error('no document');
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (!ok) {
      throw new Error('copy failed');
    }
  }

  function recordEnd(storage, page, options) {
    const opts = options || {};
    if (opts.value !== undefined && opts.value !== null) {
      recordLeaderboard(storage, page, {
        bucket: opts.bucket,
        value: opts.value,
        rank: opts.rank
      });
    }
    clearProgress(storage, page);
    return true;
  }

  root.TurdSuiteArcade = {
    ARCADE_KEY,
    ARCADE_VERSION,
    LEADERBOARD_CAP,
    SHARE_PLAY_BASE,
    LIVE_ARCADE_PAGES,
    PAGE_SLUG,
    PAGE_TITLE,
    parseArcadeStore,
    readStore,
    writeStore,
    recordLeaderboard,
    getLeaderboard,
    saveProgress,
    loadProgress,
    clearProgress,
    hasProgress,
    listProgressPages,
    slugForPage,
    titleForPage,
    buildShareText,
    shareScore,
    recordEnd,
    cleanBucket,
    insertLeaderboard
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
