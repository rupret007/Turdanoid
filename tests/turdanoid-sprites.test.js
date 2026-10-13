import { describe, expect, it } from 'vitest';
import {
  paintBrickBevel,
  paintHpPips,
  paintPaddle,
  paintBall,
  paintCapsule,
  paintPipe,
  paintShard,
  paintBoss,
  paintAtmosphere,
  paintWorldStage,
  worldStageSpec,
  worldBasinColors,
  worldBubbleColor,
  worldAtmosphereColors,
  tileFaceColors
} from '../games/turdanoid-sprites.js';
import { TOKENS } from '../games/turdanoid-theme.js';

function recordCtx() {
  const calls = [];
  const gradient = { addColorStop: () => {} };
  const ctx = {
    calls,
    fillStyle: '',
    strokeStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    globalAlpha: 1,
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    save() {
      calls.push('save');
    },
    restore() {
      calls.push('restore');
    },
    beginPath() {
      calls.push('beginPath');
    },
    closePath() {
      calls.push('closePath');
    },
    fill() {
      calls.push('fill');
    },
    stroke() {
      calls.push('stroke');
    },
    fillRect(...args) {
      calls.push(['fillRect', args]);
    },
    strokeRect(...args) {
      calls.push(['strokeRect', args]);
    },
    fillText(text) {
      calls.push(['fillText', text]);
    },
    strokeText(text) {
      calls.push(['strokeText', text]);
    },
    arc() {
      calls.push('arc');
    },
    ellipse() {
      calls.push('ellipse');
    },
    moveTo() {},
    lineTo() {},
    arcTo() {},
    translate() {},
    rotate() {},
    scale() {},
    createLinearGradient() {
      return gradient;
    },
    createRadialGradient() {
      return gradient;
    }
  };
  return ctx;
}

