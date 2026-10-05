import { describe, it, expect, beforeEach } from 'vitest';
import { getSfxSpec, loadSoundPref, saveSoundPref, createPlayer, SOUND_KEY, SFX_TABLE } from '../games/turdrummy-audio.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
}

describe('getSfxSpec', () => {
  it('returns a non-empty note list for every documented SFX name', () => {
    for (const name of Object.keys(SFX_TABLE)) {
      const spec = getSfxSpec(name);
      expect(Array.isArray(spec)).toBe(true);
      expect(spec.length).toBeGreaterThan(0);
    }
  });

  it('returns null for an unknown name', () => {
    expect(getSfxSpec('not-a-real-sound')).toBeNull();
  });
});

describe('loadSoundPref / saveSoundPref', () => {
  it('defaults to enabled when nothing has been saved', () => {
    expect(loadSoundPref(fakeStorage())).toBe(true);
  });

  it('round-trips an explicit off preference', () => {
    const storage = fakeStorage();
    saveSoundPref(storage, false);
    expect(storage.getItem(SOUND_KEY)).toBe('0');
    expect(loadSoundPref(storage)).toBe(false);
  });

  it('round-trips an explicit on preference', () => {
    const storage = fakeStorage();
    saveSoundPref(storage, false);
    saveSoundPref(storage, true);
    expect(loadSoundPref(storage)).toBe(true);
  });
});

describe('createPlayer', () => {
  let storage;
  beforeEach(() => {
    storage = fakeStorage();
  });

  it('reads the saved preference on creation', () => {
    saveSoundPref(storage, false);
    const player = createPlayer(storage);
    expect(player.isEnabled()).toBe(false);
  });

  it('setEnabled persists the new preference', () => {
    const player = createPlayer(storage);
    player.setEnabled(false);
    expect(player.isEnabled()).toBe(false);
    expect(loadSoundPref(storage)).toBe(false);
  });

  it('play() is a no-op when disabled and never throws without a real AudioContext', () => {
    const player = createPlayer(storage);
    player.setEnabled(false);
    expect(() => player.play('gin')).not.toThrow();
  });

  it('play() with an unknown name is a no-op', () => {
    const player = createPlayer(storage);
    expect(() => player.play('nonsense')).not.toThrow();
  });

  it('unlock() never throws when AudioContext is unavailable (headless/test env)', () => {
    const player = createPlayer(storage);
    expect(() => player.unlock()).not.toThrow();
  });
});
