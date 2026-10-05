import { describe, it, expect } from 'vitest';
import {
  computeDiscardSafety,
  SAFETY_WEIGHTS,
  DIFFICULTY_KEY,
  DEFAULT_LEVEL,
  AI_PROFILES,
  profileFor,
  activeHumanTakes,
  computeFeedRisk,
  computeKnockThreshold,
  applyScoreNoise,
  loadDifficulty,
  saveDifficulty
} from '../games/turdrummy-ai.js';

const card = (suit, rank, id) => ({ suit, rank, id: id || `${suit}${rank}` });

describe('computeDiscardSafety', () => {
  it('is 0 with no discard history', () => {
    expect(computeDiscardSafety([], card('H', 7))).toBe(0);
    expect(computeDiscardSafety(null, card('H', 7))).toBe(0);
  });

  it('rewards cards whose rank is already dead in the pile', () => {
    const history = [card('C', 7), card('D', 7)];
    const safety = computeDiscardSafety(history, card('H', 7));
    expect(safety).toBe(2 * SAFETY_WEIGHTS.deadRank);
  });

  it('rewards cards whose same-suit run neighbors are already dead', () => {
    const history = [card('H', 5), card('H', 9)];
    // H7: H5 is two away (dead neighbor), H9 is two away (dead neighbor)
    const safety = computeDiscardSafety(history, card('H', 7));
    expect(safety).toBe(2 * SAFETY_WEIGHTS.deadNeighbor);
  });

  it('ignores cards three or more ranks away in the same suit', () => {
    const history = [card('H', 2)];
    expect(computeDiscardSafety(history, card('H', 7))).toBe(0);
  });

  it('ignores same-rank-or-neighbor cards in a different suit for the neighbor check', () => {
    const history = [card('D', 6)];
    expect(computeDiscardSafety(history, card('H', 7))).toBe(0);
  });

  it('never counts the card itself even if present in the history by id', () => {
    const target = card('H', 7);
    const safety = computeDiscardSafety([target], target);
    expect(safety).toBe(0);
  });

  it('combines rank and neighbor signals', () => {
    const history = [card('C', 7), card('H', 6), card('H', 8), card('S', 2)];
    const safety = computeDiscardSafety(history, card('H', 7));
    expect(safety).toBe(1 * SAFETY_WEIGHTS.deadRank + 2 * SAFETY_WEIGHTS.deadNeighbor);
  });
});


function memoryStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
}

describe('computeFeedRisk (avoid feeding the human)', () => {
  it('is zero when the human has taken nothing from the discard', () => {
    expect(computeFeedRisk([], card('H', 7))).toBe(0);
    expect(computeFeedRisk(null, card('H', 7))).toBe(0);
  });

  it('flags a same-rank discard after the human took that rank (set in progress)', () => {
    const takes = [card('C', 7)];
    expect(computeFeedRisk(takes, card('H', 7))).toBe(1);
  });

  it('flags a run neighbour one rank away more than one two ranks away', () => {
    const takes = [card('H', 7)];
    expect(computeFeedRisk(takes, card('H', 8))).toBe(1);
    expect(computeFeedRisk(takes, card('H', 9))).toBe(0.5);
    expect(computeFeedRisk(takes, card('H', 10))).toBe(0);
  });

  it('ignores same-rank-neighbour cards of another suit for runs', () => {
    expect(computeFeedRisk([card('H', 7)], card('S', 8))).toBe(0);
  });

  it('adds up across several takes and never counts the card against itself', () => {
    const takes = [card('H', 7), card('C', 7), card('H', 6)];
    expect(computeFeedRisk(takes, card('H', 7))).toBe(1 + 1);
    expect(computeFeedRisk([card('H', 7)], card('H', 7))).toBe(0);
  });
});

