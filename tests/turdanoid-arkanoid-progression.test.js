/**
 * Arkanoid-style progression (Jeff, Oct 2026): round 1 is a plain wall, early
 * rounds add one idea at a time, later rounds are bold symmetric pictures
 * (diamonds, arrows, waves, spirals) with a light punk nod (checkerboard,
 * anarchy sign). Also covers the last-bricks assist. See
 * docs/turdanoid-levels/arkanoid-progression-research.md.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import {
  campaignLevelCount,
  definitionForLevel,
  buildCampaignCells,
  isClearable,
  ENDGAME_MAX_BRICKS,
  ENDGAME_IDLE_FRAMES,
  endgameAssistActive,
  endgameSteer
} from '../games/turdanoid-levels.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(rootDir, 'TurdAnoid.html'), 'utf8');
const levelsCore = readFileSync(join(rootDir, 'games/turdanoid-levels-core.js'), 'utf8');
const storageCore = readFileSync(join(rootDir, 'games/turdanoid-storage-core.js'), 'utf8');
const FRAME = 1000 / 60;

function makeCtxStub() {
  const gradient = { addColorStop() {} };
  const target = {};
  return new Proxy(target, {
    get(t, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => gradient;
      }
      if (prop in t) {
        return t[prop];
      }
      return () => {};
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    }
  });
}

function bootGame() {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/TurdAnoid.html',
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = () => makeCtxStub();
      window.requestAnimationFrame = () => 0;
      window.cancelAnimationFrame = () => {};
      window.eval(levelsCore);
      window.eval(storageCore);
    }
  });
  const g = dom.window.__turdanoid;
  if (!g) {
    throw new Error('TurdAnoid test hook (window.__turdanoid) missing');
  }
  return { dom, g };
}

const LEVELS = Array.from({ length: campaignLevelCount() }, (_, i) => definitionForLevel(i + 1));
const mirrored = (def) => def.grid.every((row) => row === [...row].reverse().join(''));
const occupancy = (grid) => grid.map((row) => row.replace(/[^.]/g, '#'));
const multiShare = (def) => {
  const cells = buildCampaignCells(def.level).filter((c) => !c.indestructible);
  return cells.filter((c) => c.hp > 1).length / cells.length;
};

/** Rebuild the on-screen grid from live brick rectangles. */
function renderedOccupancy(bricks, def) {
  const xs = [...new Set(bricks.map((b) => Math.round(b.x * 10) / 10))].sort((a, b) => a - b);
  const ys = [...new Set(bricks.map((b) => Math.round(b.y * 10) / 10))].sort((a, b) => a - b);
  const stride = (vals) => Math.min(...vals.slice(1).map((v, i) => v - vals[i]));
  const sx = stride(xs);
  const sy = ys.length > 1 ? stride(ys) : 1;
  const firstCol = Math.min(...def.grid.map((r) => r.search(/[^.]/)).filter((i) => i >= 0));
  const out = def.grid.map(() => '.'.repeat(def.cols).split(''));
  for (const b of bricks) {
    const c = firstCol + Math.round((Math.round(b.x * 10) / 10 - xs[0]) / sx);
    const r = Math.round((Math.round(b.y * 10) / 10 - ys[0]) / sy);
    out[r][c] = '#';
  }
  return out.map((r) => r.join(''));
}

