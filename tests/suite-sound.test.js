import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { createStudioAudio, resolveStudioCue, STUDIO_CUES, STUDIO_EVENTS } from '../assets/suite-sound.js';

// Scheduler/state tests only. Audible quality is reviewed through rendered clips.
function contextFixture() {
  const sources = [], gains = [], shapes = [];
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() });
  const node = () => ({ connect(next) { return next; }, disconnect: vi.fn() });
  const context = {
    currentTime: 0, state: 'running', sampleRate: 48000, destination: node(),
    createWaveShaper() { const n = node(); shapes.push(n); return n; },
    createGain() { const n = { ...node(), gain: param() }; gains.push(n); return n; },
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; },
    createBiquadFilter() { return { ...node(), frequency: param(), Q: param() }; },
    createOscillator() { return this.source('oscillator'); },
    createBufferSource() { return this.source('buffer'); },
    source(kind) {
      const n = { ...node(), kind, frequency: param(),
        start: vi.fn(time => { n.startAt = time; }),
        stop: vi.fn(time => { n.stopAt = time; }) };
      sources.push(n); return n;
    },
    advance(time) {
      this.currentTime = time;
      for (const n of sources) {if (!n.ended && n.stopAt <= time) { n.ended = true; n.onended?.(); }}
    }
  };
  const prefs = { muted: false, allowed: true, volume: .65 };
  const getContext = vi.fn(() => context);
  const player = createStudioAudio({ isMuted: () => prefs.muted, canPlay: () => prefs.allowed, getVolume: () => prefs.volume, getContext });
  return { context, sources, gains, shapes, prefs, getContext, player };
}

