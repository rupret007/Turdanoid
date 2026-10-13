import { describe, it, expect } from 'vitest';
import {
  crackStage,
  assignBrickStyle,
  pickMaterial,
  brickColors,
  distinctRowHueCount,
  MATERIALS
} from '../games/turdanoid-brick.js';
import { spriteKey, paintBrickSprite } from '../games/turdanoid-brick-sprite.js';
import { shouldPlaceBrick, allPatternNames, EXTRA_PATTERN_NAMES } from '../games/turdanoid-levels.js';

describe('Turdanoid brick art', () => {
  it('exposes material types', () => {
    expect(MATERIALS.length).toBeGreaterThanOrEqual(4);
  });

  it('escalates crack stage as HP falls', () => {
    expect(crackStage(3, 3)).toBe(0);
    expect(crackStage(2, 3)).toBeGreaterThanOrEqual(1);
    expect(crackStage(1, 3)).toBeGreaterThanOrEqual(2);
  });

  it('assigns palette + material deterministically with rng', () => {
    const a = assignBrickStyle(0, 6, 0, 1, () => 0.1);
    const b = assignBrickStyle(0, 6, 0, 1, () => 0.1);
    expect(a).toEqual(b);
    expect(a.c1).toMatch(/^#/);
    expect(a.material).toBeTruthy();
  });

  it('can pick porcelain on top rows at higher levels', () => {
    expect(pickMaterial(0, 2, 8, () => 0)).toBe('porcelain');
  });

  it('uses distinct ceramic row glazes for sewer bricks (not one flat mint)', () => {
    const top = brickColors(0, 6, 'sewer', 0, 0);
    const mid = brickColors(3, 6, 'sewer', 0, 0);
    const bot = brickColors(5, 6, 'sewer', 0, 0);
    expect(top.c1).not.toBe(mid.c1);
    expect(mid.c1).not.toBe(bot.c1);
    expect(distinctRowHueCount(6, 0)).toBeGreaterThanOrEqual(4);
  });

  it('rotates row hues per world index', () => {
    const w0 = brickColors(0, 6, 'sewer', 0, 0);
    const w2 = brickColors(0, 6, 'sewer', 0, 2);
    expect(w0.c1).not.toBe(w2.c1);
  });

  it('sprite cache keys include brick fill colors', () => {
    const a = spriteKey('sewer', 0, false, 40, 18, '#ff0000', '#880000');
    const b = spriteKey('sewer', 0, false, 40, 18, '#00ff00', '#008800');
    expect(a).not.toBe(b);
  });

  it('paints ceramic bricks with an inset bevel instead of a candy wash', () => {
    const calls = [];
    const gradient = { addColorStop() {} };
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      shadowColor: '',
      shadowBlur: 0,
      lineWidth: 1,
      clearRect() { calls.push('clearRect'); },
      save() { calls.push('save'); },
      restore() { calls.push('restore'); },
      beginPath() {},
      closePath() {},
      fill() { calls.push('fill'); },
      stroke() {},
      fillRect() {},
      moveTo() {},
      lineTo() {},
      arcTo() {},
      arc() {},
      ellipse() {},
      clip() { calls.push('clip'); },
      createLinearGradient() { return gradient; },
      createRadialGradient() { return gradient; }
    };
    const drawn = paintBrickSprite(ctx, 40, 18, {
      material: 'sewer',
      crackStage: 0,
      c1: '#3ecf9a',
      c2: '#1a7a58'
    });
    expect(drawn.ceramic).toBe(true);
    expect(drawn.extruded).toBe(true);
    expect(calls).toContain('clip');
  });
});

describe('Turdanoid extra layouts', () => {
  it('adds five handcrafted patterns', () => {
    expect(EXTRA_PATTERN_NAMES).toHaveLength(5);
    expect(allPatternNames().length).toBe(18);
  });

  it('Fortress leaves a hollow core', () => {
    const cols = 10;
    const rows = 6;
    let innerOpen = false;
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        if (!shouldPlaceBrick('Fortress', c, r, cols, rows, 5)) {
          innerOpen = true;
        }
      }
    }
    expect(innerOpen).toBe(true);
  });
});
