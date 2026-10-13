import { describe, expect, it } from 'vitest';
import {
  THEME_ID,
  THEME_NAME,
  TOKENS,
  materialPalettes,
  rowPalettes,
  worlds,
  hexToRgb,
  contrastRatio,
  meetsContrast,
  applyCssVars,
  cssVarNames,
  tokenNames
} from '../games/turdanoid-theme.js';
import { MATERIAL_PALETTES, ROW_PALETTES } from '../games/turdanoid-brick.js';
import { WORLDS } from '../games/turdanoid-worlds.js';

describe('Turdanoid theme tokens', () => {
  it('names the midnight porcelain art direction', () => {
    expect(THEME_ID).toBe('midnight-porcelain');
    expect(THEME_NAME).toMatch(/Porcelain/i);
    expect(tokenNames().length).toBeGreaterThanOrEqual(20);
  });

  it('keeps body text readable on the ink stage', () => {
    expect(meetsContrast(TOKENS.inkText, TOKENS.inkDeep, 7)).toBe(true);
    expect(meetsContrast(TOKENS.mutedText, TOKENS.inkDeep, 4.5)).toBe(true);
    expect(meetsContrast(TOKENS.brass, TOKENS.inkDeep, 4.5)).toBe(true);
    expect(meetsContrast(TOKENS.slime, TOKENS.inkDeep, 3)).toBe(true);
    expect(meetsContrast(TOKENS.coral, TOKENS.inkDeep, 3)).toBe(true);
  });

  it('parses hex and reports contrast symmetrically', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#0a1820')).toEqual({ r: 10, g: 24, b: 32 });
    expect(contrastRatio(TOKENS.inkText, TOKENS.inkDeep)).toBeCloseTo(
      contrastRatio(TOKENS.inkDeep, TOKENS.inkText),
      5
    );
  });

  it('applies every CSS variable onto a style target', () => {
    const names = cssVarNames();
    expect(names).toContain('--ta-ink');
    expect(names).toContain('--ta-brass');
    const props = {};
    const el = {
      style: {
        setProperty(name, value) {
          props[name] = value;
        }
      }
    };
    expect(applyCssVars(el)).toBe(names.length);
    expect(props['--ta-ink']).toBe(TOKENS.ink);
    expect(props['--ta-font']).toContain('Segoe UI');
  });
});

describe('Turdanoid theme consumed by bricks and worlds', () => {
  it('exposes six distinct ceramic row glazes', () => {
    const rows = rowPalettes();
    expect(rows).toHaveLength(6);
    const tops = new Set(rows.map((p) => p[0]));
    expect(tops.size).toBe(6);
    expect(ROW_PALETTES).toEqual(rows);
  });

  it('keeps material palettes aligned with the theme book', () => {
    const mats = materialPalettes();
    expect(Object.keys(mats).sort()).toEqual(Object.keys(MATERIAL_PALETTES).sort());
    expect(MATERIAL_PALETTES.gold[0]).toBe(TOKENS.gold);
    expect(MATERIAL_PALETTES.porcelain[0]).toBe(TOKENS.porcelain);
    expect(MATERIAL_PALETTES.sewer[0]).toBe(TOKENS.slime);
  });

  it('skins five worlds from the same token family', () => {
    const themed = worlds();
    expect(themed).toHaveLength(5);
    expect(WORLDS.map((w) => w.id)).toEqual(themed.map((w) => w.id));
    expect(WORLDS[0].accent).toBe(TOKENS.porcelainDim);
    expect(WORLDS[1].accent).toBe(TOKENS.slime);
    expect(WORLDS[3].accent).toBe(TOKENS.rose);
    expect(WORLDS[4].accent).toBe(TOKENS.brass);
    const accents = new Set(WORLDS.map((w) => w.accent));
    expect(accents.size).toBe(5);
    expect(WORLDS.map((w) => w.stage.tile)).toEqual(['square', 'bond', 'algae', 'diamond', 'slab']);
  });
});
