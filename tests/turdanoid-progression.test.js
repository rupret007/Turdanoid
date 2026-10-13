/**
 * Runtime campaign proof: every classic level loads through the live game,
 * plays a deterministic rally, and the walls get harder Arkanoid-style.
 *
 * Drip cooldown is postponed so this file does not depend on #54 drip timing.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import {
  campaignLevelCount,
  buildCampaignCells,
  campaignMetrics,
  computeBallSpeed
} from '../games/turdanoid-levels.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(rootDir, 'TurdAnoid.html'), 'utf8');
const levelsCore = readFileSync(join(rootDir, 'games/turdanoid-levels-core.js'), 'utf8');
const storageCore = readFileSync(join(rootDir, 'games/turdanoid-storage-core.js'), 'utf8');
const FRAME = 1000 / 60;
const PLAY_FRAMES = 28;

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

function wallFingerprint(bricks) {
  return bricks
    .map((b) =>
      [
        Math.round(b.x),
        Math.round(b.y),
        b.hp,
        b.indestructible ? 'X' : '',
        b.hazard || '',
        b.metal ? 'M' : '',
        b.material || ''
      ].join('.')
    )
    .join('|');
}

function brickHpTotal(bricks) {
  return bricks.reduce((sum, b) => (b.indestructible ? sum : sum + b.hp), 0);
}

function playRally(g, frames = PLAY_FRAMES) {
  for (const brick of g.bricks) {
    brick.hazardCd = 1e9;
  }
  g.launch();
  const path = [];
  for (let i = 0; i < frames; i += 1) {
    g.step(FRAME);
    const ball = g.balls[0];
    path.push(ball ? `${Math.round(ball.x * 10)},${Math.round(ball.y * 10)}` : 'gone');
  }
  return path.join(';');
}

describe('TurdAnoid deterministic campaign play', () => {
  it('loads every level, plays a unique rally, and climbs difficulty', () => {
    const { dom, g } = bootGame();
    g.startGame();
    expect(campaignLevelCount()).toBe(30);
    const metrics = campaignMetrics();
    const snapshots = [];

    for (let level = 1; level <= 30; level += 1) {
      dom.window.Math.random = () => 0.5;
      g.qaJumpToLevel(level);
      expect(g.state).toBe('playing');
      expect(g.level).toBe(level);
      expect(g.waitingLaunch).toBe(true);
      expect(g.balls).toHaveLength(1);
      expect(g.bricks.length).toBe(buildCampaignCells(level).length);
      expect(g.bricks.length).toBeGreaterThan(0);

      const hp = brickHpTotal(g.bricks);
      const speed = g.balls[0].baseSpeed;
      expect(speed).toBeCloseTo(computeBallSpeed(level));
      expect(hp).toBe(metrics[level - 1].brickHpTotal);
      expect(g.remainingBreakable).toBe(metrics[level - 1].breakableCount);

      const fingerprint = wallFingerprint(g.bricks);
      const path = playRally(g);
      expect(g.balls.length).toBeGreaterThan(0);
      snapshots.push({
        level,
        name: metrics[level - 1].name,
        fingerprint,
        hp,
        speed,
        path,
        hazards: g.bricks.filter((b) => b.hazard === 'drip').length,
        steel: g.bricks.filter((b) => b.indestructible).length
      });
    }

    const names = new Set(snapshots.map((s) => s.name));
    const fingerprints = new Set(snapshots.map((s) => s.fingerprint));
    const paths = new Set(snapshots.map((s) => s.path));
    expect(names.size).toBe(30);
    expect(fingerprints.size).toBe(30);
    expect(paths.size).toBeGreaterThanOrEqual(18);

    for (let i = 1; i < snapshots.length; i += 1) {
      const prev = snapshots[i - 1];
      const cur = snapshots[i];
      expect(cur.fingerprint).not.toBe(prev.fingerprint);
      expect(cur.hp).toBeGreaterThanOrEqual(prev.hp);
      expect(cur.speed).toBeGreaterThanOrEqual(prev.speed);
      expect(cur.hazards).toBeGreaterThanOrEqual(prev.hazards);
    }

    expect(snapshots[0].hp).toBeLessThan(snapshots[5].hp);
    expect(snapshots[5].steel).toBeGreaterThan(0);
    expect(snapshots[10].hazards).toBeGreaterThan(0);
    expect(snapshots[29].hp).toBeGreaterThan(snapshots[0].hp * 8);
    expect(snapshots[0].path).not.toBe(snapshots[14].path);
    expect(snapshots[14].path).not.toBe(snapshots[29].path);
  });

  it('replays the same level to the same rally when the seed is fixed', () => {
    const { dom, g } = bootGame();
    g.startGame();
    const run = (level) => {
      dom.window.Math.random = () => 0.5;
      g.qaJumpToLevel(level);
      return {
        fingerprint: wallFingerprint(g.bricks),
        path: playRally(g)
      };
    };
    const first = run(8);
    const second = run(8);
    const later = run(20);
    expect(second).toEqual(first);
    expect(later.fingerprint).not.toBe(first.fingerprint);
    expect(later.path).not.toBe(first.path);
  });
});
