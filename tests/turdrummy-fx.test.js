import { describe, it, expect } from 'vitest';
import { createBurst, stepParticles } from '../games/turdrummy-fx.js';

function fixedRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('createBurst', () => {
  it('creates the requested number of particles at the origin', () => {
    const particles = createBurst(12, 50, 60, fixedRng([0.1, 0.5, 0.9]));
    expect(particles).toHaveLength(12);
    for (const p of particles) {
      expect(p.x).toBe(50);
      expect(p.y).toBe(60);
      expect(p.life).toBeGreaterThan(0);
    }
  });

  it('clamps a negative or fractional count to a safe whole number', () => {
    expect(createBurst(-5, 0, 0)).toHaveLength(0);
    expect(createBurst(3.9, 0, 0)).toHaveLength(3);
  });

  it('is deterministic for a given rng', () => {
    const rng = () => 0.25;
    const a = createBurst(4, 0, 0, rng);
    const b = createBurst(4, 0, 0, rng);
    expect(a).toEqual(b);
  });
});

describe('stepParticles', () => {
  it('moves particles forward and applies gravity to vertical velocity', () => {
    const particles = [{ x: 0, y: 0, vx: 100, vy: -200, rot: 0, vr: 0, size: 4, color: '#fff', life: 1 }];
    const next = stepParticles(particles, 0.1);
    expect(next).toHaveLength(1);
    expect(next[0].x).toBeGreaterThan(0);
    expect(next[0].vy).toBeGreaterThan(-200); // gravity pulls vy up toward/through 0
  });

  it('removes particles once their life reaches zero', () => {
    const particles = [{ x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, size: 4, color: '#fff', life: 0.05 }];
    const next = stepParticles(particles, 0.1);
    expect(next).toHaveLength(0);
  });

  it('clamps an oversized dt so a slow frame cannot teleport particles', () => {
    const particles = [{ x: 0, y: 0, vx: 1000, vy: 0, rot: 0, vr: 0, size: 4, color: '#fff', life: 5 }];
    const slow = stepParticles(particles, 5)[0];
    const clamped = stepParticles(particles, 0.05)[0];
    expect(slow.x).toBeCloseTo(clamped.x);
  });
});