describe('activeHumanTakes', () => {
  it('drops a taken card once the human threw it back to the discard', () => {
    const takes = [card('H', 7), card('C', 9)];
    const discard = [card('C', 9)];
    expect(activeHumanTakes(takes, discard).map((c) => c.id)).toEqual(['H7']);
  });

  it('is empty for empty or missing input', () => {
    expect(activeHumanTakes([], [])).toEqual([]);
    expect(activeHumanTakes(undefined, [])).toEqual([]);
  });
});

describe('difficulty profiles', () => {
  it('ships three levels, with Normal as the default', () => {
    expect(Object.keys(AI_PROFILES).sort()).toEqual(['easy', 'normal', 'sharp']);
    expect(DEFAULT_LEVEL).toBe('normal');
  });

  it('falls back to Normal for unknown levels', () => {
    expect(profileFor('nightmare').level).toBe('normal');
    expect(profileFor(undefined).level).toBe('normal');
  });

  it('makes Easy blind to the human memory and noisy, and Sharp the most memory-driven', () => {
    expect(profileFor('easy').feedRiskBias).toBe(0);
    expect(profileFor('easy').scoreNoise).toBeGreaterThan(0);
    expect(profileFor('normal').scoreNoise).toBe(0);
    expect(profileFor('sharp').feedRiskBias).toBeGreaterThan(profileFor('normal').feedRiskBias);
  });
});

describe('computeKnockThreshold', () => {
  it('leaves Normal at the base threshold early in a round', () => {
    expect(computeKnockThreshold({ baseThreshold: 6, profile: profileFor('normal'), aiTurns: 2, stockCount: 20 })).toBe(6);
  });

  it('knocks a point earlier under stock pressure once the round has run a while', () => {
    const input = { baseThreshold: 6, profile: profileFor('normal'), aiTurns: 7, stockCount: 3 };
    expect(computeKnockThreshold(input)).toBe(7);
  });

  it('applies the level offset: Easy waits, Sharp presses', () => {
    const base = { baseThreshold: 6, aiTurns: 2, stockCount: 20 };
    expect(computeKnockThreshold({ ...base, profile: profileFor('easy') })).toBe(4);
    expect(computeKnockThreshold({ ...base, profile: profileFor('sharp') })).toBe(7);
  });

  it('stays inside [3, knockLimit]', () => {
    expect(computeKnockThreshold({ baseThreshold: 1, profile: profileFor('easy'), aiTurns: 0, stockCount: 30 })).toBe(3);
    expect(computeKnockThreshold({ baseThreshold: 12, profile: profileFor('sharp'), aiTurns: 9, stockCount: 1 })).toBe(10);
  });
});

describe('applyScoreNoise', () => {
  it('returns the score untouched when the level has no noise (Normal, Sharp)', () => {
    expect(applyScoreNoise(4, 0, () => 0.9)).toBe(4);
  });

  it('keeps the wobble within the amplitude, given an injected rng', () => {
    expect(applyScoreNoise(4, 1.4, () => 0)).toBeCloseTo(4 - 1.4);
    expect(applyScoreNoise(4, 1.4, () => 1)).toBeCloseTo(4 + 1.4);
    expect(applyScoreNoise(4, 1.4, () => 0.5)).toBeCloseTo(4);
  });
});

describe('difficulty persistence', () => {
  it('uses a versioned key and defaults to Normal when nothing is saved', () => {
    expect(DIFFICULTY_KEY).toBe('turdrummyDifficulty_v1');
    expect(loadDifficulty(memoryStorage())).toBe('normal');
  });

  it('round-trips a valid level and rejects a corrupt stored value', () => {
    const storage = memoryStorage();
    expect(saveDifficulty(storage, 'sharp')).toBe('sharp');
    expect(loadDifficulty(storage)).toBe('sharp');
    storage.setItem(DIFFICULTY_KEY, 'chaos');
    expect(loadDifficulty(storage)).toBe('normal');
  });

  it('saves an unknown level as Normal rather than writing garbage', () => {
    const storage = memoryStorage();
    expect(saveDifficulty(storage, 'nightmare')).toBe('normal');
    expect(storage.getItem(DIFFICULTY_KEY)).toBe('normal');
  });
});
