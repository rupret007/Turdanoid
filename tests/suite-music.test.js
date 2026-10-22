import { describe, expect, it, vi } from 'vitest';

import {
  MUSIC_PREF_KEY,
  PLAYBACK_KEY,
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
    this.currentTime = 0;
    this.duration = NaN;
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

describe('saved playback position and selection', () => {
  function setup(storage, flags = {}) {
    const audio = new MockAudio();
    const player = createSuiteMusic({ storage, AudioCtor: function () { return audio; },
      isSuiteMuted: () => !!flags.muted, isGameBlocked: () => !!flags.blocked,
      resolveSrc: path => `https://example.test/assets/${path}` });
    const emit = event => audio._listeners[event]?.forEach(fn => fn());
    return { player, audio, emit };
  }
  it('restores the same track after metadata without erasing a pending seek on an unarmed page', () => {
    const storage = memoryStorage({ turdsuite_music_track_v1: '1', [PLAYBACK_KEY]: JSON.stringify({ v: 1, track: STALEMATE_PLAYLIST[1].path, seconds: 23.5 }) });
    const { player, audio, emit } = setup(storage);
    player.sync(); player.savePosition();
    expect(JSON.parse(storage.data[PLAYBACK_KEY]).seconds).toBe(23.5);
    audio.duration = 176; emit('loadedmetadata');
    expect(audio.currentTime).toBe(23.5); expect(audio.paused).toBe(true);
    player.armFromGesture(); expect(audio.paused).toBe(false);
    audio.currentTime = 31.25; player.pause();
    const next = setup(storage); next.audio.duration = 176; next.emit('loadedmetadata');
    expect(next.player.trackTitle).toBe('Andrea'); expect(next.audio.currentTime).toBe(31.25);
  });
  it.each(['bad json', JSON.stringify({ v: 1, track: STALEMATE_PLAYLIST[0].path, seconds: -5 }), JSON.stringify({ v: 1, track: 'wrong', seconds: 20 })])('ignores invalid playback saves: %s', saved => {
    const { audio, emit } = setup(memoryStorage({ [PLAYBACK_KEY]: saved }));
    audio.duration = 126; emit('loadedmetadata'); expect(audio.currentTime).toBe(0);
  });
  it('ignores an out-of-duration seek and respects mute and game gates during next/selection', () => {
    const flags = { muted: true };
    const storage = memoryStorage({ [PLAYBACK_KEY]: JSON.stringify({ v: 1, track: STALEMATE_PLAYLIST[0].path, seconds: 500 }) });
    const { player, audio, emit } = setup(storage, flags);
    audio.duration = 126; emit('loadedmetadata'); expect(audio.currentTime).toBe(0);
    player.nextTrack(); expect(player.trackTitle).toBe('Andrea'); expect(audio.paused).toBe(true);
    flags.muted = false; flags.blocked = true; player.playTrackAt(4); expect(audio.paused).toBe(true);
    flags.blocked = false; player.sync(); expect(audio.paused).toBe(false);
    audio.currentTime = 67; emit('ended'); expect(player.trackTitle).toBe('Manic');
  });
  it('continues selection/playback when storage throws', () => {
    const { player, audio } = setup({ getItem() { throw Error('denied'); }, setItem() { throw Error('full'); } });
    player.nextTrack(); expect(player.trackTitle).toBe('Andrea'); expect(audio.paused).toBe(false);
  });
});

describe('music loading and recovery', () => {
  function setup() {
    const audio = new MockAudio();
    const flags = { muted: false, blocked: false, hidden: false };
    const states = [];
    const player = createSuiteMusic({ AudioCtor: function () { return audio; },
      isSuiteMuted: () => flags.muted, isGameBlocked: () => flags.blocked,
      isDocumentHidden: () => flags.hidden, resolveSrc: path => path,
      onStateChange: state => states.push(state) });
    const emit = event => audio._listeners[event]?.forEach(fn => fn());
    return { audio, flags, states, player, emit };
  }

  it('announces loading until playback starts, and buffering until it resumes', async () => {
    const { audio, states, player, emit } = setup();
    let finish;
    audio.play = () => { audio.paused = false; return new Promise(resolve => { finish = resolve; }); };
    player.armFromGesture(); expect(states.at(-1).status).toBe('loading');
    emit('playing'); expect(states.at(-1).status).toBe('playing');
    emit('waiting'); expect(states.at(-1).status).toBe('loading');
    emit('playing'); finish(); await Promise.resolve();
    expect(states.at(-1).status).toBe('playing');
  });

  it('reports a media error even if the browser still says unpaused, and never retries on repeated sync', () => {
    const { audio, states, player, emit } = setup();
    const play = vi.spyOn(audio, 'play');
    player.armFromGesture(); audio.error = { code: 4 }; emit('error');
    expect(states.at(-1)).toMatchObject({ status: 'error', paused: true, canRetry: true });
    expect(player.isPlaying()).toBe(false);
    for (let i = 0; i < 10; i++) { player.sync(); player.armFromGesture(); }
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('retries the same song and saved position after metadata, respecting every playback gate', async () => {
    const { audio, flags, states, player, emit } = setup();
    const play = vi.spyOn(audio, 'play'); audio.load = vi.fn(() => { audio.error = null; });
    player.armFromGesture(); audio.currentTime = 23; audio.error = { code: 2 }; emit('error');
    for (const gate of ['muted', 'blocked', 'hidden']) {
      flags[gate] = true; player.retryTrack(); expect(play).toHaveBeenCalledTimes(1); flags[gate] = false;
    }
    player.retryTrack(); expect(audio.load).toHaveBeenCalledTimes(1);
    expect(audio.src).toContain('manic.m4a'); audio.duration = 120; emit('loadedmetadata');
    expect(audio.currentTime).toBe(23); await Promise.resolve();
    expect(states.at(-1)).toMatchObject({ status: 'playing', canRetry: false });
  });

  it('offers a gesture retry for autoplay rejection and lets Next recover independently', async () => {
    const { audio, states, player } = setup();
    audio.play = () => Promise.reject(Object.assign(new Error('gesture needed'), { name: 'NotAllowedError' }));
    player.armFromGesture(); await Promise.resolve();
    expect(states.at(-1)).toMatchObject({ status: 'blocked', canRetry: true });
    audio.play = MockAudio.prototype.play.bind(audio); player.nextTrack(); await Promise.resolve();
    expect(states.at(-1)).toMatchObject({ title: 'Andrea', status: 'playing', canRetry: false });
  });

  it('ignores old play rejections after switching songs or pausing', async () => {
    const { audio, states, player } = setup();
    let reject;
    audio.play = () => new Promise((resolve, fail) => { reject = fail; });
    player.armFromGesture(); const oldReject = reject;
    audio.play = MockAudio.prototype.play.bind(audio); player.nextTrack(); await Promise.resolve();
    oldReject(new Error('old load')); await Promise.resolve();
    expect(states.at(-1)).toMatchObject({ title: 'Andrea', status: 'playing' });
    audio.play = () => new Promise((resolve, fail) => { reject = fail; });
    player.sync(); player.pause(); reject(Object.assign(new Error('interrupted'), { name: 'AbortError' }));
    await Promise.resolve(); expect(states.at(-1)).toMatchObject({ status: 'paused', canRetry: false });
  });
});
