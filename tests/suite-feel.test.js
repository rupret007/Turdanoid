import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';
import {
  TURDANOID_FEEL,
  TURDTRIS_FEEL,
  CARD_TABLE_FEEL,
  scaleLerp,
  lerpToward,
  clampMinBallSpeed,
  nudgeBallOffHorizontalRail,
  decayShake,
  bumpShake,
  ballDangerRatio,
  prefersReducedMotion
} from '../games/suite-feel.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function readPage(name) {
  return readFileSync(join(repoRoot, name), 'utf8');
}

function htmlNumericConst(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*([\\d.]+)`));
  expect(match, `${name} in shipped HTML`).not.toBeNull();
  return Number(match[1]);
}

describe('suite-feel', () => {
  it('prefersReducedMotion reads matchMedia', () => {
    expect(prefersReducedMotion(() => ({ matches: true }))).toBe(true);
    expect(prefersReducedMotion(() => ({ matches: false }))).toBe(false);
    expect(prefersReducedMotion(() => null)).toBe(false);
  });

  it('documents TurdAnoid combo window used in TurdAnoid.html step()', () => {
    expect(TURDANOID_FEEL.comboWindowFrames).toBe(105);
  });

  it('scaleLerp is ~1 at large ts and 0 at ts=0', () => {
    expect(scaleLerp(0.4, 0)).toBe(0);
    expect(scaleLerp(0.4, 1)).toBeCloseTo(0.4);
    expect(scaleLerp(0.4, 60)).toBeGreaterThan(0.99);
  });

  it('lerpToward approaches the target', () => {
    expect(lerpToward(10, 20, 0.5)).toBe(15);
  });

  it('clampMinBallSpeed lifts slow horizontal grinds', () => {
    const { vx, vy } = clampMinBallSpeed(0.8, 0.2, 4.25);
    expect(Math.hypot(vx, vy)).toBeCloseTo(4.25);
  });

  it('nudgeBallOffHorizontalRail keeps speed but adds vertical motion', () => {
    const { vx, vy } = nudgeBallOffHorizontalRail(5.5, 0.05, 0.2);
    expect(Math.hypot(vx, vy)).toBeCloseTo(5.5, 1);
    expect(Math.abs(vy) / Math.hypot(vx, vy)).toBeGreaterThanOrEqual(0.2);
  });

  it('card table AI pacing constants are positive and ordered', () => {
    expect(CARD_TABLE_FEEL.crapeightsAiMs).toBeLessThan(800);
    expect(CARD_TABLE_FEEL.turdrummyQuickAiMs).toBeLessThan(CARD_TABLE_FEEL.turdrummyAiMs);
    expect(CARD_TABLE_FEEL.turdspadesAiMs).toBeGreaterThan(300);
  });

  it('decayShake and bumpShake behave like TurdAnoid screen shake', () => {
    expect(decayShake(10, 1)).toBeCloseTo(9.4);
    expect(bumpShake(2, 7)).toBe(7);
    expect(bumpShake(9, 4)).toBe(9);
  });

  it('ballDangerRatio peaks for fast balls near the paddle zone', () => {
    const H = 600;
    const low = ballDangerRatio([{ vy: 5, y: 200, r: 10, stuck: false }], H, 550);
    const high = ballDangerRatio([{ vy: 5, y: 520, r: 10, stuck: false }], H, 550);
    expect(low).toBe(0);
    expect(high).toBeGreaterThan(0.5);
  });

  it('documents Turdtris danger HUD pulse threshold', () => {
    expect(TURDTRIS_FEEL.dangerHudPulseRatio).toBeGreaterThan(0.4);
    expect(TURDTRIS_FEEL.dangerHudPulseRatio).toBeLessThan(0.75);
  });

  it('keeps TurdAnoid.html FEEL_* constants aligned with games/suite-feel.js', () => {
    const page = readPage('TurdAnoid.html');
    expect(htmlNumericConst(page, 'FEEL_COMBO_FRAMES')).toBe(TURDANOID_FEEL.comboWindowFrames);
    expect(htmlNumericConst(page, 'FEEL_POINTER_LERP')).toBe(TURDANOID_FEEL.pointerLerpPerFrame);
    expect(htmlNumericConst(page, 'FEEL_POINTER_LERP_TOUCH')).toBe(TURDANOID_FEEL.pointerLerpTouchPerFrame);
    expect(htmlNumericConst(page, 'FEEL_MIN_BALL_SPEED')).toBe(TURDANOID_FEEL.minBallSpeed);
    expect(htmlNumericConst(page, 'FEEL_MIN_BALL_VERTICAL')).toBe(TURDANOID_FEEL.minBallVerticalRatio);
    expect(htmlNumericConst(page, 'FEEL_PADDLE_ENGLISH')).toBe(TURDANOID_FEEL.paddleEnglish);
    expect(htmlNumericConst(page, 'FEEL_SHAKE_DECAY')).toBe(TURDANOID_FEEL.shakeDecayPerFrame);
    expect(htmlNumericConst(page, 'FEEL_HIT_STOP_BREAK')).toBe(TURDANOID_FEEL.hitStopFramesOnBreak);
    expect(htmlNumericConst(page, 'FEEL_BALL_DANGER_START')).toBe(TURDANOID_FEEL.ballDangerStartRatio);
  });

  it('keeps turdtris.html danger HUD threshold aligned with games/suite-feel.js', () => {
    const page = readPage('turdtris.html');
    expect(htmlNumericConst(page, 'FEEL_DANGER_HUD_RATIO')).toBe(TURDTRIS_FEEL.dangerHudPulseRatio);
    expect(htmlNumericConst(page, 'FEEL_SHAKE_DECAY')).toBe(TURDTRIS_FEEL.shakeDecayPerFrame);
    expect(htmlNumericConst(page, 'FEEL_LEVEL_FLASH_FRAMES')).toBe(TURDTRIS_FEEL.levelFlashFrames);
  });

  it('keeps card-table bot pacing aligned with CARD_TABLE_FEEL', () => {
    const eights = readPage('crapeights.html');
    const rummy = readPage('turdrummy.html');
    const spades = readPage('turdspades.html');
    expect(eights).toContain(`}, ${CARD_TABLE_FEEL.crapeightsAiMs});`);
    expect(rummy).toContain(`queueAiTurn(${CARD_TABLE_FEEL.turdrummyQuickAiMs})`);
    expect(rummy).toContain(`queueAiTurn(${CARD_TABLE_FEEL.turdrummyAiMs})`);
    expect(spades).toContain(`const AI_TURN_MS = ${CARD_TABLE_FEEL.turdspadesAiMs}`);
  });

  it('documents unchanged localStorage keys for the six-game suite', () => {
    const pages = {
      'assets/turdsuite.js': ['turdsuite_muted', 'turdsuite_continue_v1', 'turdsuite_last_game'],
      'games/table-continue-core.js': ['turdsuite_guides_seen_v1'],
      'TurdAnoid.html': ['turdanoid_v2_best', 'turdanoid_v2_sound'],
      'turdtris.html': ['turdtrisHighScore', 'turdtrisSoundOn_v1'],
      'turdjack.html': ['turdjackBankroll', 'turdjackStats', 'turdjackSoundOn_v1'],
      'crapeights.html': ['crapeightsStats', 'crapeightsSoundOn_v1'],
      'turdrummy.html': ['turdrummy_stats_v1']
    };
    for (const [file, keys] of Object.entries(pages)) {
      const src = readPage(file);
      for (const key of keys) {
        expect(src, `${file} still references ${key}`).toContain(key);
      }
    }
  });
});
