/* Brick materials, palettes, and crack stages for TurdAnoid rendering. */
(function attachTurdanoidBrick(root) {
  'use strict';

  const MATERIALS = ['porcelain', 'sewer', 'slime', 'candy', 'tar', 'metal', 'gold'];

  const MATERIAL_PALETTES = {
    porcelain: ['#f2f8f5', '#9eb8aa', 'rgba(200,230,215,.5)'],
    sewer: ['#7af1c4', '#3aa97c', 'rgba(122,241,196,.45)'],
    slime: ['#b8ff7a', '#3d8a2a', 'rgba(160,255,120,.5)'],
    candy: ['#ff9de8', '#c23d8a', 'rgba(255,157,232,.48)'],
    tar: ['#6a6a78', '#2a2a34', 'rgba(120,120,140,.4)'],
    metal: ['#c8d4e0', '#5a6a78', 'rgba(180,200,220,.45)'],
    gold: ['#fff0b0', '#bf8a13', 'rgba(255,215,106,.55)']
  };

  const ROW_PALETTES = [
    ['#5dffb8', '#1e9a62', 'rgba(93,255,184,.55)'],
    ['#5ce8ff', '#1580b0', 'rgba(92,232,255,.55)'],
    ['#ffe04a', '#c87800', 'rgba(255,224,74,.55)'],
    ['#ff8a4a', '#b03810', 'rgba(255,138,74,.55)'],
    ['#ff5aa8', '#a01868', 'rgba(255,90,168,.55)'],
    ['#a878ff', '#4820b0', 'rgba(168,120,255,.55)']
  ];

  /** Rotates rainbow rows per campaign world so walls read differently in play. */
  const WORLD_ROW_ROTATIONS = [0, 1, 2, 3, 4];

  const DISTINCT_MATERIALS = new Set(['metal', 'gold', 'porcelain', 'slime', 'candy', 'tar']);

  /**
   * 0 = pristine, 3 = heavily cracked (hp nearly gone).
   */
  function crackStage(hp, maxHp) {
    const max = Math.max(1, maxHp || 1);
    const h = Math.max(0, hp || 0);
    const dmg = 1 - h / max;
    if (dmg <= 0.2) {
      return 0;
    }
    if (dmg <= 0.45) {
      return 1;
    }
    if (dmg <= 0.7) {
      return 2;
    }
    return 3;
  }

  function pickMaterial(row, col, level, rng = Math.random) {
    if (level >= 10 && rng() < 0.08) {
      return 'tar';
    }
    if (level >= 6 && row === 0 && rng() < 0.35) {
      return 'porcelain';
    }
    if (level >= 4 && (row + col) % 5 === 0 && rng() < 0.55) {
      return 'slime';
    }
    if (level >= 8 && rng() < 0.12) {
      return 'candy';
    }
    if (rng() < 0.25) {
      return 'sewer';
    }
    return 'sewer';
  }

  function rowPaletteIndex(row, rows, col, worldIndex) {
    const bands = ROW_PALETTES.length;
    const rowBand = Math.min(bands - 1, Math.floor((row / Math.max(1, rows - 1)) * bands));
    const rot = WORLD_ROW_ROTATIONS[Math.abs(worldIndex | 0) % WORLD_ROW_ROTATIONS.length] || 0;
    const zig = (col % 2) * (rows > 4 ? 1 : 0);
    return (rowBand + rot + zig) % bands;
  }

  function brickColors(row, rows, material, col = 0, worldIndex = 0) {
    if (material && DISTINCT_MATERIALS.has(material) && MATERIAL_PALETTES[material]) {
      const p = MATERIAL_PALETTES[material];
      return { c1: p[0], c2: p[1], glow: p[2], material };
    }
    const pal = ROW_PALETTES[rowPaletteIndex(row, rows, col, worldIndex)];
    return { c1: pal[0], c2: pal[1], glow: pal[2], material: material || 'sewer' };
  }

  function assignBrickStyle(row, rows, col, level, rng, worldIndex = 0) {
    const material = pickMaterial(row, col, level, rng);
    const colors = brickColors(row, rows, material, col, worldIndex);
    return colors;
  }

  function distinctRowHueCount(rows, worldIndex = 0) {
    const seen = new Set();
    const cols = 10;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const { c1 } = brickColors(r, rows, 'sewer', c, worldIndex);
        seen.add(c1);
      }
    }
    return seen.size;
  }

  root.TurdanoidBrick = {
    MATERIALS,
    MATERIAL_PALETTES,
    ROW_PALETTES,
    WORLD_ROW_ROTATIONS,
    crackStage,
    pickMaterial,
    rowPaletteIndex,
    brickColors,
    assignBrickStyle,
    distinctRowHueCount
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
