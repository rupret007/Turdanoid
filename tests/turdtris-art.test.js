import { describe, expect, it, vi } from 'vitest';
import { createTurdtrisArt, effectEnvelope, effectPolicy, themeForLevel } from '../games/turdtris-art.js';

function canvasContext() {
  const gradient = { addColorStop: vi.fn() };
  const ctx = { globalAlpha: 1 };
  for (const method of ['save', 'restore', 'translate', 'scale', 'rotate', 'drawImage', 'beginPath',
    'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'quadraticCurveTo', 'bezierCurveTo',
    'closePath', 'fill', 'stroke', 'fillRect', 'strokeRect', 'setLineDash', 'fillText']) {
    ctx[method] = vi.fn();
  }
  ctx.createLinearGradient = vi.fn(() => gradient);
  ctx.createRadialGradient = vi.fn(() => gradient);
  return ctx;
}

function renderer() {
  const factory = vi.fn(() => ({ getContext: () => canvasContext() }));
  return { art: createTurdtrisArt(factory), factory, ctx: canvasContext() };
}

describe('Turdtris scene chapters', () => {
  it('progresses through all four scenes and remains in space at high levels', () => {
    expect([1, 4, 5, 8, 9, 12, 13, 100].map((level) => themeForLevel(level).id))
      .toEqual(['bathroom', 'bathroom', 'sewer', 'sewer', 'lagoon', 'lagoon', 'space', 'space']);
    expect(themeForLevel(-3).id).toBe('bathroom');
    expect(themeForLevel(Number.NaN).id).toBe('bathroom');
  });

  it('caches whole backgrounds by scene instead of creating canvases each frame', () => {
    const { art, factory, ctx } = renderer();
    for (const level of [1, 2, 4, 5, 6, 9, 12, 13, 99]) {
      art.drawBackground(ctx, { level, time: level * 100 });
    }
    expect(factory).toHaveBeenCalledTimes(4);
    expect(ctx.drawImage).toHaveBeenCalledTimes(9);
    art.drawBackground(ctx, { level: 99, danger: 0.6 });
    art.drawBackground(ctx, { level: 99, danger: 0.9 });
    expect(factory).toHaveBeenCalledTimes(5);
  });
});

describe('Turdtris cached tile art', () => {
  it('reuses the same sprite for piece names and legacy hex colors', () => {
    const { art, factory, ctx } = renderer();
    for (let frame = 0; frame < 30; frame++) {
      art.drawTile(ctx, 0, 0, 32, 'I');
      art.drawTile(ctx, 32, 0, 32, '#72dbff');
    }
    expect(factory).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledTimes(60);
    // Preview-sized sprites share the cache; ghost outlines get their own.
    art.drawTile(ctx, 0, 0, 24, 'I');
    art.drawTile(ctx, 0, 0, 32, 'I', 1, { ghost: true });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('keeps fallback art bounded for unknown cell colors and skips invisible tiles', () => {
    const { art, factory, ctx } = renderer();
    art.drawTile(ctx, 0, 0, 32, '#unknown');
    art.drawTile(ctx, 0, 0, 32, null);
    art.drawTile(ctx, 0, 0, 1, 'I');
    art.drawTile(ctx, 0, 0, 32, 'I', 0);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
  });
});

describe('Turdtris motion accessibility', () => {
  it.each([true, { matches: true }])('turns off every animated effect under reduced motion: %j', (reduced) => {
    const policy = effectPolicy(reduced);
    expect(Object.values(policy).every((value) => value === false || value === 0)).toBe(true);
    for (const kind of ['spawn', 'lock', 'flush', 'trail', 'dust', 'takeover']) {
      const effect = effectEnvelope(kind, 0.5, reduced);
      expect(effect.scaleX).toBe(1);
      expect(effect.scaleY).toBe(1);
      expect(effect.rotation).toBe(0);
      expect(effect.offsetY).toBe(0);
      if (kind === 'trail' || kind === 'dust') { expect(effect.alpha).toBe(0); }
    }
  });

  it('allows legible static ghost, static danger tint, and clear fading under reduced motion', () => {
    const { art, ctx } = renderer();
    art.drawTile(ctx, 0, 0, 32, 'T', 1, { ghost: true, time: 400, reducedMotion: true });
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(ctx.fillRect).not.toHaveBeenCalled();
    art.drawBackground(ctx, { danger: 1, reducedMotion: true });
    expect(ctx.drawImage).toHaveBeenCalledTimes(3);
    expect(ctx.arc).not.toHaveBeenCalled();
    art.drawFlush(ctx, { colors: ['I', 'O'], progress: 0.5, reducedMotion: true });
    expect(ctx.drawImage).toHaveBeenCalledTimes(5);
    expect(ctx.ellipse).not.toHaveBeenCalled();
    expect(effectEnvelope('flush', 0.5, true).alpha).toBe(0.5);
    art.drawDropTrail(ctx, { cells: [{ x: 0, y: 300 }], distance: 300, reducedMotion: true });
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it('does not flash or squash locked tiles when motion is reduced', () => {
    const { art, ctx } = renderer();
    art.drawTile(ctx, 0, 0, 32, 'S', 1, { flash: 1, lockProgress: 0.4, reducedMotion: true });
    expect(ctx.scale).toHaveBeenCalledWith(1, 1);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('settles spawn and lock transforms exactly and bounds hostile progress values', () => {
    for (const kind of ['spawn', 'lock']) {
      expect(effectEnvelope(kind, 1)).toEqual({ alpha: 1, scaleX: 1, scaleY: 1, rotation: 0, offsetY: 0 });
    }
    expect(effectEnvelope('spawn', 0).scaleX).toBeLessThan(1);
    expect(effectEnvelope('lock', 0.4).scaleY).toBeLessThan(1);
    expect(effectEnvelope('flush', 4).alpha).toBe(0);
    expect(effectEnvelope('trail', -5).alpha).toBe(1);
    expect(effectEnvelope('takeover', 0.3).alpha).toBe(1);
    expect(effectEnvelope('takeover', 1).alpha).toBe(0);
  });

  it('caps ambient objects and drop dust even with an invalid oversized effect list', () => {
    const { art, ctx } = renderer();
    art.drawBackground(ctx, { level: 1000 });
    expect(ctx.arc).toHaveBeenCalledTimes(14);
    ctx.arc.mockClear();
    art.drawDropTrail(ctx, { cells: Array.from({ length: 100 }, () => ({ x: 0, y: 200 })), distance: 9999, progress: 0.4 });
    expect(ctx.arc).toHaveBeenCalledTimes(12);
    expect(ctx.fillRect).toHaveBeenCalledTimes(8);
    expect(ctx.fillRect.mock.calls.every((call) => call[3] <= 672)).toBe(true);
  });
});