describe('studio audio scheduling and safety', () => {
  it('does not allocate a context or remember missed cues before permission, while muted or at zero level', () => {
    const f = contextFixture();
    expect(f.getContext).not.toHaveBeenCalled();
    f.prefs.allowed = false; expect(f.player.playEvent('jack.deal')).toBe(false);
    f.prefs.allowed = true; f.prefs.muted = true; expect(f.player.playEvent('jack.deal')).toBe(false);
    f.prefs.muted = false; f.prefs.volume = 0; expect(f.player.playEvent('jack.deal')).toBe(false);
    expect(f.getContext).not.toHaveBeenCalled();
    f.prefs.volume = .65; f.player.sync();
    expect(f.sources).toHaveLength(0);
    expect(f.player.playEvent('jack.deal')).toBe(true);
    expect(f.player.getState().accepted).toBe(1);
  });

  it('throttles a collision burst without deferred playback and accepts a fresh later hit', () => {
    const f = contextFixture();
    for (let i = 0; i < 100; i++) {f.player.playEvent('ta.brick');}
    expect(f.player.getState()).toMatchObject({ accepted: 1, dropped: 99, activeVoices: 2 });
    f.context.advance(.04);
    expect(f.player.playEvent('ta.brick')).toBe(true);
    expect(f.player.getState().accepted).toBe(2);
    f.context.advance(1);
    expect(f.player.getState().activeVoices).toBe(0);
    f.player.sync();
    expect(f.player.getState().accepted).toBe(2);
  });

  it('bounds ordinary voices and reserves capacity for a result during busy play', () => {
    const f = contextFixture();
    for (const event of ['shared.beep', 'jack.deal', 'jack.chip', 'chess.move', 'ta.brick', 'ta.bounce']) {expect(f.player.playEvent(event)).toBe(true);}
    expect(f.player.getState().activeVoices).toBe(12);
    expect(f.player.playEvent('tris.drop')).toBe(false);
    expect(f.player.playEvent('rummy.gin')).toBe(true);
    expect(f.player.getState()).toMatchObject({ activeVoices: 16, peakVoices: 16 });
    for (let i = 0; i < 100; i++) {f.player.playEvent('rummy.gin');}
    expect(f.sources).toHaveLength(16);
    f.context.advance(1);
    expect(f.player.getState().activeVoices).toBe(0);
    expect(f.sources.every(n => n.disconnect.mock.calls.length === 1)).toBe(true);
  });

  it('cancels a lower-priority result before its scheduled start when the same completion earns a milestone', () => {
    const f = contextFixture();
    expect(f.player.playEvent('rummy.roundWin')).toBe(true);
    const first = [...f.sources];
    expect(f.player.playEvent('rummy.matchWin')).toBe(true);
    expect(first.every(n => n.stopAt < n.startAt)).toBe(true);
    expect(f.player.playEvent('shared.win')).toBe(false);
    expect(f.player.getState().lastEvent).toBe('rummy.matchWin');
  });

  it('silences scheduled/current voices on mute, hidden/pause gates and never resumes old cues', () => {
    const f = contextFixture();
    f.player.playEvent('jack.blackjack');
    f.prefs.muted = true; f.player.sync();
    expect(f.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, .003);
    expect(f.sources.every(n => n.stopAt <= .008)).toBe(true);
    f.context.advance(.02); f.prefs.muted = false; f.prefs.allowed = false;
    f.player.playEvent('jack.win'); f.prefs.allowed = true; f.player.sync();
    expect(f.player.getState()).toMatchObject({ accepted: 1, activeVoices: 0 });
    expect(f.player.playEvent('chess.move')).toBe(true);
  });

  it('keeps zero level silent and clamps the output level without changing mute intent', () => {
    const f = contextFixture(); f.player.playEvent('chess.capture');
    f.prefs.volume = 0; f.player.sync();
    expect(f.player.getState().volume).toBe(0);
    expect(f.prefs.muted).toBe(false);
    f.context.advance(1); f.prefs.volume = 9; f.player.sync();
    expect(f.player.getState().volume).toBe(1);
    expect(f.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 1, .008);
  });

  it('fails silently for unavailable hardware or unsupported graph nodes', () => {
    const p = createStudioAudio({ getContext: () => { throw Error('hardware unavailable'); } });
    expect(() => p.playEvent('chess.move')).not.toThrow();
    expect(p.getState().accepted).toBe(0);
    const f = contextFixture(); f.context.createWaveShaper = () => { throw Error('unsupported'); };
    expect(f.player.playEvent('chess.move')).toBe(false);
    expect(f.player.getState().unavailable).toBe(true);
  });

  it('covers every literal cue used by the live inline game adapters', () => {
    for (const [page, bank, call] of [['turdjack', 'jack', 'playSfx'], ['turdrummy', 'rummy', 'playSfx'], ['crapeights', 'eights', 'playSfx'], ['turdtris', 'tris', 'playSfx'], ['turdomania', 'mania', 'sfx']]) {
      const html = readFileSync(new URL('../' + page + '.html', import.meta.url), 'utf8');
      const calls = html.matchAll(new RegExp('\\b' + call + '\\(\\s*([\'\"])([^\'\"]+)\\1', 'g'));
      for (const match of calls) {
        expect(resolveStudioCue(bank + '.' + match[2]), page + ': ' + match[2]).not.toBeNull();
      }
    }
    expect(resolveStudioCue('jack.twentyOne')).toBe('accent');
    expect(resolveStudioCue('tris.clear', { linesCleared: 1 })).toBe('clear');
    expect(resolveStudioCue('tris.clear', { linesCleared: 4 })).toBe('milestone');
  });

  it('maps all eight game banks to finite short envelopes, without sampled recordings or unbounded loops', () => {
    for (const bank of ['ta', 'tris', 'jack', 'eights', 'rummy', 'spades', 'mania', 'chess']) {expect(Object.keys(STUDIO_EVENTS).some(name => name.startsWith(bank + '.'))).toBe(true);}
    for (const cue of Object.values(STUDIO_EVENTS)) {
      expect(STUDIO_CUES[cue]?.voices.length).toBeGreaterThan(0);
      for (const voice of STUDIO_CUES[cue].voices) {
        expect(voice.dur).toBeGreaterThan(0); expect(voice.dur + voice.delay).toBeLessThan(.4);
        expect(voice.amp).toBeGreaterThan(0); expect(voice.amp).toBeLessThan(.3);
      }
    }
  });
});