describe('Arkanoid progression shape', () => {
  it('opens on a plain one-hit classic wall', () => {
    const r1 = LEVELS[0];
    expect(r1.rows).toBeLessThanOrEqual(4);
    for (const row of r1.grid) {
      expect(/^\.*[a-f]+\.*$/.test(row), row).toBe(true);
      expect(new Set(row.replace(/\./g, '')).size).toBe(1);
    }
    expect(buildCampaignCells(1).every((c) => c.hp === 1 && !c.material)).toBe(true);
  });

  it('makes every round clearable and keeps walls inside the 9x9 budget', () => {
    for (const def of LEVELS) {
      expect(def.rows, def.name).toBeLessThanOrEqual(9);
      expect(isClearable(def.grid), `${def.level} ${def.name}`).toBe(true);
    }
  });

  it('draws mostly mirror-symmetric pictures, like classic Arkanoid rounds', () => {
    const sym = LEVELS.filter(mirrored).length;
    expect(sym).toBeGreaterThanOrEqual(26);
  });

  it('ramps multi-hit density from the early to the late rounds', () => {
    const avg = (a) => a.reduce((s, d) => s + multiShare(d), 0) / a.length;
    expect(avg(LEVELS.slice(0, 10))).toBeLessThan(0.6);
    expect(avg(LEVELS.slice(20))).toBeGreaterThan(0.9);
    expect(avg(LEVELS.slice(10, 20))).toBeGreaterThan(avg(LEVELS.slice(0, 10)));
  });

  it('includes the light punk nods: a checkerboard and a final anarchy sign', () => {
    const checker = LEVELS.find((d) => d.pattern === 'Checkerboard');
    expect(checker).toBeTruthy();
    for (let r = 0; r < checker.rows; r += 1) {
      for (let c = 1; c < 9; c += 1) {
        const a = checker.grid[r][c] === 'a';
        const b = checker.grid[r][c - 1] === 'a';
        expect(a && b, `${r},${c}`).toBe(false);
      }
    }
    const last = LEVELS[29];
    expect(last.pattern).toBe('Anarchy');
    expect(mirrored(last)).toBe(true);
    // Circle: the outer ring is metal; the A (gold-ish, with drips) sits inside it.
    const g = last.grid;
    expect(g[0].slice(2, 7)).toBe('MMMMM');
    expect(g[8].slice(2, 7)).toBe('MMMMM');
    for (const r of [2, 3, 4, 5, 6]) {
      expect(g[r][0], `ring row ${r}`).toBe('M');
    }
    expect(g[4].slice(1, 8)).toBe('GGGGGGG'); // the A crossbar
    expect(g[1][4]).toBe('G'); // the apex
    for (const r of [5, 6, 7]) {
      expect(/[GD]/.test(g[r][2]) && /[GD]/.test(g[r][6]), `legs row ${r}`).toBe(true);
    }
  });
});

describe('Alien round (Jeff, Oct 2026)', () => {
  const alien = LEVELS.find((d) => d.pattern === 'Alien');

  it('draws a classic big-eyed grey alien head, distinct from the invader', () => {
    expect(alien).toBeTruthy();
    expect(alien.bossBeat).toBe(false);
    expect([6, 12, 15, 18, 24, 30]).not.toContain(alien.level);
    expect(alien.level).toBeGreaterThanOrEqual(13);
    expect(mirrored(alien)).toBe(true);
    const g = alien.grid;
    expect(g).toEqual([
      '..MMMMM..',
      '.MMMMMMM.',
      'MMMMMMMMM',
      'MTTMMMTTM',
      'MTTTMTTTM',
      'MMMTMTMMM',
      '.MMMMMMM.',
      '.DMMDMMD.',
      '..DMMMD..'
    ]);
    // Grey metal head that is widest up top and tapers to a narrow chin.
    const width = (row) => row.replace(/\./g, '').length;
    expect(width(g[2])).toBe(9);
    expect(width(g[8])).toBeLessThan(width(g[2]));
    expect(width(g[0])).toBeLessThan(width(g[2]));
    // Two black (tar) almond eyes, one per side, never touching across the middle.
    const eyes = g.flatMap((row, r) => [...row].map((ch, c) => (ch === 'T' ? [r, c] : null))).filter(Boolean);
    expect(eyes.length).toBe(12);
    expect(eyes.every(([, c]) => c !== 4)).toBe(true);
    expect(eyes.filter(([, c]) => c < 4).length).toBe(6);
    // Almond: wide on top, slanting down to a point toward the nose.
    expect(g[4].slice(1, 4)).toBe('TTT');
    expect(g[5].slice(1, 4)).toBe('MMT');
    expect(g[3].slice(1, 3)).toBe('TT');
    // Green slime around the chin, no steel anywhere.
    expect(g.slice(7).join('')).toMatch(/D/);
    expect(g.join('')).not.toMatch(/X/);
    // Not the invader round.
    const invader = LEVELS.find((d) => d.pattern === 'Invader');
    expect(invader.grid).not.toEqual(g);
  });
});

