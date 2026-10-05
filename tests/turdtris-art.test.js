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
  const contexts = [];
  const factory = vi.fn(() => {
    const ctx = canvasContext(); contexts.push(ctx);
    return { getContext: () => ctx };
  });
  return { art: createTurdtrisArt(factory), factory, contexts, ctx: canvasContext() };
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
    factory.mockClear();
    for (const level of [1, 2, 4, 5, 6, 9, 12, 13, 99]) {
      art.drawBackground(ctx, { level, time: level * 100 });
    }
    expect(factory).not.toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalledTimes(9);
    art.drawBackground(ctx, { level: 99, danger: 0.6 });
    art.drawBackground(ctx, { level: 99, danger: 0.9 });
    expect(factory).not.toHaveBeenCalled();
  });
});

describe('Turdtris cached tile art', () => {
  it('reuses the same sprite for piece names and legacy hex colors', () => {
    const { art, factory, ctx } = renderer();
    factory.mockClear();
    for (let frame = 0; frame < 30; frame++) {
      art.drawTile(ctx, 0, 0, 32, 'I');
      art.drawTile(ctx, 32, 0, 32, '#72dbff');
    }
    expect(factory).not.toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalledTimes(60);
    expect(ctx.drawImage.mock.calls[0][0]).toBe(ctx.drawImage.mock.calls[1][0]);
    // Preview sizes and ghost outlines use assets warmed before the first frame.
    art.drawTile(ctx, 0, 0, 24, 'I');
    art.drawTile(ctx, 0, 0, 32, 'I', 1, { ghost: true });
    expect(factory).not.toHaveBeenCalled();
  });

  it('keeps fallback art bounded for unknown cell colors and skips invisible tiles', () => {
    const { art, factory, ctx } = renderer();
    factory.mockClear();
    art.drawTile(ctx, 0, 0, 32, '#unknown');
    art.drawTile(ctx, 0, 0, 32, null);
    art.drawTile(ctx, 0, 0, 1, 'I');
    art.drawTile(ctx, 0, 0, 32, 'I', 0);
    expect(factory).not.toHaveBeenCalled();
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
    expect(ctx.drawImage).toHaveBeenCalledTimes(5);
    expect(ctx.fillRect).toHaveBeenCalledTimes(4);
    expect(ctx.drawImage.mock.calls.slice(1).every((call) => call[8] <= 672)).toBe(true);
    expect(ctx.fillRect.mock.calls.every((call) => call[3] <= 672)).toBe(true);
  });
});

describe('Turdtris warmed frame assets', () => {
  it.each([false, true, { matches: true }])('never rasterizes new art across repeated frames and resizes (%j)', (reducedMotion) => {
    const { art, factory, contexts, ctx } = renderer();
    // Eight solids, eight ghosts, eight drop gradients, four scenes, one danger veil.
    expect(factory).toHaveBeenCalledTimes(29);
    const gradients = contexts.map((source) => source.createLinearGradient.mock.calls.length + source.createRadialGradient.mock.calls.length);
    const cells = [{ x: 0, y: 400 }, { x: 32, y: 400 }, { x: 64, y: 400 }, { x: 96, y: 400 }];
    const colors = ['I', 'J', 'L', 'O', 'S', 'Z', 'T', 'G'];
    const opts = { reducedMotion, ghost: false, time: 0 };
    const background = { level: 1, time: 0, danger: 0.8, reducedMotion, width: 320, height: 640 };
    const drop = { cells, distance: 320, color: 'I', progress: 0.4, reducedMotion };
    const flush = { colors, progress: 0.5, reducedMotion };
    const takeover = { progress: 0.5, reducedMotion };
    factory.mockClear();
    for (let frame = 0; frame < 60; frame++) {
      background.level = 1 + frame % 16; background.time = frame * 16;
      background.width = frame % 2 ? 240 : 360; background.height = background.width * 2;
      art.drawBackground(ctx, background);
      for (const color of colors) {
        opts.ghost = false; art.drawTile(ctx, 0, 0, frame % 2 ? 24 : 36, color, 1, opts);
        opts.ghost = true; art.drawTile(ctx, 0, 0, 32, color, 1, opts);
        drop.color = color; art.drawDropTrail(ctx, drop);
      }
      art.drawFlush(ctx, flush); art.drawTakeover(ctx, takeover);
    }
    expect(factory).not.toHaveBeenCalled();
    expect(contexts.map((source) => source.createLinearGradient.mock.calls.length + source.createRadialGradient.mock.calls.length)).toEqual(gradients);
    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
    if (reducedMotion) {
      expect(ctx.arc).not.toHaveBeenCalled();
      expect(ctx.ellipse).not.toHaveBeenCalled();
      expect(ctx.fillRect).not.toHaveBeenCalled();
    }
  });

  it('keeps public envelope results independent from later frames', () => {
    const first = effectEnvelope('spawn', 0);
    const other = effectEnvelope('lock', 0.4);
    const { art, ctx } = renderer();
    art.drawTile(ctx, 0, 0, 32, 'S', 1, { lockProgress: 0.8 });
    art.drawFlush(ctx, { colors: ['I', 'O'], progress: 0.5 });
    expect(first).toEqual({ alpha: 1, scaleX: 0.76, scaleY: 0.76, rotation: 0, offsetY: 0 });
    expect(other.scaleY).toBeLessThan(1);
    expect(first).not.toBe(other);
  });

  it('resolves mixed-case legacy colors and hostile property names to bounded cached assets', () => {
    const { art, ctx, factory } = renderer();
    factory.mockClear();
    for (const color of ['I', '#72DBFF', '#72DbFf', 'G', '__proto__', 'constructor']) {
      art.drawTile(ctx, 0, 0, 32, color);
    }
    const images = ctx.drawImage.mock.calls.map((call) => call[0]);
    expect(images[0]).toBe(images[1]); expect(images[0]).toBe(images[2]);
    expect(images[3]).toBe(images[4]); expect(images[3]).toBe(images[5]);
    expect(factory).not.toHaveBeenCalled();
  });
});
