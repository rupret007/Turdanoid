/* Polished play-object painters for TurdAnoid (render only). */
(function attachTurdanoidSprites(root) {
  'use strict';

  function tokens() {
    return (root.TurdanoidTheme && root.TurdanoidTheme.TOKENS) || {
      slime: '#3ecf9a',
      slimeDeep: '#1a7a58',
      brass: '#e8c56a',
      brassDeep: '#a8781c',
      coral: '#ff6d5a',
      porcelain: '#e8f4ef',
      inkDeep: '#061018',
      inkText: '#eaf6f0',
      gold: '#f0d478',
      aqua: '#5ec8e0',
      rose: '#d878a8',
      metal: '#c4d0dc'
    };
  }

  function roundRect(c, x, y, w, h, r) {
    const rad = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    c.beginPath();
    c.moveTo(x + rad, y);
    c.arcTo(x + w, y, x + w, y + h, rad);
    c.arcTo(x + w, y + h, x, y + h, rad);
    c.arcTo(x, y + h, x, y, rad);
    c.arcTo(x, y, x + w, y, rad);
    c.closePath();
  }

  function paintBrickBevel(ctx, w, h, opts) {
    const t = tokens();
    const c1 = (opts && opts.c1) || t.slime;
    const c2 = (opts && opts.c2) || t.slimeDeep;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    roundRect(ctx, 1.5, h - 1, w, 3.5, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(8,14,16,.88)';
    roundRect(ctx, 0, 0, w, h, 5);
    ctx.fill();
    const inset = 1.6;
    const g = ctx.createLinearGradient(inset, inset, w * 0.2, h);
    g.addColorStop(0, c1);
    g.addColorStop(0.55, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    roundRect(ctx, inset, inset, w - inset * 2, h - inset * 2, 3.6);
    ctx.fill();
    const sheen = ctx.createLinearGradient(0, inset, 0, h * 0.42);
    sheen.addColorStop(0, 'rgba(255,255,255,.34)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    roundRect(ctx, inset + 1.2, inset + 0.8, w * 0.62, h * 0.28, 2.4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(inset + 2, inset + 1.4);
    ctx.lineTo(w - inset - 2, inset + 1.4);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.28)';
    ctx.lineWidth = 1;
    roundRect(ctx, inset + 0.4, inset + 0.4, w - inset * 2 - 0.8, h - inset * 2 - 0.8, 3.2);
    ctx.stroke();
    ctx.restore();
  }

  function paintHpPips(ctx, brick) {
    if (!brick || brick.maxHp <= 1) {
      return 0;
    }
    const pips = Math.max(1, Math.min(5, Math.ceil(brick.hp)));
    const px = brick.x;
    const py = brick.y;
    const pw = brick.w;
    const ph = brick.h;
    for (let i = 0; i < pips; i += 1) {
      const cx = px + pw - 6 - i * 5;
      const cy = py + ph - 5;
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.beginPath();
      ctx.arc(cx, cy + 0.5, 1.7, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = tokens().porcelain;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.15, 0, 6.283);
      ctx.fill();
    }
    return pips;
  }

  function paintPaddle(ctx, paddle, powers, nowMs, view) {
    const t = tokens();
    const p = powers || {};
    const W = (view && view.W) || 390;
    const H = (view && view.H) || 844;
    const reduced = !!(view && view.reducedMotion);
    const sq = Math.min(1, paddle.squash || 0);
    const x = paddle.x - paddle.w / 2;
    const y = paddle.y + (paddle.recoil || 0);
    const w = paddle.w;
    const h = paddle.h;
    ctx.save();
    if (sq > 0 && !reduced) {
      ctx.translate(paddle.x, y + h / 2);
      ctx.scale(1 + sq * 0.1, 1 - sq * 0.08);
      ctx.translate(-paddle.x, -(y + h / 2));
    }
    if (p.shield) {
      const sg = ctx.createLinearGradient(0, paddle.y + paddle.h, 0, H);
      sg.addColorStop(0, 'rgba(94,200,224,.48)');
      sg.addColorStop(1, 'rgba(94,200,224,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, paddle.y + paddle.h + 2, W, H - paddle.y - paddle.h - 2);
    }
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    roundRect(ctx, x + 3, y + h + 2, w - 2, 6, 4);
    ctx.fill();
    const body = ctx.createLinearGradient(x, y, x, y + h);
    body.addColorStop(0, '#ff8a78');
    body.addColorStop(0.28, t.coral);
    body.addColorStop(0.7, '#c02830');
    body.addColorStop(1, '#5a1018');
    ctx.fillStyle = body;
    ctx.shadowColor = p.fire ? t.coral : (p.gold ? t.brass : t.slime);
    ctx.shadowBlur = 16;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = t.porcelain;
    ctx.lineWidth = 1.6;
    roundRect(ctx, x + 1.2, y + 1.2, w - 2.4, h - 2.4, h / 2 - 1);
    ctx.stroke();
    const cavity = ctx.createRadialGradient(paddle.x, y + h * 0.45, 2, paddle.x, y + h * 0.6, w * 0.42);
    cavity.addColorStop(0, 'rgba(80,12,18,.12)');
    cavity.addColorStop(1, 'rgba(20,0,6,.48)');
    ctx.fillStyle = cavity;
    roundRect(ctx, x + 5, y + 3, w - 10, h - 6, h / 2 - 3);
    ctx.fill();
    ctx.fillStyle = t.brass;
    roundRect(ctx, paddle.x - 5, y - 15, 10, 13, 3);
    ctx.fill();
    ctx.fillStyle = t.brassDeep;
    ctx.fillRect(paddle.x - 4, y - 13, 8, 2);
    const sheen = ctx.createLinearGradient(x, y, x, y + h * 0.45);
    sheen.addColorStop(0, 'rgba(255,255,255,.7)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    roundRect(ctx, x + 7, y + 1.5, w - 14, h * 0.36, h * 0.24);
    ctx.fill();
    if (p.laser) {
      ctx.fillStyle = t.rose;
      roundRect(ctx, x + 8, y - 7, 6, 8, 2);
      ctx.fill();
      roundRect(ctx, x + w - 14, y - 7, 6, 8, 2);
      ctx.fill();
    }
    if (p.hotdog) {
      ctx.fillStyle = '#7a3a14';
      roundRect(ctx, x + 3, y - 8, 6, 8, 2);
      ctx.fill();
      roundRect(ctx, x + w - 9, y - 8, 6, 8, 2);
      ctx.fill();
    }
    ctx.restore();
    return { x: x, y: y, w: w, h: h };
  }

  function paintBall(ctx, ball, opts) {
    const t = tokens();
    const reduced = !!(opts && opts.reducedMotion);
    const r = ball.r;
    const drawR = r * ((opts && opts.visualScale) || 1.38);
    const x = ball.x;
    const y = ball.y;
    const ghostly = ball.ghost > 0;
    const speed = Math.hypot(ball.vx || 0, ball.vy || 0) || 1;
    const ang = Math.atan2(ball.vy || 0, ball.vx || 0);
    const trail = ball.trail || [];
    if (!reduced) {
      for (let i = 0; i < trail.length; i += 1) {
        const step = trail[i];
        const a = (i + 1) / Math.max(1, trail.length);
        ctx.globalAlpha = (0.28 + a * 0.45) * (ghostly ? 0.5 : 1);
        ctx.save();
        ctx.translate(step.x, step.y);
        ctx.rotate(ang);
        const stretch = 1 + Math.min(speed / 3.5, 1.8);
        const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, drawR * 1.3 * stretch);
        if (ball.fire > 0) {
          grd.addColorStop(0, 'rgba(255,200,120,.88)');
          grd.addColorStop(1, 'rgba(255,80,30,0)');
        } else {
          grd.addColorStop(0, 'rgba(232,197,106,.55)');
          grd.addColorStop(1, 'rgba(122,77,42,0)');
        }
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(0, 0, drawR * a * stretch, drawR * a * 0.82, 0, 0, 6.283);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = ghostly ? 0.55 : 1;
    const halo = ctx.createRadialGradient(x, y, drawR * 0.2, x, y, drawR * 2);
    if (ball.fire > 0) {
      halo.addColorStop(0, 'rgba(255,160,80,.5)');
      halo.addColorStop(1, 'rgba(255,80,30,0)');
    } else {
      halo.addColorStop(0, 'rgba(232,197,106,.4)');
      halo.addColorStop(1, 'rgba(122,77,42,0)');
    }
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, drawR * 2, 0, 6.283);
    ctx.fill();
    ctx.save();
    const sq = reduced ? 0 : Math.min(1, ball.squash || 0);
    if (sq > 0) {
      const k = 0.32 * sq;
      ctx.translate(x, y);
      ctx.rotate(ball.squashAng || 0);
      ctx.scale(1 - k, 1 + k);
      ctx.rotate(-(ball.squashAng || 0));
      ctx.translate(-x, -y);
    }
    const body = ctx.createRadialGradient(x - drawR * 0.38, y - drawR * 0.4, drawR * 0.08, x, y, drawR * 1.08);
    if (ball.fire > 0) {
      body.addColorStop(0, '#fffde0');
      body.addColorStop(0.35, '#ffd28a');
      body.addColorStop(1, '#7a2810');
    } else {
      body.addColorStop(0, '#d4a070');
      body.addColorStop(0.45, '#8a5a30');
      body.addColorStop(1, '#2e1a0c');
    }
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, drawR, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.beginPath();
    ctx.arc(x - drawR * 0.22, y - drawR * 0.42, drawR * 0.18, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - drawR * 0.28, y - drawR * 0.06, drawR * 0.18, 0, 6.283);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + drawR * 0.28, y - drawR * 0.06, drawR * 0.18, 0, 6.283);
    ctx.fill();
    const eyeOffX = Math.cos(ang) * drawR * 0.05;
    const eyeOffY = Math.sin(ang) * drawR * 0.05;
    ctx.fillStyle = t.inkDeep;
    ctx.beginPath();
    ctx.arc(x - drawR * 0.28 + eyeOffX, y - drawR * 0.06 + eyeOffY, drawR * 0.08, 0, 6.283);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + drawR * 0.28 + eyeOffX, y - drawR * 0.06 + eyeOffY, drawR * 0.08, 0, 6.283);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    return { r: drawR };
  }

  function paintCapsule(ctx, powerup, nowMs, opts) {
    const t = tokens();
    const reduced = !!(opts && opts.reducedMotion);
    const y = powerup.y + (reduced ? 0 : Math.sin(powerup.wob || 0) * 2);
    const x = powerup.x;
    const haloR = reduced ? 18 : 20 + Math.sin((powerup.wob || 0) * 1.5) * 2;
    const halo = ctx.createRadialGradient(x, y, 3, x, y, haloR);
    halo.addColorStop(0, powerup.col || t.slime);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = 1;
    const body = ctx.createLinearGradient(x - 18, y - 12, x - 18, y + 12);
    if (powerup.bad) {
      body.addColorStop(0, 'rgba(90,22,28,.96)');
      body.addColorStop(1, 'rgba(36,8,12,.96)');
    } else {
      body.addColorStop(0, 'rgba(18,40,48,.94)');
      body.addColorStop(1, 'rgba(6,16,22,.94)');
    }
    ctx.fillStyle = body;
    roundRect(ctx, x - 17, y - 12, 34, 24, 12);
    ctx.fill();
    ctx.strokeStyle = powerup.col || t.brass;
    ctx.lineWidth = 1.8;
    roundRect(ctx, x - 17, y - 12, 34, 24, 12);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    roundRect(ctx, x - 13, y - 10, 26, 5, 2.5);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y + 1);
    if (!reduced) {
      ctx.rotate(Math.sin((nowMs || 0) * 0.003 + (powerup.wob || 0)) * 0.08);
    }
    ctx.font = 'bold 18px system-ui, "Apple Color Emoji", "Segoe UI Emoji"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(powerup.e || '?', 0, 0);
    ctx.restore();
    ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(6,16,22,.85)';
    ctx.strokeText(powerup.lab || '', x, y + 17);
    ctx.fillStyle = t.inkText;
    ctx.fillText(powerup.lab || '', x, y + 17);
    ctx.textBaseline = 'alphabetic';
    return { x: x, y: y };
  }

  function paintPipe(ctx, spec) {
    const t = tokens();
    const x = spec.x;
    const y = spec.y;
    const w = spec.w;
    const h = spec.h;
    const colors = spec.colors || [t.inkDeep, t.slimeDeep, t.inkMid || t.inkDeep];
    if (spec.vertical) {
      const pg = ctx.createLinearGradient(x, 0, x + h, 0);
      pg.addColorStop(0, colors[0]);
      pg.addColorStop(0.35, colors[1]);
      pg.addColorStop(1, colors[0]);
      ctx.fillStyle = pg;
      roundRect(ctx, x, y, h, w, h / 2);
      ctx.fill();
      ctx.fillStyle = t.porcelainDim || 'rgba(184,212,200,.55)';
      ctx.fillRect(x - 2, y + 4, h + 4, 3);
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.fillRect(x + h * 0.32, y + 6, 1.6, w - 12);
    } else {
      const pg = ctx.createLinearGradient(0, y, 0, y + h);
      pg.addColorStop(0, colors[0]);
      pg.addColorStop(0.35, colors[1]);
      pg.addColorStop(1, colors[0]);
      ctx.fillStyle = pg;
      roundRect(ctx, x, y, w, h, h / 2);
      ctx.fill();
      ctx.fillStyle = t.brassDeep;
      ctx.fillRect(x + 4, y - 2, 4, h + 4);
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.fillRect(x + 6, y + h * 0.3, w - 12, 1.6);
    }
  }

  function paintShard(ctx, shard) {
    ctx.save();
    ctx.globalAlpha = shard.alpha !== undefined && shard.alpha !== null ? shard.alpha : 1;
    ctx.translate(shard.x, shard.y);
    ctx.rotate(shard.rot || 0);
    const g = ctx.createLinearGradient(0, -shard.h / 2, 0, shard.h / 2);
    g.addColorStop(0, shard.c1 || tokens().slime);
    g.addColorStop(1, shard.c2 || tokens().slimeDeep);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-shard.w / 2, shard.h / 3);
    ctx.lineTo(0, -shard.h / 2);
    ctx.lineTo(shard.w / 2, shard.h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function paintBoss(ctx, boss) {
    const t = tokens();
    const x = boss.x - boss.w / 2;
    const y = boss.y;
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    roundRect(ctx, x + 4, y + 5, boss.w, boss.h, 12);
    ctx.fill();
    const g = ctx.createLinearGradient(x, y, x, y + boss.h);
    g.addColorStop(0, t.brass);
    g.addColorStop(0.45, '#5a3a14');
    g.addColorStop(1, t.inkDeep);
    ctx.fillStyle = g;
    roundRect(ctx, x, y, boss.w, boss.h, 12);
    ctx.fill();
    ctx.strokeStyle = t.gold;
    ctx.lineWidth = 2;
    roundRect(ctx, x + 3, y + 3, boss.w - 6, boss.h - 6, 10);
    ctx.stroke();
    ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = t.gold;
    ctx.fillText('SEWER KING', boss.x, y + boss.h * 0.55);
    const barW = boss.w - 16;
    const barX = x + 8;
    const barY = y - 10;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    roundRect(ctx, barX, barY, barW, 6, 3);
    ctx.fill();
    const pct = Math.max(0, boss.hp / boss.maxHp);
    ctx.fillStyle = t.coral;
    roundRect(ctx, barX, barY, barW * pct, 6, 3);
    ctx.fill();
    return pct;
  }

  root.TurdanoidSprites = {
    paintBrickBevel,
    paintHpPips,
    paintPaddle,
    paintBall,
    paintCapsule,
    paintPipe,
    paintShard,
    paintBoss,
    roundRect
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
