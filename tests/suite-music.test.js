import { describe, expect, it } from 'vitest';

import {
  MUSIC_PREF_KEY,
  STALEMATE_PLAYLIST,
  STALEMATE_TRACK_ONLY_BEEN_18_TITLE,
  advanceTrackIndex,
  createSuiteMusic,
  readMusicEnabled,
  readTrackIndex,
  writeMusicEnabled
} from '../assets/suite-music.js';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    data
  };
}

class MockAudio {
  constructor() {
    this.loop = false;
    this.preload = 'none';
    this.volume = 1;
    this.paused = true;
    this.src = '';
    this._listeners = {};
  }

  setAttribute() {}

  addEventListener(type, fn) {
    this._listeners[type] = this._listeners[type] || [];
    this._listeners[type].push(fn);
  }

  play() {
    this.paused = false;
    this._listeners.play?.forEach((fn) => fn());
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this._listeners.pause?.forEach((fn) => fn());
  }

  emitEnded() {
    this._listeners.ended?.forEach((fn) => fn());
  }
}

describe('suite-music playlist', () => {
  it('lists Stalemate tracks in catalog order starting with Manic', () => {
    expect(STALEMATE_PLAYLIST.map((t) => t.title)).toEqual([
      'Manic',
      'Andrea',
      STALEMATE_TRACK_ONLY_BEEN_18_TITLE,
      'Wham Bam',
      'Planet of the Flakes'
    ]);
    expect(STALEMATE_PLAYLIST[0].path).toBe('stalemate/manic.m4a');
  });

  it('advances in order, never repeats back-to-back, and wraps after the last track', () => {
    const len = STALEMATE_PLAYLIST.length;
    let idx = 0;
    const seen = [idx];
    for (let i = 0; i < len + 2; i++) {
      const next = advanceTrackIndex(idx, len);
      expect(next).not.toBe(idx);
      idx = next;
      seen.push(idx);
    }
    expect(idx).toBe(2);
    expect(seen).toEqual([0, 1, 2, 3, 4, 0, 1, 2]);
  });

  it('persists and restores the track index', () => {
    const storage = memoryStorage();
    storage.setItem('turdsuite_music_track_v1', '3');
    expect(readTrackIndex(storage, STALEMATE_PLAYLIST.length)).toBe(3);
  });

  it('plays the next file when a track ends', () => {
    const storage = memoryStorage({ turdsuite_music_track_v1: '0' });
    const muted = false;
    const blocked = false;
    const audio = new MockAudio();
    const player = createSuiteMusic({
      storage,
      AudioCtor: function () {
        return audio;
      },
      isSuiteMuted: () => muted,
      isGameBlocked: () => blocked,
      resolveSrc: (path) => `https://example.test/assets/${path}`
    });
    player.armFromGesture();
    expect(audio.src).toContain('manic.m4a');
    expect(player.trackTitle).toBe('Manic');
    audio.emitEnded();
    expect(audio.src).toContain('andrea.m4a');
    expect(player.trackTitle).toBe('Andrea');
    expect(storage.data.turdsuite_music_track_v1).toBe('1');
  });

  it('reads and writes stalemate.music on/off', () => {
    const storage = memoryStorage();
    expect(readMusicEnabled(storage)).toBe(true);
    writeMusicEnabled(storage, false);
    expect(storage.data[MUSIC_PREF_KEY]).toBe('off');
    expect(readMusicEnabled(storage)).toBe(false);
  });

  it('pauses immediately when suite mute is on', () => {
    let muted = false;
    const audio = new MockAudio();
    const player = createSuiteMusic({
      isSuiteMuted: () => muted,
      resolveSrc: (path) => `https://example.test/assets/${path}`,
      AudioCtor: function () {
        return audio;
      }
    });
    player.armFromGesture();
    expect(audio.paused).toBe(false);
    muted = true;
    player.sync();
    expect(audio.paused).toBe(true);
  });
});
