import { describe, it, expect } from 'vitest';
import {
  createSafeStorage,
  probeStorage,
  PREFS_KEY,
  PREFS_VERSION,
  LEGACY_KEYS,
  DEFAULT_PREFS,
  sanitizePrefs,
  parsePrefsBlob,
  loadPrefs,
  savePrefs
} from '../games/turdanoid-storage.js';

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
    expect(sanitizePrefs({ best: 12.8, ambientOn: '1' })).toMatchObject({
      best: 12,
      ambientOn: true
    });
    const store = memoryPrimary({
      turdanoid_prefs_v1: JSON.stringify({ v: 1, best: -9, soundOn: 'nope' }),
      turdanoid_v2_best: '80'
    });
    expect(loadPrefs(store).best).toBe(80);
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