describe('Turdanoid play-object sprites', () => {
  it('bevels bricks with extruded faces and a glaze hotspot', () => {
    const ctx = recordCtx();
    const drawn = paintBrickBevel(ctx, 40, 18, { c1: TOKENS.slime, c2: TOKENS.slimeDeep });
    expect(drawn.extruded).toBe(true);
    expect(drawn.inset).toBe(true);
    expect(drawn.glaze).toBe(true);
    expect(drawn.depth).toBeGreaterThan(2);
    expect(ctx.calls.filter((c) => c === 'fill').length).toBeGreaterThanOrEqual(6);
    expect(ctx.calls).toContain('ellipse');
    expect(ctx.calls).toContain('stroke');
    expect(ctx.calls[0]).toBe('save');
    expect(ctx.calls[ctx.calls.length - 1]).toBe('restore');
  });

  it('draws remaining-HP pips only on multi-hit bricks', () => {
    const ctx = recordCtx();
    expect(paintHpPips(ctx, { x: 10, y: 10, w: 40, h: 16, hp: 1, maxHp: 1 })).toBe(0);
    expect(paintHpPips(ctx, { x: 10, y: 10, w: 40, h: 16, hp: 3, maxHp: 3 })).toBe(3);
    expect(ctx.calls.filter((c) => c === 'arc').length).toBe(6);
  });

  it('paints a plunger paddle with a contact shadow', () => {
    const ctx = recordCtx();
    const box = paintPaddle(ctx, { x: 120, y: 400, w: 90, h: 18 }, { fire: true }, 0, {
      W: 390,
      H: 844
    });
    expect(box.w).toBe(90);
    expect(box.plunger).toBe(true);
    expect(box.enamel).toBe(true);
    expect(ctx.calls.some((c) => Array.isArray(c) && c[0] === 'fillRect')).toBe(true);
  });

  it('skips ball motion trails when reduced motion is on', () => {
    const trail = [{ x: 10, y: 10 }, { x: 12, y: 12 }, { x: 14, y: 14 }];
    const ball = { x: 40, y: 80, r: 7, vx: 2, vy: -3, fire: 0, ghost: 0, trail, squash: 0 };
    const motion = recordCtx();
    expect(paintBall(motion, ball, { reducedMotion: false }).glaze).toBe(true);
    expect(motion.calls).toContain('ellipse');
    const calm = recordCtx();
    paintBall(calm, ball, { reducedMotion: true });
    expect(calm.calls).not.toContain('ellipse');
  });

  it('labels capsules with high-contrast ink text', () => {
    const ctx = recordCtx();
    paintCapsule(ctx, { x: 50, y: 60, col: TOKENS.brass, e: '🔥', lab: 'Fire', wob: 0 }, 0, {
      reducedMotion: true
    });
    expect(ctx.calls).toContainEqual(['fillText', 'Fire']);
    expect(ctx.fillStyle).toBe(TOKENS.inkText);
    expect(ctx.calls).toContain('ellipse');
    expect(paintCapsule(ctx, { x: 50, y: 60, col: TOKENS.brass, e: '🔥', lab: 'Fire', wob: 0 }, 400, {
      reducedMotion: false
    }).sparkle).toBe(true);
  });

  it('paints a ceiling light cone for stage atmosphere', () => {
    const ctx = recordCtx();
    const air = paintAtmosphere(ctx, { W: 390, H: 844, nowMs: 0, reducedMotion: true, world: { id: 'bathroom' } });
    expect(air.cone).toBe(true);
    expect(air.motes).toBeGreaterThanOrEqual(10);
    expect(air.tint).toBe('bathroom');
    expect(ctx.calls).toContain('ellipse');
    expect(ctx.calls.some((c) => Array.isArray(c) && c[0] === 'fillRect')).toBe(true);
    expect(worldAtmosphereColors({ id: 'bathroom' }).mid).not.toBe(worldAtmosphereColors({ id: 'sewer' }).mid);
    expect(worldAtmosphereColors({ id: 'throne' }).hi).toContain('255,230,160');
  });

  it('paints faceted shards and a readable boss bar', () => {
    const shardCtx = recordCtx();
    paintShard(shardCtx, { x: 8, y: 8, w: 6, h: 5, rot: 0.2, c1: '#fff', c2: '#000', alpha: 0.8 });
    expect(shardCtx.calls).toContain('fill');
    const bossCtx = recordCtx();
    const drawn = paintBoss(bossCtx, { x: 100, y: 40, w: 80, h: 28, hp: 4, maxHp: 8 });
    expect(drawn.pct).toBe(0.5);
    expect(drawn.crown).toBe(true);
    expect(bossCtx.calls).toContainEqual(['fillText', 'SEWER KING']);
    expect(bossCtx.calls).toContain('ellipse');
  });

  it('dresses each world with a distinct tile and basin', () => {
    const bathroom = paintWorldStage(recordCtx(), { id: 'bathroom', stage: { tile: 'square', rail: 'brass' } }, {
      W: 390,
      H: 844
    });
    const sewer = paintWorldStage(recordCtx(), { id: 'sewer', stage: { tile: 'bond', rail: 'slime' } }, {
      W: 390,
      H: 844
    });
    const throne = paintWorldStage(recordCtx(), { id: 'throne', stage: { tile: 'slab', rail: 'gold' } }, {
      W: 390,
      H: 844
    });
    expect(bathroom.tile).toBe('square');
    expect(sewer.tile).toBe('bond');
    expect(throne.tile).toBe('slab');
    expect(bathroom.wainscot).toBe(true);
    expect(bathroom.filled).toBe(true);
    expect(bathroom.tiles).toBeGreaterThan(20);
    expect(tileFaceColors('square').face).not.toBe(tileFaceColors('slab').face);
    expect(worldStageSpec({ id: 'candy' }).tile).toBe('diamond');
    expect(worldBasinColors({ id: 'bathroom' }).crest).toContain('232,244,239');
    expect(worldBasinColors({ id: 'throne' }).hi).toContain('232,197,106');
    expect(worldBubbleColor({ id: 'bathroom' })).not.toBe(worldBubbleColor({ id: 'sewer' }));
    const attract = recordCtx();
    paintWorldStage(attract, { id: 'bathroom', stage: { tile: 'square', rail: 'brass' } }, {
      W: 390,
      H: 844,
      fixtures: false
    });
    expect(attract.calls.filter((c) => c === 'arc').length).toBeLessThan(2);
  });

  it('shades pipes with a specular line', () => {
    const ctx = recordCtx();
    paintPipe(ctx, { x: 10, y: 20, w: 80, h: 12, vertical: false, colors: ['#061018', '#1a7a58'] });
    expect(ctx.calls.some((c) => Array.isArray(c) && c[0] === 'fillRect')).toBe(true);
  });
});
