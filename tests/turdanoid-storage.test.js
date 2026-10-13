import { describe, it, expect } from 'vitest';
import {
  createSafeStorage,
  probeStorage,
  PREFS_KEY,
  PREFS_VERSION,
  LEGACY_KEYS,
  DEFAULT_PREFS,
  SCORE_MAX,
  parseScore,
  mergeScores,
  sanitizePrefs,
  parsePrefsBlob,
  loadPrefs,
  savePrefs
} from '../games/turdanoid-storage.js';
import { readHubStatBadge } from '../assets/suite-hub-stats.js';

function memoryPrimary(seed = {}) {
  const data = { ...seed };
  return {
    data,
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

describe('Turdanoid safe storage', () => {
  it('reads and writes through a working primary store', () => {
    const primary = memoryPrimary();
    const store = createSafeStorage(primary);
    expect(store.getItem('turdanoid_v2_best')).toBeNull();
    store.setItem('turdanoid_v2_best', 4200);
    expect(store.getItem('turdanoid_v2_best')).toBe('4200');
    expect(primary.data.turdanoid_v2_best).toBe('4200');
  });

  it('falls back to memory when getItem throws', () => {
    const primary = {
      getItem() {
        throw new globalThis.DOMException('The operation is insecure.', 'SecurityError');
      },
      setItem() {
        throw new globalThis.DOMException('The operation is insecure.', 'SecurityError');
      }
    };
    const store = createSafeStorage(primary);
    expect(store.getItem('turdanoid_v2_best')).toBeNull();
    expect(store.getItem('turdanoid_v2_sound')).toBeNull();
    store.setItem('turdanoid_v2_best', '99');
    expect(store.getItem('turdanoid_v2_best')).toBe('99');
    store.setItem('turdanoid_v2_sound', '0');
    expect(store.getItem('turdanoid_v2_sound')).toBe('0');
  });

  it('falls back to memory when setItem throws', () => {
    const primary = memoryPrimary({ turdanoid_v2_best: '10' });
    primary.setItem = () => {
      throw new globalThis.DOMException('Quota exceeded', 'QuotaExceededError');
    };
    const store = createSafeStorage(primary);
    expect(store.getItem('turdanoid_v2_best')).toBe('10');
    store.setItem('turdanoid_v2_best', '99');
    expect(store.getItem('turdanoid_v2_best')).toBe('99');
    expect(primary.data.turdanoid_v2_best).toBe('10');
    store.setItem('turdanoid_v2_sound', '0');
    expect(store.getItem('turdanoid_v2_sound')).toBe('0');
  });

  it('uses memory when no primary store is available', () => {
    const store = createSafeStorage(null);
    store.setItem('turdanoid_v3_ambient', '1');
    expect(store.getItem('turdanoid_v3_ambient')).toBe('1');
    store.removeItem('turdanoid_v3_ambient');
    expect(store.getItem('turdanoid_v3_ambient')).toBeNull();
  });

  it('probeStorage returns null when localStorage access throws', () => {
    const root = {};
    Object.defineProperty(root, 'localStorage', {
      get() {
        throw new globalThis.DOMException('The operation is insecure.', 'SecurityError');
      }
    });
    expect(probeStorage(root)).toBeNull();
    expect(probeStorage(null)).toBeNull();
    expect(probeStorage({ localStorage: null })).toBeNull();
  });

  it('probeStorage returns a usable localStorage object', () => {
    const primary = memoryPrimary();
    Object.defineProperty(primary, 'length', {
      get() {
        return Object.keys(primary.data).length;
      }
    });
    expect(probeStorage({ localStorage: primary })).toBe(primary);
  });
});

describe('Turdanoid versioned prefs migration', () => {
  it('exports a versioned blob key and keeps the legacy aliases', () => {
    expect(PREFS_KEY).toBe('turdanoid_prefs_v1');
    expect(PREFS_VERSION).toBe(1);
    expect(LEGACY_KEYS).toEqual({
      best: 'turdanoid_v2_best',
      sound: 'turdanoid_v2_sound',
      ambient: 'turdanoid_v3_ambient',
      haptic: 'turdanoid_v3_haptic',
      bossBest: 'turdanoid_boss_best_v1'
    });
    expect(DEFAULT_PREFS).toEqual({
      v: 1,
      best: 0,
      soundOn: true,
      ambientOn: false,
      hapticOn: true,
      bossBest: 0
    });
  });

  it('returns defaults without writing when storage is empty', () => {
    const store = memoryPrimary();
    expect(loadPrefs(store)).toEqual(DEFAULT_PREFS);
    expect(store.data).toEqual({});
  });

  it('migrates scattered legacy keys into the versioned blob and remirrors them', () => {
    const store = memoryPrimary({
      turdanoid_v2_best: '4200',
      turdanoid_v2_sound: '0',
      turdanoid_v3_ambient: '1',
      turdanoid_v3_haptic: '0',
      turdanoid_boss_best_v1: '900'
    });
    const prefs = loadPrefs(store);
    expect(prefs).toEqual({
      v: 1,
      best: 4200,
      soundOn: false,
      ambientOn: true,
      hapticOn: false,
      bossBest: 900
    });
    expect(JSON.parse(store.data[PREFS_KEY])).toEqual(prefs);
    expect(store.data.turdanoid_v2_best).toBe('4200');
    expect(store.data.turdanoid_v2_sound).toBe('0');
    expect(store.data.turdanoid_v3_ambient).toBe('1');
    expect(store.data.turdanoid_v3_haptic).toBe('0');
    expect(store.data.turdanoid_boss_best_v1).toBe('900');
  });

  it('lets a valid prefs blob win over stale legacy values', () => {
    const store = memoryPrimary({
      turdanoid_prefs_v1: JSON.stringify({
        v: 1,
        best: 8800,
        soundOn: false,
        ambientOn: true,
        hapticOn: true,
        bossBest: 250
      }),
      turdanoid_v2_best: '100',
      turdanoid_v2_sound: '1'
    });
    expect(loadPrefs(store)).toEqual({
      v: 1,
      best: 8800,
      soundOn: false,
      ambientOn: true,
      hapticOn: true,
      bossBest: 250
    });
    expect(store.data.turdanoid_v2_best).toBe('8800');
    expect(store.data.turdanoid_v2_sound).toBe('0');
    expect(store.data.turdanoid_v3_ambient).toBe('1');
    expect(store.data.turdanoid_v3_haptic).toBe('1');
    expect(store.data.turdanoid_boss_best_v1).toBe('250');
  });

  it('remirrors stale and missing legacy aliases so hub readers match the blob', () => {
    const store = memoryPrimary({
      [PREFS_KEY]: JSON.stringify({
        v: 1,
        best: 8800,
        soundOn: false,
        ambientOn: true,
        hapticOn: false,
        bossBest: 300
      }),
      turdanoid_v2_best: '12',
      turdanoid_v2_sound: '1',
      turdanoid_boss_best_v1: '1'
    });
    expect(loadPrefs(store).best).toBe(8800);
    expect(store.getItem(LEGACY_KEYS.best)).toBe('8800');
    expect(store.getItem(LEGACY_KEYS.sound)).toBe('0');
    expect(store.getItem(LEGACY_KEYS.ambient)).toBe('1');
    expect(store.getItem(LEGACY_KEYS.haptic)).toBe('0');
    expect(store.getItem(LEGACY_KEYS.bossBest)).toBe('300');
    expect(readHubStatBadge((key) => store.getItem(key), 'TurdAnoid.html')?.text).toBe(
      'Best 8,800 · Boss 300'
    );

    const blobOnly = memoryPrimary({
      [PREFS_KEY]: JSON.stringify({
        v: 1,
        best: 4200,
        soundOn: true,
        ambientOn: false,
        hapticOn: true,
        bossBest: 0
      })
    });
    expect(loadPrefs(blobOnly).best).toBe(4200);
    expect(blobOnly.getItem(LEGACY_KEYS.best)).toBe('4200');
    expect(blobOnly.getItem(LEGACY_KEYS.sound)).toBe('1');
    expect(readHubStatBadge((key) => blobOnly.getItem(key), 'TurdAnoid.html')?.text).toBe(
      'Best 4,200'
    );
  });

  it('fills missing blob fields from legacy keys and writes the repair', () => {
    const store = memoryPrimary({
      turdanoid_prefs_v1: JSON.stringify({ v: 1, best: 50 }),
      turdanoid_v2_sound: '0',
      turdanoid_boss_best_v1: '77'
    });
    const prefs = loadPrefs(store);
    expect(prefs.best).toBe(50);
    expect(prefs.soundOn).toBe(false);
    expect(prefs.bossBest).toBe(77);
    expect(JSON.parse(store.data[PREFS_KEY])).toEqual(prefs);
  });

  it('falls back to legacy when the blob is malformed', () => {
    const store = memoryPrimary({
      turdanoid_prefs_v1: '{not-json',
      turdanoid_v2_best: '333'
    });
    expect(loadPrefs(store).best).toBe(333);
    expect(JSON.parse(store.data[PREFS_KEY]).best).toBe(333);
  });

  it('rejects invalid scores, arrays, and non-objects', () => {
    expect(parsePrefsBlob('[]')).toBeNull();
    expect(parsePrefsBlob('null')).toBeNull();
    expect(parsePrefsBlob('{"v":1}')).toEqual({ v: 1 });
    expect(
      sanitizePrefs({ best: -4, bossBest: Infinity, soundOn: 'maybe' }, DEFAULT_PREFS)
    ).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs({ best: '<script>1e999</script>', ambientOn: '1' }).best).toBe(0);
    expect(sanitizePrefs({ best: '4200garbage' }).best).toBe(0);
    expect(sanitizePrefs({ best: '1e999', bossBest: '1e3' }).best).toBe(0);
    expect(sanitizePrefs({ best: '1e999', bossBest: '1e3' }).bossBest).toBe(0);
    expect(sanitizePrefs({ best: '4200', bossBest: '0' })).toMatchObject({
      best: 4200,
      bossBest: 0
    });
    expect(sanitizePrefs({ best: 12.8, ambientOn: '1' })).toMatchObject({
      best: 0,
      ambientOn: true
    });
    const store = memoryPrimary({
      turdanoid_prefs_v1: JSON.stringify({ v: 1, best: -9, soundOn: 'nope' }),
      turdanoid_v2_best: '80'
    });
    expect(loadPrefs(store).best).toBe(80);
  });

  it('rejects malformed score strings that parseInt would accept', () => {
    expect(sanitizePrefs({ best: '4200garbage' }, DEFAULT_PREFS).best).toBe(0);
    expect(sanitizePrefs({ bossBest: '900xyz' }, DEFAULT_PREFS).bossBest).toBe(0);
    expect(sanitizePrefs({ best: '1e999' }, DEFAULT_PREFS).best).toBe(0);
    expect(sanitizePrefs({ best: '1e3' }, DEFAULT_PREFS).best).toBe(0);
    expect(sanitizePrefs({ best: '012' }, DEFAULT_PREFS).best).toBe(0);
    expect(sanitizePrefs({ best: '+7' }, DEFAULT_PREFS).best).toBe(0);
    expect(sanitizePrefs({ best: '12.8' }, DEFAULT_PREFS).best).toBe(0);
    expect(sanitizePrefs({ best: 12.8 }, DEFAULT_PREFS).best).toBe(0);
    expect(sanitizePrefs({ bossBest: 9.1 }, DEFAULT_PREFS).bossBest).toBe(0);
    expect(sanitizePrefs({ best: 12.0 }, DEFAULT_PREFS).best).toBe(12);
    const store = memoryPrimary({
      [PREFS_KEY]: JSON.stringify({ v: 1, best: '4200garbage', bossBest: '1e999' })
    });
    expect(loadPrefs(store)).toEqual(DEFAULT_PREFS);
    expect(JSON.parse(store.data[PREFS_KEY])).toEqual(DEFAULT_PREFS);
    const legacy = memoryPrimary({ turdanoid_v2_best: '4200garbage' });
    expect(loadPrefs(legacy).best).toBe(0);
  });

  it('rejects fractional numeric scores instead of truncating them', () => {
    expect(sanitizePrefs({ best: 12.8, bossBest: 3.5 }, DEFAULT_PREFS)).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs({ best: -1.2 }, DEFAULT_PREFS).best).toBe(0);
    const store = memoryPrimary({
      [PREFS_KEY]: JSON.stringify({
        v: 1,
        best: 12.8,
        soundOn: true,
        ambientOn: false,
        hapticOn: true,
        bossBest: 3.5
      })
    });
    expect(loadPrefs(store)).toEqual(DEFAULT_PREFS);
    expect(JSON.parse(store.data[PREFS_KEY])).toEqual(DEFAULT_PREFS);
    const recovered = memoryPrimary({
      [PREFS_KEY]: JSON.stringify({
        v: 1,
        best: 12.8,
        soundOn: true,
        ambientOn: false,
        hapticOn: true,
        bossBest: 0
      }),
      turdanoid_v2_best: '8800'
    });
    expect(loadPrefs(recovered).best).toBe(8800);
    expect(JSON.parse(recovered.data[PREFS_KEY]).best).toBe(8800);
    expect(recovered.getItem(LEGACY_KEYS.best)).toBe('8800');
    const recoveredAll = memoryPrimary({
      [PREFS_KEY]: JSON.stringify({
        v: 1,
        best: '4200garbage',
        soundOn: 'nope',
        ambientOn: 'maybe',
        hapticOn: 'nope',
        bossBest: 3.5
      }),
      turdanoid_v2_best: '4200',
      turdanoid_v2_sound: '0',
      turdanoid_v3_ambient: '1',
      turdanoid_v3_haptic: '0',
      turdanoid_boss_best_v1: '900'
    });
    expect(loadPrefs(recoveredAll)).toEqual({
      v: 1,
      best: 4200,
      soundOn: false,
      ambientOn: true,
      hapticOn: false,
      bossBest: 900
    });
    expect(JSON.parse(recoveredAll.data[PREFS_KEY])).toEqual({
      v: 1,
      best: 4200,
      soundOn: false,
      ambientOn: true,
      hapticOn: false,
      bossBest: 900
    });
    expect(recoveredAll.getItem(LEGACY_KEYS.best)).toBe('4200');
    expect(recoveredAll.getItem(LEGACY_KEYS.sound)).toBe('0');
    expect(recoveredAll.getItem(LEGACY_KEYS.ambient)).toBe('1');
    expect(recoveredAll.getItem(LEGACY_KEYS.haptic)).toBe('0');
    expect(recoveredAll.getItem(LEGACY_KEYS.bossBest)).toBe('900');
  });

  it('never overwrites a valid legacy high score with a zero blob score', () => {
    const store = memoryPrimary({
      [PREFS_KEY]: JSON.stringify({
        v: 1,
        best: 0,
        soundOn: true,
        ambientOn: false,
        hapticOn: true,
        bossBest: 0
      }),
      turdanoid_v2_best: '8800',
      turdanoid_boss_best_v1: '300'
    });
    expect(loadPrefs(store)).toEqual({
      v: 1,
      best: 8800,
      soundOn: true,
      ambientOn: false,
      hapticOn: true,
      bossBest: 300
    });
    expect(JSON.parse(store.data[PREFS_KEY])).toEqual({
      v: 1,
      best: 8800,
      soundOn: true,
      ambientOn: false,
      hapticOn: true,
      bossBest: 300
    });
    expect(store.getItem(LEGACY_KEYS.best)).toBe('8800');
    expect(store.getItem(LEGACY_KEYS.bossBest)).toBe('300');
    expect(savePrefs(store, { soundOn: false }).best).toBe(8800);
    expect(store.getItem(LEGACY_KEYS.best)).toBe('8800');
    expect(JSON.parse(store.data[PREFS_KEY])).toMatchObject({
      best: 8800,
      soundOn: false,
      bossBest: 300
    });
  });

  it('resets a malformed prefs blob when no legacy keys exist', () => {
    for (const raw of ['{not-json', 'null', '[]', '"nope"', '0']) {
      const store = memoryPrimary({ [PREFS_KEY]: raw });
      expect(loadPrefs(store)).toEqual(DEFAULT_PREFS);
      expect(store.data[PREFS_KEY]).toBe(JSON.stringify(DEFAULT_PREFS));
      expect(store.getItem(LEGACY_KEYS.best)).toBe('0');
      expect(store.getItem(LEGACY_KEYS.sound)).toBe('1');
    }
    const empty = memoryPrimary();
    expect(loadPrefs(empty)).toEqual(DEFAULT_PREFS);
    expect(empty.data).toEqual({});
  });

  it('reads a future blob version without downgrading it', () => {
    const future = {
      v: 2,
      best: 12,
      soundOn: false,
      ambientOn: false,
      hapticOn: true,
      bossBest: 1,
      extra: 'keep'
    };
    const store = memoryPrimary({ [PREFS_KEY]: JSON.stringify(future) });
    expect(loadPrefs(store)).toEqual({
      v: 1,
      best: 12,
      soundOn: false,
      ambientOn: false,
      hapticOn: true,
      bossBest: 1
    });
    expect(JSON.parse(store.data[PREFS_KEY])).toEqual(future);
  });

  it('saves a patch onto a future blob without downgrading or dropping unknown fields', () => {
    const future = {
      v: 2,
      best: 12,
      soundOn: false,
      ambientOn: false,
      hapticOn: true,
      bossBest: 1,
      extra: 'keep'
    };
    const store = memoryPrimary({ [PREFS_KEY]: JSON.stringify(future) });
    const saved = savePrefs(store, { soundOn: true, best: 6400 });
    expect(saved).toEqual({
      v: 1,
      best: 6400,
      soundOn: true,
      ambientOn: false,
      hapticOn: true,
      bossBest: 1
    });
    expect(JSON.parse(store.data[PREFS_KEY])).toEqual({
      extra: 'keep',
      v: 2,
      best: 6400,
      soundOn: true,
      ambientOn: false,
      hapticOn: true,
      bossBest: 1
    });
    expect(store.getItem(LEGACY_KEYS.best)).toBe('6400');
    expect(store.getItem(LEGACY_KEYS.sound)).toBe('1');
    expect(savePrefs(store, { hapticOn: false }).hapticOn).toBe(false);
    expect(JSON.parse(store.data[PREFS_KEY])).toMatchObject({
      v: 2,
      extra: 'keep',
      hapticOn: false,
      best: 6400
    });
  });

  it('repairs invalid known fields on a future blob without downgrading or dropping extras', () => {
    const store = memoryPrimary({
      [PREFS_KEY]: JSON.stringify({
        v: 2,
        best: -9,
        soundOn: true,
        ambientOn: false,
        hapticOn: true,
        bossBest: 1,
        extra: 'keep',
        theme: 'dark'
      })
    });
    expect(loadPrefs(store)).toEqual({
      v: 1,
      best: 0,
      soundOn: true,
      ambientOn: false,
      hapticOn: true,
      bossBest: 1
    });
    expect(JSON.parse(store.data[PREFS_KEY])).toEqual({
      extra: 'keep',
      theme: 'dark',
      v: 2,
      best: 0,
      soundOn: true,
      ambientOn: false,
      hapticOn: true,
      bossBest: 1
    });
    const prefix = memoryPrimary({
      [PREFS_KEY]: JSON.stringify({
        v: 2,
        best: '4200garbage',
        soundOn: false,
        ambientOn: false,
        hapticOn: true,
        bossBest: 4,
        extra: 'keep'
      })
    });
    expect(loadPrefs(prefix).best).toBe(0);
    expect(JSON.parse(prefix.data[PREFS_KEY])).toMatchObject({
      v: 2,
      extra: 'keep',
      best: 0,
      soundOn: false,
      bossBest: 4
    });
  });

  it('rewrites a raw invalid score when sanitize would hide the damage', () => {
    const store = memoryPrimary({
      [PREFS_KEY]: JSON.stringify({ v: 1, best: -9 })
    });
    expect(loadPrefs(store)).toEqual(DEFAULT_PREFS);
    expect(JSON.parse(store.data[PREFS_KEY])).toEqual(DEFAULT_PREFS);
    const poisoned = memoryPrimary({
      [PREFS_KEY]: JSON.stringify({
        v: 1,
        best: 80,
        soundOn: true,
        ambientOn: false,
        hapticOn: true,
        bossBest: -3
      })
    });
    expect(loadPrefs(poisoned).bossBest).toBe(0);
    expect(JSON.parse(poisoned.data[PREFS_KEY])).toEqual({
      v: 1,
      best: 80,
      soundOn: true,
      ambientOn: false,
      hapticOn: true,
      bossBest: 0
    });
  });

  it('saves a patch to the blob and every legacy alias', () => {
    const store = memoryPrimary();
    const saved = savePrefs(store, { best: 6400, soundOn: false });
    expect(saved).toEqual({
      v: 1,
      best: 6400,
      soundOn: false,
      ambientOn: false,
      hapticOn: true,
      bossBest: 0
    });
    expect(JSON.parse(store.getItem(PREFS_KEY))).toEqual(saved);
    expect(store.getItem(LEGACY_KEYS.best)).toBe('6400');
    expect(store.getItem(LEGACY_KEYS.sound)).toBe('0');
    expect(store.getItem(LEGACY_KEYS.ambient)).toBe('0');
    expect(store.getItem(LEGACY_KEYS.haptic)).toBe('1');
    expect(store.getItem(LEGACY_KEYS.bossBest)).toBe('0');
    expect(savePrefs(store, { hapticOn: false, bossBest: 15 }).hapticOn).toBe(false);
    expect(store.getItem(LEGACY_KEYS.haptic)).toBe('0');
    expect(store.getItem(LEGACY_KEYS.bossBest)).toBe('15');
  });

  it('parseScore accepts only finite integers and plain digit strings', () => {
    const accepted = [
      ['number zero', 0, 0],
      ['positive integer', 4200, 4200],
      ['integer-valued float', 12.0, 12],
      ['score cap', SCORE_MAX, SCORE_MAX],
      ['digit string zero', '0', 0],
      ['digit string', '4200', 4200],
      ['digit string cap', String(SCORE_MAX), SCORE_MAX]
    ];
    for (const [label, value, expected] of accepted) {
      expect(parseScore(value), label).toBe(expected);
    }
  });

  it('parseScore rejects arrays, objects, bools, non-integers, and coerced strings', () => {
    const rejected = [
      ['json array [500]', [500]],
      ['json array [1]', [1]],
      ['nested array [[500]]', [[500]]],
      ['stringified array "[500]"', '[500]'],
      ['stringified array "[1]"', '[1]'],
      ['array of digit string', ['500']],
      ['empty object', {}],
      ['score-shaped object', { best: 500 }],
      ['nested blob', { nested: { best: 500 } }],
      ['toString spoof', { toString: () => '500' }],
      ['boolean true', true],
      ['boolean false', false],
      ['null', null],
      ['undefined', undefined],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['-Infinity', Number.NEGATIVE_INFINITY],
      ['negative integer', -4],
      ['negative fraction', -1.2],
      ['positive fraction', 12.8],
      ['boss fraction', 3.5],
      ['exponent string', '1e3'],
      ['huge exponent string', '1e999'],
      ['hex string', '0x10'],
      ['leading-zero string', '012'],
      ['plus-prefix string', '+7'],
      ['fraction string', '12.8'],
      ['empty string', ''],
      ['whitespace string', ' '],
      ['parseInt prefix', '4200garbage'],
      ['out of range', SCORE_MAX + 1]
    ];
    for (const [label, value] of rejected) {
      expect(parseScore(value), label).toBeNull();
    }
  });

  it('mergeScores takes the max of valid candidates and ignores invalid ones', () => {
    expect(mergeScores()).toBe(0);
    expect(mergeScores(null, undefined, [500], '[500]', {})).toBe(0);
    expect(mergeScores(0, 8800)).toBe(8800);
    expect(mergeScores(50, 8800)).toBe(8800);
    expect(mergeScores(8800, 100)).toBe(8800);
    expect(mergeScores([500], 8800, '[500]', { best: 9000 })).toBe(8800);
    expect(mergeScores('4200garbage', 12.8, true, '900')).toBe(900);
    expect(mergeScores(SCORE_MAX + 1, 12)).toBe(12);
  });

  it('never lowers or overwrites a valid stored score with an invalid or smaller candidate', () => {
    const cases = [
      [
        'json array blob',
        { v: 1, best: [500], soundOn: true, ambientOn: false, hapticOn: true, bossBest: [300] }
      ],
      [
        'stringified array blob',
        { v: 1, best: '[500]', soundOn: true, ambientOn: false, hapticOn: true, bossBest: '[300]' }
      ],
      [
        'object blob score',
        {
          v: 1,
          best: { score: 500 },
          soundOn: true,
          ambientOn: false,
          hapticOn: true,
          bossBest: { score: 300 }
        }
      ],
      [
        'nested blob score',
        {
          v: 1,
          best: { nested: [500] },
          soundOn: true,
          ambientOn: false,
          hapticOn: true,
          bossBest: { nested: 300 }
        }
      ],
      [
        'boolean blob score',
        { v: 1, best: true, soundOn: true, ambientOn: false, hapticOn: true, bossBest: false }
      ],
      [
        'smaller valid blob',
        { v: 1, best: 50, soundOn: true, ambientOn: false, hapticOn: true, bossBest: 10 }
      ]
    ];
    for (const [label, blob] of cases) {
      const store = memoryPrimary({
        [PREFS_KEY]: JSON.stringify(blob),
        turdanoid_v2_best: '8800',
        turdanoid_boss_best_v1: '300'
      });
      expect(loadPrefs(store), label).toMatchObject({
        best: 8800,
        bossBest: 300
      });
      expect(JSON.parse(store.data[PREFS_KEY]).best, label).toBe(8800);
      expect(JSON.parse(store.data[PREFS_KEY]).bossBest, label).toBe(300);
      expect(store.getItem(LEGACY_KEYS.best), label).toBe('8800');
      expect(store.getItem(LEGACY_KEYS.bossBest), label).toBe('300');
      expect(savePrefs(store, { soundOn: false }).best, label).toBe(8800);
      expect(savePrefs(store, { best: 50 }).best, label).toBe(8800);
      expect(savePrefs(store, { best: [500] }).best, label).toBe(8800);
      expect(store.getItem(LEGACY_KEYS.best), label).toBe('8800');
    }
  });

  it('survives throwing storage through the safe wrapper', () => {
    const persist = createSafeStorage({
      getItem() {
        throw new globalThis.DOMException('blocked', 'SecurityError');
      },
      setItem() {
        throw new globalThis.DOMException('blocked', 'SecurityError');
      }
    });
    expect(loadPrefs(persist)).toEqual(DEFAULT_PREFS);
    expect(savePrefs(persist, { best: 99 }).best).toBe(99);
    expect(loadPrefs(persist).best).toBe(99);
  });
});
