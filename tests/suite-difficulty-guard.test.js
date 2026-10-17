/**
 * Unit-level guards for suite-difficulty helpers and source wiring checks.
 * Page-level behavior (real HTML boot, UI changes, game state) is covered in
 * tests/suite-difficulty-page-behavior.test.js, including mutation traps M1–M5.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  applyGravityMs,
  applySpeedMultiplier,
  loadDifficulty,
  normalizeDifficulty,
  saveDifficulty
} from '../games/suite-difficulty.js';
import {
  computeBallSpeedForDifficulty,
  startingLivesForDifficulty
} from '../games/turdanoid_logic.js';
import { loadDifficulty as loadRummyDifficulty, DIFFICULTY_KEY as RUMMY_DIFF_KEY } from '../games/turdrummy-ai.js';
import * as TurdomaniaCore from '../games/turdomania-core.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function memoryStore(initial = {}) {
  const data = { ...initial };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    }
  };
}

describe('suite difficulty guard mutations', () => {
  it('TurdAnoid: hard changes lives and ball speed vs normal', () => {
    const baseLives = 3;
    const level = 4;
    expect(startingLivesForDifficulty(baseLives, 'normal')).toBe(baseLives);
    expect(startingLivesForDifficulty(baseLives, 'hard')).toBe(2);
    const normalSpeed = computeBallSpeedForDifficulty(level, 'normal');
    const hardSpeed = computeBallSpeedForDifficulty(level, 'hard');
    expect(hardSpeed).toBeGreaterThan(normalSpeed);
  });

  it('Turdtris: hard shortens gravity interval vs normal', () => {
    const baseMs = 800;
    const normal = applyGravityMs(baseMs, 'normal');
    const hard = applyGravityMs(baseMs, 'hard');
    expect(normal).toBe(baseMs);
    expect(hard).toBeLessThan(baseMs);
  });

  it('Crappy Eights: suite hard maps to sharp bots, not normal', () => {
    expect(normalizeDifficulty('hard')).toBe('hard');
    expect(normalizeDifficulty('sharp')).toBe('hard');
    const html = readFileSync(join(root, 'crapeights.html'), 'utf8');
    expect(html).toContain("if (id === 'hard') { return 'sharp'; }");
    expect(html).toContain('migrateLegacyEightsDifficulty');
  });

  it('Turdomania: page reads Suite.difficulty before prefs fallback', () => {
    const html = readFileSync(join(root, 'turdomania.html'), 'utf8');
    expect(html).toMatch(/Suite\.difficulty\.get\(\)/);
    expect(html).toContain('suiteBoardLevel');
    expect(html).toContain('.dock:has(.suite-difficulty) #levelSel { display: none; }');
    expect(TurdomaniaCore.LEVELS.hard.kinds).toBeGreaterThan(TurdomaniaCore.LEVELS.normal.kinds);
  });

  it('Turdrummy: shared suite difficulty wins over per-game save', () => {
    const store = memoryStore({
      turdsuite_difficulty_v1: 'hard',
      [RUMMY_DIFF_KEY]: 'easy'
    });
    expect(loadRummyDifficulty(store)).toBe('sharp');
  });

  it('Crappy Eights: drawer change persists turdsuite_difficulty_v1', () => {
    const html = readFileSync(join(root, 'crapeights.html'), 'utf8');
    expect(html).toContain("localStorage.setItem('turdsuite_difficulty_v1', suiteLevel)");
    expect(html).toContain("localStorage.setItem('crapeights_difficulty_v1', aiDifficulty)");
  });

  it('legacy sharp suite value normalizes to hard', () => {
    const store = memoryStore({ turdsuite_difficulty_v1: 'sharp' });
    saveDifficulty(store, loadDifficulty(store));
    expect(loadDifficulty(store)).toBe('hard');
    expect(applySpeedMultiplier(10, loadDifficulty(store))).toBeGreaterThan(10);
  });
});
