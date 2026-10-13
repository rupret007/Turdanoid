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
    const depth = Math.max(3.2, Math.min(5.6, h * 0.34));
    const fx = 0.7;
    const fy = 0.5;
    const fw = Math.max(4, w - depth - 1.1);
    const fh = Math.max(4, h - depth - 0.9);
    ctx.save();
    ctx.fillStyle = 'rgba(4,8,12,.96)';
    roundRect(ctx, 0, 0, w, h, 3.6);
    ctx.fill();
    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.moveTo(fx + fw - 0.2, fy + 1);
    ctx.lineTo(w - 0.45, fy + depth * 0.7);
    ctx.lineTo(w - 0.45, h - 0.45);
    ctx.lineTo(fx + fw - 0.2, fy + fh);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.52)';
    ctx.beginPath();
    ctx.moveTo(fx + fw - 0.2, fy + 1);
    ctx.lineTo(w - 0.45, fy + depth * 0.7);
    ctx.lineTo(w - 0.45, h - 0.45);
    ctx.lineTo(fx + fw - 0.2, fy + fh);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(4,4,8,.72)';
    ctx.beginPath();
    ctx.moveTo(fx + 0.4, fy + fh);
    ctx.lineTo(fx + fw, fy + fh);
    ctx.lineTo(w - 0.5, h - 0.4);
    ctx.lineTo(1.1, h - 0.4);
    ctx.closePath();
    ctx.fill();
    const face = ctx.createLinearGradient(fx, fy, fx + fw * 0.9, fy + fh);
    face.addColorStop(0, c1);
    face.addColorStop(0.42, c1);
    face.addColorStop(1, c2);
    ctx.fillStyle = face;
    roundRect(ctx, fx, fy, fw, fh, 3.1);
    ctx.fill();
    const key = ctx.createRadialGradient(fx + fw * 0.28, fy + fh * 0.26, 0.4, fx + fw * 0.34, fy + fh * 0.4, fw * 0.72);
    key.addColorStop(0, 'rgba(255,255,255,.46)');
    key.addColorStop(0.4, 'rgba(255,255,255,.08)');
    key.addColorStop(1, 'rgba(0,0,0,.2)');
    ctx.fillStyle = key;
    roundRect(ctx, fx, fy, fw, fh, 3.1);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.62)';
    ctx.beginPath();
    ctx.ellipse(fx + fw * 0.26, fy + fh * 0.26, fw * 0.14, fh * 0.1, -0.45, 0, 6.283);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(fx + 2.2, fy + 1.3);
    ctx.lineTo(fx + fw - 3, fy + 1.3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.lineWidth = 1;
    roundRect(ctx, fx + 0.35, fy + 0.35, fw - 0.7, fh - 0.7, 2.7);
    ctx.stroke();
    ctx.restore();
    return { extruded: true, depth: depth, inset: true, fx: fx, fy: fy, fw: fw, fh: fh };
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
    ctx.fillStyle = 'rgba(0,0,0,.48)';
    ctx.beginPath();
    ctx.ellipse(paddle.x, y + h + 8, w * 0.5, 6.2, 0, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = 'rgba(232,197,106,.08)';
    ctx.beginPath();
    ctx.ellipse(paddle.x, y + h + 10, w * 0.38, 3.2, 0, 0, 6.283);
    ctx.fill();
    const cupY = y - 3;
    const cupH = h + 7;
    const body = ctx.createLinearGradient(x, cupY, x + w, cupY + cupH);
    body.addColorStop(0, '#ffb098');
    body.addColorStop(0.22, t.coral);
    body.addColorStop(0.58, '#c02830');
    body.addColorStop(1, '#4a0c14');
    ctx.fillStyle = body;
    ctx.shadowColor = p.fire ? t.coral : (p.gold ? t.brass : t.slime);
    ctx.shadowBlur = 18;
    roundRect(ctx, x, cupY, w, cupH, cupH / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,236,220,.55)';
    ctx.lineWidth = 1.7;
    roundRect(ctx, x + 1.4, cupY + 1.2, w - 2.8, cupH - 2.4, cupH / 2 - 1);
    ctx.stroke();
    const cavity = ctx.createRadialGradient(paddle.x - w * 0.12, cupY + cupH * 0.32, 2, paddle.x, cupY + cupH * 0.62, w * 0.46);
    cavity.addColorStop(0, 'rgba(90,16,22,.12)');
    cavity.addColorStop(0.5, 'rgba(28,4,8,.5)');
    cavity.addColorStop(1, 'rgba(8,0,2,.78)');
    ctx.fillStyle = cavity;
    roundRect(ctx, x + 6, cupY + 4, w - 12, cupH - 8, cupH / 2 - 3);
    ctx.fill();
    ctx.fillStyle = t.brassDeep;
    roundRect(ctx, paddle.x - 6, cupY - 8, 12, 9, 3);
    ctx.fill();
    ctx.fillStyle = t.brass;
    roundRect(ctx, paddle.x - 5, cupY - 18, 10, 14, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(80,48,12,.45)';
    ctx.fillRect(paddle.x - 4, cupY - 14, 8, 1.4);
    ctx.fillRect(paddle.x - 4, cupY - 10, 8, 1.4);
    const sheen = ctx.createLinearGradient(x, cupY, x, cupY + cupH * 0.4);
    sheen.addColorStop(0, 'rgba(255,255,255,.78)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    roundRect(ctx, x + 8, cupY + 1.6, w - 16, cupH * 0.32, cupH * 0.2);
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
    const pulse = reduced ? 1 : 1 + Math.sin((nowMs || 0) * 0.008 + (powerup.wob || 0)) * 0.08;
    const haloR = (reduced ? 22 : 26) * pulse;
    const halo = ctx.createRadialGradient(x, y, 2, x, y, haloR);
    halo.addColorStop(0, powerup.col || t.slime);
    halo.addColorStop(0.45, 'rgba(0,0,0,0.0)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (!reduced) {
      for (let i = 0; i < 6; i += 1) {
        const ang = (nowMs || 0) * 0.0024 + i * 1.047;
        const sr = haloR * 0.72;
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.fillRect(x + Math.cos(ang) * sr - 0.7, y + Math.sin(ang) * sr - 0.7, 1.4, 1.4);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,.38)';
    ctx.beginPath();
    ctx.ellipse(x, y + 17, 13, 3.4, 0, 0, 6.283);
    ctx.fill();
    const glass = ctx.createLinearGradient(x - 14, y - 16, x + 14, y + 16);
    glass.addColorStop(0, 'rgba(240,250,246,.34)');
    glass.addColorStop(0.32, powerup.bad ? 'rgba(90,22,28,.82)' : 'rgba(12,36,44,.5)');
    glass.addColorStop(1, powerup.bad ? 'rgba(36,8,12,.92)' : 'rgba(6,16,22,.9)');
    ctx.fillStyle = glass;
    roundRect(ctx, x - 13, y - 15, 26, 30, 11);
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,244,240,.5)';
    ctx.lineWidth = 1.4;
    roundRect(ctx, x - 12.2, y - 14.2, 24.4, 28.4, 10);
    ctx.stroke();
    ctx.fillStyle = powerup.col || t.slime;
    ctx.globalAlpha = 0.82;
    roundRect(ctx, x - 11, y - 1, 22, 14, 8);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,.38)';
    ctx.beginPath();
    ctx.ellipse(x, y - 1, 9, 2.2, 0, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath();
    ctx.arc(x - 5, y + 5, 1.5, 0, 6.283);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 3, y + 8, 1.1, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = t.metal;
    roundRect(ctx, x - 8, y - 19, 16, 7, 2.4);
    ctx.fill();
    ctx.fillStyle = t.brass;
    ctx.fillRect(x - 7, y - 18, 14, 2);
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.fillRect(x - 6, y - 17.6, 6, 1.2);
    ctx.save();
    ctx.translate(x, y + 4);
    if (!reduced) {
      ctx.rotate(Math.sin((nowMs || 0) * 0.003 + (powerup.wob || 0)) * 0.1);
    }
    ctx.font = 'bold 16px system-ui, "Apple Color Emoji", "Segoe UI Emoji"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(powerup.e || '?', 0, 0);
    ctx.restore();
    ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(6,16,22,.85)';
    ctx.strokeText(powerup.lab || '', x, y + 22);
    ctx.fillStyle = t.inkText;
    ctx.fillText(powerup.lab || '', x, y + 22);
    ctx.textBaseline = 'alphabetic';
    return { x: x, y: y, vial: true, sparkle: !reduced };
  }

  function paintAtmosphere(ctx, view) {
    const W = (view && view.W) || 390;
    const H = (view && view.H) || 844;
    const reduced = !!(view && view.reducedMotion);
    const t = tokens();
    const now = (view && view.nowMs) || 0;
    const flicker = reduced ? 1 : 0.9 + 0.1 * Math.sin(now * 0.003);
    ctx.save();
    const cone = ctx.createLinearGradient(W * 0.5, 0, W * 0.5, H * 0.78);
    cone.addColorStop(0, `rgba(255,230,160,${0.38 * flicker})`);
    cone.addColorStop(0.16, `rgba(232,197,106,${0.18 * flicker})`);
    cone.addColorStop(0.5, `rgba(184,212,200,${0.06 * flicker})`);
    cone.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(W * 0.38, 0);
    ctx.lineTo(W * 0.62, 0);
    ctx.lineTo(W * 0.96, H * 0.82);
    ctx.lineTo(W * 0.04, H * 0.82);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(232,197,106,.18)';
    ctx.beginPath();
    ctx.ellipse(W * 0.5, 18, 34, 10, 0, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = t.brass;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.ellipse(W * 0.5, 12, 20, 5.5, 0, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = t.brassDeep;
    ctx.fillRect(W * 0.5 - 1.2, 0, 2.4, 9);
    ctx.globalAlpha = 1;
    const moteCount = 14;
    for (let i = 0; i < moteCount; i += 1) {
      const drift = reduced ? 0 : (now * 0.012 + i * 17) % (H * 0.7);
      const mx = W * (0.18 + ((i * 37) % 64) / 100);
      const my = H * 0.08 + drift * 0.55;
      ctx.fillStyle = `rgba(255,244,210,${0.08 + (i % 4) * 0.04})`;
      ctx.beginPath();
      ctx.arc(mx, my, 0.8 + (i % 3) * 0.35, 0, 6.283);
      ctx.fill();
    }
    const haze = ctx.createRadialGradient(W * 0.5, H * 0.16, 8, W * 0.5, H * 0.38, Math.max(W, H) * 0.72);
    haze.addColorStop(0, 'rgba(232,244,239,.07)');
    haze.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, H);
    const floor = ctx.createLinearGradient(0, H * 0.78, 0, H);
    floor.addColorStop(0, 'rgba(0,0,0,0)');
    floor.addColorStop(0.55, 'rgba(232,197,106,.05)');
    floor.addColorStop(1, 'rgba(184,212,200,.1)');
    ctx.fillStyle = floor;
    ctx.fillRect(0, H * 0.78, W, H * 0.22);
    ctx.restore();
    return { cone: true, flicker: flicker, motes: moteCount };
  }

  function worldId(world) {
    return (world && world.id) || 'bathroom';
  }

  function worldStageSpec(world) {
    const id = worldId(world);
    const staged = world && world.stage;
    const tiles = {
      bathroom: 'square',
      sewer: 'bond',
      toxic: 'algae',
      candy: 'diamond',
      throne: 'slab'
    };
    return {
      id: id,
      tile: (staged && staged.tile) || tiles[id] || 'square',
      rail: (staged && staged.rail) || 'brass'
    };
  }

  function worldBasinColors(world) {
    const id = worldId(world);
    if (id === 'throne') {
      return {
        hi: 'rgba(232,197,106,.78)',
        mid: 'rgba(120,80,24,.9)',
        lo: 'rgba(40,28,10,.96)',
        crest: 'rgba(240,212,120,.55)'
      };
    }
    if (id === 'candy') {
      return {
        hi: 'rgba(216,120,168,.75)',
        mid: 'rgba(90,28,70,.9)',
        lo: 'rgba(28,8,22,.96)',
        crest: 'rgba(232,160,200,.5)'
      };
    }
    if (id === 'sewer' || id === 'toxic') {
      return {
        hi: 'rgba(96,150,70,.8)',
        mid: 'rgba(58,96,46,.88)',
        lo: 'rgba(28,46,26,.96)',
        crest: 'rgba(190,255,170,.38)'
      };
    }
    return {
      hi: 'rgba(184,212,200,.72)',
      mid: 'rgba(40,80,96,.88)',
      lo: 'rgba(10,28,36,.96)',
      crest: 'rgba(232,244,239,.42)'
    };
  }

  function worldBubbleColor(world) {
    const id = worldId(world);
    if (id === 'throne') {
      return 'rgba(232,197,106,.5)';
    }
    if (id === 'candy') {
      return 'rgba(216,120,168,.5)';
    }
    if (id === 'sewer' || id === 'toxic') {
      return 'rgba(134,216,106,.5)';
    }
    return 'rgba(94,200,224,.48)';
  }

  function worldDripColors(world) {
    const id = worldId(world);
    if (id === 'throne') {
      return ['rgba(232,197,106,.9)', 'rgba(168,120,28,.7)', 'rgba(90,64,16,.4)'];
    }
    if (id === 'candy') {
      return ['rgba(232,160,200,.9)', 'rgba(180,80,140,.7)', 'rgba(90,28,70,.4)'];
    }
    if (id === 'bathroom') {
      return ['rgba(184,212,200,.9)', 'rgba(94,200,224,.65)', 'rgba(40,90,110,.35)'];
    }
    return ['rgba(150,220,140,.95)', 'rgba(110,190,110,.7)', 'rgba(90,170,100,.35)'];
  }

  function paintTileGrid(ctx, spec, view) {
    const W = view.W;
    const startY = 46;
    const endY = view.H * 0.78;
    const tile = spec.tile;
    let tw = 40;
    let th = 40;
    let grout = 'rgba(232,244,239,.48)';
    let wash = 'rgba(232,244,239,.12)';
    if (tile === 'bond' || tile === 'algae') {
      tw = 62;
      th = 26;
      grout = tile === 'algae' ? 'rgba(134,216,106,.42)' : 'rgba(62,207,154,.4)';
      wash = tile === 'algae' ? 'rgba(134,216,106,.14)' : 'rgba(26,122,88,.16)';
    } else if (tile === 'diamond') {
      tw = 36;
      th = 36;
      grout = 'rgba(216,120,168,.46)';
      wash = 'rgba(216,120,168,.14)';
    } else if (tile === 'slab') {
      tw = 88;
      th = 64;
      grout = 'rgba(232,197,106,.5)';
      wash = 'rgba(240,212,120,.12)';
    }
    ctx.save();
    ctx.strokeStyle = grout;
    ctx.lineWidth = 1.45;
    let drawn = 0;
    if (tile === 'diamond') {
      for (let y = startY; y < endY; y += th) {
        for (let x = -tw / 2; x < W + tw; x += tw) {
          const cx = x + tw / 2;
          const cy = y + th / 2;
          ctx.beginPath();
          ctx.moveTo(cx, y);
          ctx.lineTo(x + tw, cy);
          ctx.lineTo(cx, y + th);
          ctx.lineTo(x, cy);
          ctx.closePath();
          ctx.stroke();
          drawn += 1;
        }
      }
    } else {
      for (let row = 0, y = startY; y < endY; row += 1, y += th) {
        const ox = (tile === 'bond' || tile === 'algae') && row % 2 === 1 ? tw / 2 : 0;
        for (let x = -ox; x < W + tw; x += tw) {
          ctx.strokeRect(x, y, tw - 1.2, th - 1.2);
          if ((row + Math.floor(x / tw)) % 3 === 0) {
            ctx.fillStyle = wash;
            ctx.fillRect(x + 1.4, y + 1.4, tw - 4, th - 4);
          }
          drawn += 1;
        }
      }
    }
    ctx.restore();
    return { tile: tile, count: drawn, tw: tw, th: th };
  }

  function paintStageFixtures(ctx, spec, view) {
    const t = tokens();
    const W = view.W;
    const H = view.H;
    const y = H * 0.4;
    ctx.save();
    if (spec.id === 'bathroom') {
      ctx.fillStyle = t.brass;
      roundRect(ctx, 14, y, 7, 78, 2);
      ctx.fill();
      roundRect(ctx, 52, y, 7, 78, 2);
      ctx.fill();
      ctx.fillStyle = t.metal || '#c4d0dc';
      ctx.fillRect(18, y + 10, 38, 3.2);
      ctx.fillRect(18, y + 64, 38, 3.2);
      ctx.fillStyle = t.porcelainDim;
      roundRect(ctx, 20, y + 16, 32, 42, 4);
      ctx.fill();
      ctx.fillStyle = t.porcelain;
      roundRect(ctx, W - 64, y + 28, 48, 16, 6);
      ctx.fill();
      ctx.strokeStyle = t.brass;
      ctx.lineWidth = 1.4;
      roundRect(ctx, W - 64, y + 28, 48, 16, 6);
      ctx.stroke();
    } else if (spec.id === 'sewer' || spec.id === 'toxic') {
      ctx.strokeStyle = spec.id === 'toxic' ? '#86d86a' : t.slime;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(28, y + 36, 16, 0, 6.283);
      ctx.stroke();
      ctx.fillStyle = t.metal || '#c4d0dc';
      ctx.beginPath();
      ctx.arc(28, y + 36, 5, 0, 6.283);
      ctx.fill();
      ctx.fillRect(W - 22, y + 8, 8, 70);
    } else if (spec.id === 'candy') {
      ctx.fillStyle = t.rose;
      ctx.beginPath();
      ctx.arc(26, y + 22, 14, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = t.candy || t.rose;
      ctx.fillRect(24, y + 34, 4, 40);
      ctx.beginPath();
      ctx.arc(W - 28, y + 50, 12, 0, 6.283);
      ctx.fill();
    } else {
      ctx.fillStyle = t.gold;
      ctx.beginPath();
      ctx.moveTo(22, y + 8);
      ctx.lineTo(38, y + 26);
      ctx.lineTo(28, y + 26);
      ctx.lineTo(28, y + 40);
      ctx.lineTo(16, y + 40);
      ctx.lineTo(16, y + 26);
      ctx.lineTo(6, y + 26);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return spec.id;
  }

  function paintWorldStage(ctx, world, view) {
    const W = (view && view.W) || 390;
    const H = (view && view.H) || 844;
    const spec = worldStageSpec(world);
    const t = tokens();
    const railY = H * 0.56;
    ctx.save();
    const grid = paintTileGrid(ctx, spec, { W: W, H: H });
    const wainscot = ctx.createLinearGradient(0, railY, 0, H * 0.82);
    if (spec.id === 'throne') {
      wainscot.addColorStop(0, 'rgba(232,197,106,.28)');
      wainscot.addColorStop(1, 'rgba(80,56,16,.32)');
    } else if (spec.id === 'candy') {
      wainscot.addColorStop(0, 'rgba(216,120,168,.24)');
      wainscot.addColorStop(1, 'rgba(60,16,48,.3)');
    } else if (spec.id === 'sewer' || spec.id === 'toxic') {
      wainscot.addColorStop(0, 'rgba(62,207,154,.22)');
      wainscot.addColorStop(1, 'rgba(12,40,28,.3)');
    } else {
      wainscot.addColorStop(0, 'rgba(232,244,239,.28)');
      wainscot.addColorStop(1, 'rgba(94,200,224,.18)');
    }
    ctx.fillStyle = wainscot;
    ctx.fillRect(0, railY, W, H * 0.26);
    ctx.fillStyle = spec.rail === 'gold' || spec.rail === 'brass'
      ? t.brass
      : (spec.rail === 'rose' ? t.rose : (spec.rail === 'hazard' ? '#e4bc48' : t.slime));
    ctx.fillRect(0, railY, W, 6);
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fillRect(0, railY, W, 1.1);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(0, railY + 4, W, 2);
    if (!view || view.fixtures !== false) {
      paintStageFixtures(ctx, spec, { W: W, H: H });
    }
    ctx.fillStyle = t.brass;
    ctx.beginPath();
    ctx.ellipse(W * 0.5, H - 11, 20, 4.5, 0, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = t.inkDeep;
    ctx.beginPath();
    ctx.ellipse(W * 0.5, H - 11, 11, 2.4, 0, 0, 6.283);
    ctx.fill();
    ctx.restore();
    return {
      id: spec.id,
      tile: spec.tile,
      rail: spec.rail,
      tiles: grid.count,
      wainscot: true,
      basin: true
    };
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
    ctx.save();
    const halo = ctx.createRadialGradient(boss.x, y + boss.h * 0.4, 6, boss.x, y + boss.h * 0.4, boss.w * 0.7);
    halo.addColorStop(0, 'rgba(232,197,106,.24)');
    halo.addColorStop(1, 'rgba(232,197,106,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.ellipse(boss.x, y + boss.h * 0.45, boss.w * 0.62, boss.h * 0.95, 0, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    roundRect(ctx, x + 5, y + 7, boss.w, boss.h, 12);
    ctx.fill();
    const g = ctx.createLinearGradient(x, y, x, y + boss.h);
    g.addColorStop(0, '#f0d478');
    g.addColorStop(0.28, t.brass);
    g.addColorStop(0.7, '#5a3a14');
    g.addColorStop(1, t.inkDeep);
    ctx.fillStyle = g;
    roundRect(ctx, x, y, boss.w, boss.h, 12);
    ctx.fill();
    ctx.fillStyle = 'rgba(8,14,18,.55)';
    roundRect(ctx, x + 8, y + 14, boss.w - 16, Math.max(10, boss.h - 22), 8);
    ctx.fill();
    ctx.strokeStyle = t.gold;
    ctx.lineWidth = 2.2;
    roundRect(ctx, x + 3, y + 3, boss.w - 6, boss.h - 6, 10);
    ctx.stroke();
    ctx.fillStyle = t.brass;
    [[x + 10, y + 10], [x + boss.w - 10, y + 10], [x + 10, y + boss.h - 10], [x + boss.w - 10, y + boss.h - 10]].forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 2.2, 0, 6.283);
      ctx.fill();
    });
    ctx.fillStyle = t.gold;
    ctx.beginPath();
    ctx.moveTo(boss.x - 22, y + 2);
    ctx.lineTo(boss.x - 14, y - 10);
    ctx.lineTo(boss.x - 6, y + 2);
    ctx.lineTo(boss.x, y - 12);
    ctx.lineTo(boss.x + 6, y + 2);
    ctx.lineTo(boss.x + 14, y - 10);
    ctx.lineTo(boss.x + 22, y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = t.coral;
    ctx.beginPath();
    ctx.arc(boss.x, y - 12, 2.4, 0, 6.283);
    ctx.fill();
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = t.gold;
    ctx.fillText('SEWER KING', boss.x, y + boss.h * 0.58);
    const barW = boss.w - 20;
    const barX = x + 10;
    const barY = y - 16;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    roundRect(ctx, barX, barY, barW, 7, 3.5);
    ctx.fill();
    const pct = Math.max(0, boss.hp / boss.maxHp);
    ctx.fillStyle = t.coral;
    roundRect(ctx, barX, barY, barW * pct, 7, 3.5);
    ctx.fill();
    ctx.strokeStyle = t.brass;
    ctx.lineWidth = 1;
    roundRect(ctx, barX, barY, barW, 7, 3.5);
    ctx.stroke();
    ctx.restore();
    return { pct: pct, crown: true };
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
    paintAtmosphere,
    paintWorldStage,
    worldStageSpec,
    worldBasinColors,
    worldBubbleColor,
    worldDripColors,
    roundRect
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
