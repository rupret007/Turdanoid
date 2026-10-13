import { describe, it, expect } from 'vitest';
import { createSafeStorage, probeStorage } from '../games/turdanoid-storage.js';

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
