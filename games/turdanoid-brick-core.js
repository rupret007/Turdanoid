/* Brick materials, palettes, and crack stages for TurdAnoid rendering. */
(function attachTurdanoidBrick(root) {
  'use strict';

  const MATERIALS = ['porcelain', 'sewer', 'slime', 'candy', 'tar'];

  const MATERIAL_PALETTES = {
    porcelain: ['#f2f8f5', '#9eb8aa', 'rgba(200,230,215,.5)'],
    sewer: ['#7af1c4', '#3aa97c', 'rgba(122,241,196,.45)'],
    slime: ['#b8ff7a', '#3d8a2a', 'rgba(160,255,120,.5)'],
    candy: ['#ff9de8', '#c23d8a', 'rgba(255,157,232,.48)'],
    tar: ['#6a6a78', '#2a2a34', 'rgba(120,120,140,.4)']
  };

  const ROW_PALETTES = [
    ['#7af1c4', '#3aa97c', 'rgba(122,241,196,.45)'],
    ['#7ae6ff', '#2c8aaa', 'rgba(122,230,255,.45)'],
    ['#ffd76a', '#bf8a13', 'rgba(255,215,106,.45)'],
    ['#ff9d74', '#a64b21', 'rgba(255,157,116,.45)'],
    ['#ff7ab6', '#a3306e', 'rgba(255,122,182,.45)'],
    ['#b290ff', '#5b3eb8', 'rgba(178,144,255,.45)']
  ];

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

  function brickColors(row, rows, material) {
    if (material && MATERIAL_PALETTES[material]) {
      const p = MATERIAL_PALETTES[material];
      return { c1: p[0], c2: p[1], glow: p[2], material };
    }
    const t = row / Math.max(1, rows - 1);
    const i = Math.min(ROW_PALETTES.length - 1, Math.floor(t * ROW_PALETTES.length));
    const pal = ROW_PALETTES[i];
    return { c1: pal[0], c2: pal[1], glow: pal[2], material: 'sewer' };
  }

  function assignBrickStyle(row, rows, col, level, rng) {
    const material = pickMaterial(row, col, level, rng);
    const colors = brickColors(row, rows, material);
    return colors;
  }

  root.TurdanoidBrick = {
    MATERIALS,
    MATERIAL_PALETTES,
    crackStage,
    pickMaterial,
    brickColors,
    assignBrickStyle
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
