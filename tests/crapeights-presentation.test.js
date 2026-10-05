import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../games/crapeights-presentation.js';

const Presentation = globalThis.CrapeightsPresentation;

function param() {
  return { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() };
}

function audioHarness() {
  const oscillators = [];
  const outputs = [];
  const constructor = vi.fn();
  class AudioContext {
    constructor() {
      constructor();
      this.currentTime = 1;
      this.state = 'suspended';
      this.destination = {};
    }
    resume() { return Promise.resolve(); }
    createGain() {
      const gain = { gain: param(), connect: vi.fn(), disconnect: vi.fn() };
      outputs.push(gain);
      return gain;
    }
    createOscillator() {
      const oscillator = { frequency: param(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      oscillators.push(oscillator);
      return oscillator;
    }
  }
  vi.stubGlobal('AudioContext', AudioContext);
  return { constructor, oscillators, outputs };
}

function documentHarness() {
  const animations = [];
  function element() {
    return {
      style: {}, children: [], isConnected: true,
      setAttribute: vi.fn(),
      appendChild(child) { this.children.push(child); child.parent = this; },
      remove() {
        this.isConnected = false;
        if (this.parent) { this.parent.children = this.parent.children.filter(child => child !== this); }
      },
      animate: vi.fn(() => {
        const animation = { cancel: vi.fn() };
        animations.push(animation);
        return animation;
      })
    };
  }
  const doc = { body: element(), createElement: vi.fn(element), hidden: false, addEventListener: vi.fn() };
  vi.stubGlobal('document', doc);
  return { doc, animations };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null) });
  vi.stubGlobal('Suite', undefined);
});

afterEach(() => {
  Presentation.clearEffects();
  const layers = globalThis.document?.body?.children;
  if (Array.isArray(layers)) { layers.forEach(layer => { layer.isConnected = false; }); }
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Crappy Eights presentation policy', () => {
  it('requires a gesture, both sound controls and a visible page', () => {
    const yes = { unlocked: true, localEnabled: true, masterMuted: false, hidden: false };
    expect(Presentation.soundAllowed(yes)).toBe(true);
    for (const off of [{ unlocked: false }, { localEnabled: false }, { masterMuted: true }, { hidden: true }]) {
      expect(Presentation.soundAllowed({ ...yes, ...off })).toBe(false);
    }
  });

  it('disables travel and celebrations for reduced motion including dynamic preference changes', () => {
    let reduceMotion = false;
    expect(Presentation.effectPolicy(() => reduceMotion)).toMatchObject({ flightDuration: 260, particleCount: 18, maxFlights: 4 });
    reduceMotion = true;
    expect(Presentation.effectPolicy(() => reduceMotion)).toMatchObject({ flightDuration: 0, particleCount: 0, celebrationDuration: 0 });
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    expect(Presentation.effectPolicy().particleCount).toBe(0);
  });
});

