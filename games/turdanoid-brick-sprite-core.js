/* Pre-render brick sprites (material + crack + metal) for canvas drawImage. */
(function attachTurdanoidBrickSprite(root) {
  'use strict';

  function spriteKey(material, crackStage, metal, w, h, c1, c2) {
    const m = material || 'sewer';
    const c = Math.max(0, Math.min(3, crackStage | 0));
    const met = metal ? 1 : 0;
    const top = c1 || '#7af1c4';
    const bot = c2 || '#3aa97c';
    return `${m}|${c}|${met}|${Math.round(w)}|${Math.round(h)}|${top}|${bot}`;
  }

  function paintBrickSprite(ctx, w, h, opts) {
    const material = opts.material || 'sewer';
    const stage = Math.max(0, Math.min(3, opts.crackStage | 0));
    const metal = !!opts.metal;
    const c1 = opts.c1 || '#7af1c4';
    const c2 = opts.c2 || '#3aa97c';
    const glow = opts.glow || 'rgba(122,241,196,.45)';

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    roundRect(ctx, 1, h - 1, w, 4, 2);
    ctx.fill();

    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, c1);
    g.addColorStop(0.42, c1);
    g.addColorStop(0.72, c2);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    roundRect(ctx, 0, 0, w, h, 5);
    ctx.fill();
    ctx.shadowBlur = 0;

    paintMaterialTexture(ctx, w, h, material);
    const topGrad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    topGrad.addColorStop(0, 'rgba(255,255,255,.78)');
    topGrad.addColorStop(0.35, 'rgba(255,255,255,.28)');
    topGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = topGrad;
    roundRect(ctx, 1.5, 1, w - 3, h * 0.52, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.48)';
    ctx.fillRect(2, h - 3, w - 4, 2.5);
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(3, 2.5);
    ctx.lineTo(w - 3, 2.5);
    ctx.stroke();

    if (metal) {
      const mg = ctx.createLinearGradient(0, 0, w, h);
      mg.addColorStop(0, 'rgba(255,255,255,.55)');
      mg.addColorStop(0.5, 'rgba(180,195,210,.2)');
      mg.addColorStop(1, 'rgba(60,70,85,.35)');
      ctx.fillStyle = mg;
      roundRect(ctx, 2, 2, w - 4, h - 4, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath();
      ctx.arc(5, h / 2, 2, 0, 6.283);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w - 5, h / 2, 2, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = 'rgba(220,230,240,.35)';
      for (let s = 8; s < w - 8; s += 3) {
        ctx.fillRect(s, h / 2 - 0.5, 2.5, 1);
      }
    }

    if (stage >= 1) {
      paintCracks(ctx, w, h, stage);
    }

    ctx.strokeStyle = 'rgba(0,0,0,.32)';
    ctx.lineWidth = 1.2;
    roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 4.5);
    ctx.stroke();
  }

  function paintMaterialTexture(ctx, w, h, material) {
    if (material === 'porcelain') {
      ctx.strokeStyle = 'rgba(255,255,255,.4)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 3; i++) {
        const y = 4 + i * (h / 4);
        ctx.beginPath();
        ctx.moveTo(3, y);
        ctx.lineTo(w - 3, y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(w * 0.22, h * 0.35, w * 0.07, 0, 6.283);
      ctx.stroke();
    } else if (material === 'slime') {
      ctx.fillStyle = 'rgba(140,255,120,.4)';
      ctx.beginPath();
      ctx.ellipse(w * 0.72, h - 3, w * 0.2, 3.5, 0, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = 'rgba(180,255,150,.25)';
      ctx.beginPath();
      ctx.ellipse(w * 0.35, h * 0.6, w * 0.15, 2.5, 0, 0, 6.283);
      ctx.fill();
    } else if (material === 'tar') {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      roundRect(ctx, 2, h * 0.42, w - 4, h * 0.45, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(80,80,90,.2)';
      ctx.fillRect(4, h * 0.5, w - 8, 1);
    } else if (material === 'candy') {
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = 0; i < 4; i++) {
        const sx = 6 + (i % 2) * (w * 0.45);
        const sy = 5 + Math.floor(i / 2) * (h * 0.35);
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2, 0, 6.283);
        ctx.fill();
      }
    } else if (material === 'gold') {
      const sg = ctx.createLinearGradient(0, 0, w, h);
      sg.addColorStop(0, 'rgba(255,250,200,.75)');
      sg.addColorStop(0.35, 'rgba(255,220,90,.55)');
      sg.addColorStop(0.7, 'rgba(220,160,30,.45)');
      sg.addColorStop(1, 'rgba(140,90,10,.5)');
      ctx.fillStyle = sg;
      roundRect(ctx, 2, 2, w - 4, h - 4, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,180,.65)';
      ctx.lineWidth = 1.2;
      roundRect(ctx, 3, 3, w - 6, h - 6, 3);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillRect(4, 4, w * 0.35, 2);
    }
  }

  function paintCracks(ctx, w, h, stage) {
    ctx.lineWidth = 1.35;
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.beginPath();
    ctx.moveTo(w * 0.3, 2);
    ctx.lineTo(w * 0.32, h * 0.5);
    ctx.lineTo(w * 0.28, h - 3);
    if (stage >= 2) {
      ctx.moveTo(w * 0.65, 3);
      ctx.lineTo(w * 0.6, h * 0.55);
      ctx.lineTo(w * 0.7, h - 4);
    }
    if (stage >= 3) {
      ctx.moveTo(w * 0.45, 4);
      ctx.lineTo(w * 0.4, h - 2);
      ctx.moveTo(w * 0.55, h * 0.35);
      ctx.lineTo(w * 0.72, h * 0.62);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(w * 0.31, 3);
    ctx.lineTo(w * 0.29, h - 4);
    ctx.stroke();
    if (stage >= 3) {
      ctx.fillStyle = 'rgba(30,10,10,.25)';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, w * 0.12, 0, 6.283);
      ctx.fill();
    }
  }

  function roundRect(c, x, y, rw, rh, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + rw, y, x + rw, y + rh, r);
    c.arcTo(x + rw, y + rh, x, y + rh, r);
    c.arcTo(x, y + rh, x, y, r);
    c.arcTo(x, y, x + rw, y, r);
    c.closePath();
  }

  root.TurdanoidBrickSprite = {
    spriteKey,
    paintBrickSprite
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
