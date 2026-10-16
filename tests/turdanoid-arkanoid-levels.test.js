import { describe, expect, it } from 'vitest';
import {
  CELL_TYPES,
  CAMPAIGN_COLS,
  MIN_BRICK_W,
  MIN_BRICK_H,
  brickGeometry,
  campaignLevelCount,
  definitionForLevel,
  buildCampaignCells,
  campaignMetrics,
  isClearable
} from '../games/turdanoid-levels.js';

const LEVELS = Array.from({ length: campaignLevelCount() }, (_, i) => definitionForLevel(i + 1));
const COLOUR = /^[a-f]$/;

describe('Arkanoid-style campaign data', () => {
  it('uses only known cells on a 9-wide grid in every round', () => {
    expect(CAMPAIGN_COLS).toBe(9);
    expect(LEVELS.length).toBeGreaterThanOrEqual(12);
    for (const def of LEVELS) {
      expect(def.grid.length, def.name).toBe(def.rows);
      expect(def.rows, def.name).toBeLessThanOrEqual(11);
      for (const row of def.grid) {
        expect(row.length, `${def.name} "${row}"`).toBe(9);
        for (const ch of row) {
          expect(ch === '.' || Object.hasOwn(CELL_TYPES, ch), `${def.name} cell ${ch}`).toBe(true);
        }
      }
      expect(def.blurb.length, def.name).toBeGreaterThan(0);
    }
  });

  it('keeps every round clearable from below', () => {
    for (const def of LEVELS) {
      expect(isClearable(def.grid), `level ${def.level} ${def.name}`).toBe(true);
    }
  });

  it('opens with plain colour bands and clusters before tougher bricks', () => {
    for (const def of LEVELS.slice(0, 4)) {
      const cells = def.grid.join('').replace(/\./g, '');
      expect(
        [...cells].every((ch) => COLOUR.test(ch)),
        def.name
      ).toBe(true);
      // Clusters: each colour sits in at most a few contiguous rows.
      for (const row of def.grid) {
        expect(new Set(row.replace(/\./g, '')).size, `${def.name} "${row}"`).toBeLessThanOrEqual(3);
      }
    }
    const round1 = buildCampaignCells(1);
    expect(round1.every((c) => c.hp === 1 && Number.isInteger(c.color))).toBe(true);
  });

  it('introduces silver, steel, metal, drips, gold and tar in order', () => {
    const m = campaignMetrics();
    const first = (pred) => m.findIndex(pred) + 1;
    const firstCell = (ch) => LEVELS.findIndex((d) => d.grid.join('').includes(ch)) + 1;
    expect(first((x) => x.multiHitCount > 0)).toBe(5);
    expect(first((x) => x.indestructibleCount > 0)).toBe(6);
    expect(first((x) => x.metalCount > 0)).toBe(9);
    expect(firstCell('S')).toBe(10);
    expect(first((x) => x.hazardCount > 0)).toBe(11);
    expect(first((x) => x.goldCount > 0)).toBe(19);
    expect(firstCell('T')).toBe(19);
    // Later rounds are shaped pictures, not uniform bands.
    for (const def of LEVELS.slice(12)) {
      expect(
        def.grid.some((row) => row.includes('.')) || def.grid.some((r) => /[XGMTD]/.test(r)),
        def.name
      ).toBe(true);
    }
  });
});

describe('Brick size on phones', () => {
  it('keeps every round at least MIN_BRICK_W x MIN_BRICK_H on a 320px phone', () => {
    expect(MIN_BRICK_W).toBeGreaterThanOrEqual(28);
    expect(MIN_BRICK_H).toBeGreaterThanOrEqual(20);
    for (const H of [568, 640, 700]) {
      for (const def of LEVELS) {
        const g = brickGeometry(320, H, def.cols, def.rows);
        expect(g.bw, `${def.name} @320x${H}`).toBeGreaterThanOrEqual(MIN_BRICK_W);
        expect(g.bh, `${def.name} @320x${H}`).toBeGreaterThanOrEqual(MIN_BRICK_H);
        const right = g.padX + def.cols * g.bw + (def.cols - 1) * g.gap;
        expect(right).toBeLessThanOrEqual(320 - g.padX + 0.001);
        expect(g.top + def.rows * (g.bh + g.rowGap)).toBeLessThanOrEqual(H * 0.6 + 0.001);
      }
    }
  });

  it('is at least 35% wider than the old 11-column wall at 320 and 390', () => {
    for (const W of [320, 390]) {
      const oldW = (W - Math.max(10, W * 0.04) * 2) / 11 - 6;
      expect(brickGeometry(W, 844, 9, 8).bw).toBeGreaterThan(oldW * 1.35);
    }
  });
});

describe('Colour clusters', () => {
  it('gives every plain campaign brick a fixed colour (no random tints)', () => {
    for (let level = 1; level <= campaignLevelCount(); level += 1) {
      for (const cell of buildCampaignCells(level)) {
        if (!cell.material) {
          expect(Number.isInteger(cell.color), `L${level} ${cell.c},${cell.r}`).toBe(true);
        }
      }
    }
  });
});