describe('Crappy Eights synthesized audio', () => {
  it.each(['select', 'pass', 'ui'])('gives %s immediate, brief feedback only after a gesture and while enabled', type => {
    const { doc } = documentHarness();
    const harness = audioHarness();
    let localEnabled = true;
    const audio = Presentation.createAudio({ readLocalEnabled: () => localEnabled });
    expect(audio.play(type)).toBe(false);
    expect(harness.constructor).not.toHaveBeenCalled();
    audio.unlock();
    expect(audio.play(type)).toBe(true);
    expect(harness.oscillators).toHaveLength(1);
    const voice = harness.oscillators[0];
    expect(voice.start.mock.calls[0][0]).toBeCloseTo(1.008);
    expect(voice.stop.mock.calls[0][0] - voice.start.mock.calls[0][0]).toBeLessThan(0.12);
    localEnabled = false;
    expect(audio.play(type)).toBe(false);
    localEnabled = true;
    globalThis.localStorage.getItem.mockImplementation(key => key === 'turdsuite_muted' ? '1' : null);
    expect(audio.play(type)).toBe(false);
    globalThis.localStorage.getItem.mockReturnValue(null);
    doc.hidden = true;
    expect(audio.play(type)).toBe(false);
    expect(harness.oscillators).toHaveLength(1);
  });

  it('never creates audio before a gesture or when either mute setting blocks playback', () => {
    documentHarness();
    const harness = audioHarness();
    let localEnabled = false;
    const audio = Presentation.createAudio({ readLocalEnabled: () => localEnabled });
    expect(audio.play('play')).toBe(false);
    audio.unlock();
    expect(harness.constructor).not.toHaveBeenCalled();
    localEnabled = true;
    globalThis.localStorage.getItem.mockImplementation(key => key === 'turdsuite_muted' ? '1' : null);
    expect(audio.play('wild')).toBe(false);
    expect(harness.constructor).not.toHaveBeenCalled();
    globalThis.localStorage.getItem.mockReturnValue(null);
    expect(audio.play('play')).toBe(true);
    expect(harness.constructor).toHaveBeenCalledTimes(1);
    expect(harness.oscillators).toHaveLength(2);
  });

  it('honors the persisted local setting and the shared runtime mute', () => {
    documentHarness();
    const harness = audioHarness();
    globalThis.localStorage.getItem.mockImplementation(key => key === 'crapeightsSoundOn_v1' ? '0' : null);
    const audio = Presentation.createAudio();
    audio.unlock();
    expect(audio.play('win')).toBe(false);
    globalThis.localStorage.getItem.mockReturnValue(null);
    vi.stubGlobal('Suite', { isMuted: () => true });
    expect(audio.play('win')).toBe(false);
    expect(harness.constructor).not.toHaveBeenCalled();
  });

  it('cuts off scheduled voices when muted and does not play in a hidden tab', () => {
    const { doc } = documentHarness();
    const { oscillators, outputs } = audioHarness();
    let enabled = true;
    const audio = Presentation.createAudio({ readLocalEnabled: () => enabled });
    audio.unlock();
    audio.play('win');
    expect(oscillators).toHaveLength(6);
    enabled = false;
    audio.syncMute();
    expect(outputs[0].gain.setValueAtTime).toHaveBeenLastCalledWith(0, 1);
    expect(oscillators.every(voice => voice.stop.mock.calls.length === 2)).toBe(true);
    enabled = true;
    doc.hidden = true;
    expect(audio.play('deal')).toBe(false);
    expect(oscillators).toHaveLength(6);
  });

  it('caps overlapping voices and releases them on completion', () => {
    documentHarness();
    const { oscillators } = audioHarness();
    const audio = Presentation.createAudio();
    audio.unlock();
    for (let i = 0; i < 20; i++) { audio.play('win'); }
    expect(oscillators).toHaveLength(32);
    oscillators.forEach(voice => voice.onended());
    audio.play('draw');
    expect(oscillators).toHaveLength(33);
    expect(audio.play('unknown')).toBe(false);
  });

  it('handles unavailable WebAudio without affecting gameplay', () => {
    documentHarness();
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    const audio = Presentation.createAudio();
    expect(() => audio.unlock()).not.toThrow();
    expect(audio.play('play')).toBe(false);
  });
});

describe('Crappy Eights bounded visual effects', () => {
  const sourceRect = { left: 20, top: 350, width: 60, height: 84 };
  const targetRect = { left: 120, top: 150, width: 75, height: 105 };

  it('skips all DOM work when reduced motion is enabled', () => {
    const { doc } = documentHarness();
    expect(Presentation.flyCard({ source: sourceRect, target: targetRect, reducedMotion: true })).toBe(false);
    expect(Presentation.celebrate({ reducedMotion: true })).toBe(false);
    expect(doc.createElement).not.toHaveBeenCalled();
  });

  it('keeps at most four flights, reads geometry once and removes completed effects', () => {
    const { doc, animations } = documentHarness();
    const source = { getBoundingClientRect: vi.fn(() => sourceRect) };
    const target = { getBoundingClientRect: vi.fn(() => targetRect) };
    for (let i = 0; i < 9; i++) {
      expect(Presentation.flyCard({ source, target, card: { rank: '8', suit: 'H' }, reducedMotion: false })).toBe(true);
    }
    const layer = doc.body.children[0];
    expect(layer.children).toHaveLength(4);
    expect(source.getBoundingClientRect).toHaveBeenCalledTimes(9);
    expect(target.getBoundingClientRect).toHaveBeenCalledTimes(9);
    expect(animations[0].cancel).toHaveBeenCalledTimes(1);
    animations[8].onfinish();
    expect(layer.children).toHaveLength(3);
    vi.runAllTimers();
    expect(layer.children).toHaveLength(0);
  });

  it('caps celebrations across repeated wins and provides explicit cleanup', () => {
    const { doc } = documentHarness();
    for (let i = 0; i < 3; i++) { Presentation.celebrate({ target: targetRect, reducedMotion: false }); }
    const layer = doc.body.children[0];
    expect(layer.children).toHaveLength(18);
    Presentation.clearEffects();
    expect(layer.children).toHaveLength(0);
  });

  it('immediately clears active flights and particles when reduced motion changes', () => {
    const { doc } = documentHarness();
    const query = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', vi.fn(() => query));
    Presentation.flyCard({ source: sourceRect, target: targetRect });
    Presentation.celebrate({ target: targetRect });
    const layer = doc.body.children[0];
    expect(layer.children).toHaveLength(19);
    const [type, listener] = query.addEventListener.mock.calls[0];
    expect(type).toBe('change');
    query.matches = true;
    listener({ matches: true });
    expect(layer.children).toHaveLength(0);
    expect(Presentation.flyCard({ source: sourceRect, target: targetRect })).toBe(false);
    expect(Presentation.celebrate({ target: targetRect })).toBe(false);
  });
});
