/* Extra wall patterns beyond the original 13 — keeps scoring/level count unchanged. */
(function attachTurdanoidLevels(root) {
  'use strict';

  const EXTRA_PATTERN_NAMES = [
    'Fortress',
    'Ring',
    'Columns',
    'Plunger X',
    'Drip Wall'
  ];

  const BASE_PATTERN_NAMES = [
    'Classic Wall',
    'Checker',
    'Tunnel',
    'Wave',
    'Pyramid',
    'Diamond',
    'Cross',
    'Spiral',
    'Hourglass',
    'Brick House',
    'Skull',
    'Funhouse',
    'Sewer Maze'
  ];

  function allPatternNames() {
    return BASE_PATTERN_NAMES.concat(EXTRA_PATTERN_NAMES);
  }

  function shouldPlaceExtra(pat, c, r, cols, rows, level) {
    const cc = (cols - 1) / 2;
    const rc = (rows - 1) / 2;
    switch (pat) {
    case 'Fortress':
      return (
        r === 0 ||
          r === rows - 1 ||
          c === 0 ||
          c === cols - 1 ||
          (r === Math.floor(rows / 2) && c > 1 && c < cols - 2)
      );
    case 'Ring': {
      const dist = Math.abs(c - cc) + Math.abs(r - rc);
      return dist >= 2 && dist <= rows * 0.55;
    }
    case 'Columns':
      return c % 2 === 0 || r < 2;
    case 'Plunger X':
      return Math.abs(c - cc) <= 1.2 || Math.abs(r - rc) <= 1.2;
    case 'Drip Wall':
      return r >= Math.floor((Math.sin(c * 0.85 + level * 0.2) + 1) * 0.35 * rows);
    default:
      return true;
    }
  }

  function shouldPlaceBrick(pat, c, r, cols, rows, level) {
    if (EXTRA_PATTERN_NAMES.includes(pat)) {
      return shouldPlaceExtra(pat, c, r, cols, rows, level);
    }
    switch (pat) {
    case 'Checker':
      return (c + r) % 2 === 0;
    case 'Tunnel':
      return !(c > 1 && c < cols - 2 && r > 0 && r < rows - 1);
    case 'Wave':
      return (r + Math.round(Math.sin(c * 0.7) * 1.5)) % 2 === 0;
    case 'Pyramid':
      return c >= r && c < cols - r;
    case 'Diamond': {
      const cc2 = cols / 2 - 0.5;
      const rc2 = rows / 2 - 0.5;
      return Math.abs(c - cc2) + Math.abs(r - rc2) < rows * 0.6;
    }
    case 'Cross':
      return Math.abs(c - (cols - 1) / 2) < 2 || Math.abs(r - (rows - 1) / 2) < 2;
    case 'Spiral':
      return (c + r) % 3 !== 0;
    case 'Hourglass':
      return !(
        r > rows * 0.3 &&
          r < rows * 0.7 &&
          (c < cols * 0.3 || c > cols * 0.7)
      );
    case 'Brick House':
      return r % 2 === 0 ? c % 2 === 0 : c % 2 === 1;
    case 'Skull':
      return !((r === 0 && (c < 2 || c > cols - 3)) || (r === rows - 1 && c % 2 === 0));
    case 'Funhouse':
      return Math.random() > 0.18;
    case 'Sewer Maze':
      return !((r % 2 === 1) && c % 3 === 0);
    case 'Classic Wall':
    default:
      return true;
    }
  }

  root.TurdanoidLevels = {
    BASE_PATTERN_NAMES,
    EXTRA_PATTERN_NAMES,
    allPatternNames,
    shouldPlaceBrick
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