describe('Toughness ramp', () => {
  it('never drops total brick HP or drip count from one round to the next', () => {
    const hpOf = (def) => buildCampaignCells(def.level)
      .filter((c) => !c.indestructible)
      .reduce((s, c) => s + c.hp, 0);
    const dripsOf = (def) => buildCampaignCells(def.level).filter((c) => c.hazard === 'drip').length;
    for (let i = 1; i < LEVELS.length; i += 1) {
      expect(hpOf(LEVELS[i]), `HP L${i + 1}`).toBeGreaterThanOrEqual(hpOf(LEVELS[i - 1]));
      expect(dripsOf(LEVELS[i]), `drips L${i + 1}`).toBeGreaterThanOrEqual(dripsOf(LEVELS[i - 1]));
    }
  });

  it('keeps the boss beats and the punk rounds in place', () => {
    expect(LEVELS.filter((d) => d.bossBeat).map((d) => d.level)).toEqual([6, 12, 18, 24, 30]);
    expect(LEVELS[14].pattern).toBe('Checkerboard');
    expect(LEVELS[29].pattern).toBe('Anarchy');
  });
});

describe('Shapes render in the live game', () => {
  it('lays out every round brick-for-brick like its grid', () => {
    const { dom, g } = bootGame();
    g.startGame();
    for (const def of LEVELS) {
      dom.window.Math.random = () => 0.5;
      g.qaJumpToLevel(def.level);
      expect(g.bricks.length, def.name).toBe(buildCampaignCells(def.level).length);
      expect(renderedOccupancy(g.bricks, def), def.name).toEqual(occupancy(def.grid));
    }
  });

  it('reaches the win screen after clearing round 30', () => {
    const { g } = bootGame();
    g.startGame();
    g.qaJumpToLevel(30);
    expect(g.level).toBe(30);
    g.bricks = g.bricks.filter((b) => b.indestructible);
    for (let i = 0; i < 4000 && g.state !== 'win'; i += 1) {
      g.step(FRAME);
    }
    expect(g.state).toBe('win');
  });
});

describe('Last-bricks assist', () => {
  const brick = (x, y, extra = {}) => ({ x, y, w: 30, h: 20, hp: 1, ...extra });

  it('stays off with many bricks left or before the idle delay', () => {
    expect(endgameAssistActive(ENDGAME_MAX_BRICKS + 1, 10000)).toBe(false);
    expect(endgameAssistActive(1, ENDGAME_IDLE_FRAMES - 1)).toBe(false);
    expect(endgameAssistActive(0, 10000)).toBe(false);
    expect(endgameAssistActive(1, ENDGAME_IDLE_FRAMES)).toBe(true);
  });

  it('only nudges an upward ball, keeps its speed, and ignores steel', () => {
    const ball = { x: 150, y: 400, vx: 3, vy: -4 };
    const bricks = [brick(20, 80), brick(240, 60, { indestructible: true, hp: 99 })];
    const out = endgameSteer(ball, bricks, ENDGAME_IDLE_FRAMES);
    expect(out).toBeTruthy();
    expect(Math.hypot(out.vx, out.vy)).toBeCloseTo(5);
    expect(out.vx).toBeLessThan(3); // bent toward the left brick, not the steel one
    expect(out.vy).toBeLessThan(0);
    expect(endgameSteer({ ...ball, vy: 4 }, bricks, ENDGAME_IDLE_FRAMES)).toBeNull();
    expect(endgameSteer(ball, bricks, 10)).toBeNull();
  });

  it('turns gently (a nudge, not autopilot)', () => {
    const ball = { x: 150, y: 400, vx: 4, vy: -3 };
    const out = endgameSteer(ball, [brick(0, 100)], ENDGAME_IDLE_FRAMES);
    const before = Math.atan2(ball.vy, ball.vx);
    const after = Math.atan2(out.vy, out.vx);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(0.0351);
  });

  it('is wired into the live loop and resets when a brick is touched', () => {
    const { g } = bootGame();
    g.startGame();
    g.qaJumpToLevel(3);
    expect(html).toContain('TLEVELS.endgameSteer');
    expect(html).toMatch(/if\(!br\.indestructible\) sinceBrickHit = 0;/);
  });
});
