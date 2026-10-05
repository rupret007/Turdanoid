import { describe, it, expect } from 'vitest';
import { spawnShardsFromBrick, stepShard, shardCap } from '../games/turdanoid-shards.js';

describe('Turdanoid shards', () => {
  const brick = { x: 10, y: 20, w: 40, h: 18, c1: '#fff', c2: '#000' };

  it('spawns capped shards with physics', () => {
    const shards = spawnShardsFromBrick(brick, 6, () => 0.5);
    expect(shards.length).toBe(6);
    const s = shards[0];
    const life0 = s.life;
    expect(life0).toBeGreaterThan(0);
    const alive = stepShard(s, 1);
    expect(alive).toBe(true);
    expect(s.life).toBeLessThan(life0);
    expect(Math.hypot(s.vx, s.vy)).toBeGreaterThan(0);
  });

  it('reduces shard cap under reduced motion', () => {
    const reduced = { matches: true };
    expect(shardCap(20, reduced, null)).toBeLessThanOrEqual(3);
    expect(shardCap(20, { matches: false }, null)).toBe(20);
  });
});
