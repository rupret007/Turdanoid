import { describe, expect, it } from 'vitest';
import {
  EXTRA_PATTERN_NAMES,
  allPatternNames,
  shouldPlaceBrick,
  campaignLevelCount,
  definitionForLevel,
  buildCampaignCells,
  campaignMetrics,
  isClearable,
  isBreakable,
  remainingBreakable,
  applyDamage,
  computeBallSpeed,
  computeDropChance,
  hazardIntervalFrames,
  collectDripSpawns,
  hazardHitsPaddle
} from '../games/turdanoid-levels.js';

describe('Turdanoid campaign definitions', () => {
  const metrics = campaignMetrics();

  it('ships 30 unique named layouts', () => {
    expect(campaignLevelCount()).toBe(30);
    expect(metrics).toHaveLength(30);
    const names = new Set(metrics.map((m) => m.name));
    const fingerprints = new Set(metrics.map((m) => m.fingerprint));
    expect(names.size).toBe(30);
    expect(fingerprints.size).toBe(30);
    for (const m of metrics) {
      expect(m.cols).toBe(11);
      expect(m.rows).toBeGreaterThanOrEqual(2);
      expect(m.breakableCount).toBeGreaterThan(0);
      expect(definitionForLevel(m.level).name).toBe(m.name);
    }
  });

  it('keeps every required brick clearable from below', () => {
    for (let level = 1; level <= 30; level += 1) {
      const def = definitionForLevel(level);
      expect(isClearable(def.grid), `level ${level} ${def.name}`).toBe(true);
    }
  });

  it('climbs brick HP, speed, and hazards without dips', () => {
    for (let i = 1; i < metrics.length; i += 1) {
      const prev = metrics[i - 1];
      const cur = metrics[i];
      expect(cur.brickHpTotal, `HP ${prev.level}->${cur.level}`).toBeGreaterThanOrEqual(
        prev.brickHpTotal
      );
      expect(cur.speed, `speed ${prev.level}->${cur.level}`).toBeGreaterThanOrEqual(prev.speed);
      expect(cur.hazardCount, `hazards ${prev.level}->${cur.level}`).toBeGreaterThanOrEqual(
        prev.hazardCount
      );
    }
  });

  it('keeps early levels approachable and introduces tools on schedule', () => {
    expect(metrics[0].brickHpTotal).toBeLessThanOrEqual(24);
    expect(metrics[0].multiHitCount).toBe(0);
    expect(metrics[1].multiHitCount).toBe(0);
    expect(metrics[4].multiHitCount).toBeGreaterThan(0);
    expect(metrics[5].indestructibleCount).toBeGreaterThan(0);
    expect(metrics[5].bossBeat).toBe(true);
    expect(metrics[8].metalCount).toBeGreaterThan(0);
    expect(metrics[10].hazardCount).toBe(1);
    expect(metrics.slice(0, 10).every((m) => m.hazardCount === 0)).toBe(true);
    expect(metrics[29].bossBeat).toBe(true);
    expect(metrics[29].goldCount).toBeGreaterThan(0);
    expect(metrics[29].hazardCount).toBeGreaterThanOrEqual(8);
  });

  it('matches the shipped ball-speed and drop-chance contracts', () => {
    expect(computeBallSpeed(1)).toBeCloseTo(5.56);
    expect(computeBallSpeed(30)).toBeCloseTo(8.4);
    expect(computeDropChance(1, 100)).toBeCloseTo(0.32);
    expect(computeDropChance(30, 100)).toBeCloseTo(0.12);
    expect(computeDropChance(1, 10)).toBeCloseTo(0.38);
    expect(metrics[0].speed).toBeLessThan(metrics[10].speed);
    expect(metrics[0].dropChance).toBeGreaterThan(metrics[29].dropChance);
  });

  it('builds cells that match the grid alphabet', () => {
    const cells = buildCampaignCells(16);
    expect(cells.some((c) => c.indestructible)).toBe(true);
    expect(cells.some((c) => c.hazard === 'drip')).toBe(true);
    expect(cells.every((c) => c.hp >= 1)).toBe(true);
    expect(cells.filter((c) => c.indestructible).every((c) => c.hp >= 99)).toBe(true);
  });

  it('treats steel as blocking and not required', () => {
    const steel = { hp: 99, indestructible: true };
    const soft = { hp: 2, indestructible: false };
    expect(isBreakable(steel)).toBe(false);
    expect(isBreakable(soft)).toBe(true);
    expect(applyDamage(steel, 4)).toEqual({ destroyed: false, blocked: true });
    expect(applyDamage(soft, 2)).toEqual({ destroyed: true, blocked: false });
    expect(remainingBreakable([steel, soft, { hp: 1 }])).toBe(2);
    expect(remainingBreakable([steel, { hp: 0, indestructible: true }])).toBe(0);
  });

  it('spawns drips from hazard bricks on a slowing interval', () => {
    expect(hazardIntervalFrames(11)).toBeGreaterThan(hazardIntervalFrames(30));
    const brick = { x: 10, y: 20, w: 20, h: 10, hazard: 'drip', hazardCd: 0 };
    const first = collectDripSpawns([brick], 1, 12);
    expect(first).toHaveLength(1);
    expect(first[0].y).toBe(30);
    expect(collectDripSpawns([brick], 1, 12)).toHaveLength(0);
    brick.hazardCd = 0;
    expect(collectDripSpawns([{ x: 0, y: 0, w: 8, h: 8 }], 8, 12)).toHaveLength(0);
  });

  it('only counts a drip that still overlaps the paddle band', () => {
    const paddle = { x: 100, y: 400, w: 80, h: 18 };
    expect(hazardHitsPaddle({ x: 100, y: 408, r: 8 }, paddle)).toBe(true);
    expect(hazardHitsPaddle({ x: 100, y: 400, r: 8 }, paddle)).toBe(true);
    expect(hazardHitsPaddle({ x: 100, y: 430, r: 8 }, paddle)).toBe(false);
    expect(hazardHitsPaddle({ x: 100, y: 450, r: 8 }, paddle)).toBe(false);
    expect(hazardHitsPaddle({ x: 200, y: 408, r: 8 }, paddle)).toBe(false);
    expect(hazardHitsPaddle(null, paddle)).toBe(false);
  });

  it('rejects a boxed-in required brick as uncleared', () => {
    expect(isClearable(['XXX', 'X1X', 'XXX'])).toBe(false);
    expect(isClearable(['X.X', 'X1X', 'X.X'])).toBe(true);
  });
});

describe('Turdanoid extra layouts (legacy stamps)', () => {
  it('still exposes the five bonus pattern stamps', () => {
    expect(EXTRA_PATTERN_NAMES).toHaveLength(5);
    expect(allPatternNames().length).toBe(18);
  });

  it('Fortress still leaves a hollow core', () => {
    const cols = 10;
    const rows = 6;
    let innerOpen = false;
    for (let r = 1; r < rows - 1; r += 1) {
      for (let c = 1; c < cols - 1; c += 1) {
        if (!shouldPlaceBrick('Fortress', c, r, cols, rows, 5)) {
          innerOpen = true;
        }
      }
    }
    expect(innerOpen).toBe(true);
  });
});
