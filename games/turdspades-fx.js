/**
 * TurdSpades table FX — trick sweep, spades-broken pulse; reduced-motion aware.
 */

/* global requestAnimationFrame */

export function prefersReducedMotion() {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  } catch {
    return false;
  }
}

const SEAT_ANCHORS = {
  You: { x: 0.5, y: 0.92 },
  West: { x: 0.12, y: 0.45 },
  North: { x: 0.5, y: 0.08 },
  East: { x: 0.88, y: 0.45 }
};

export function trickSweepDurationMs(reduced) {
  return reduced ? 0 : 520;
}

export function spadesBrokenParticleCount(reduced) {
  return reduced ? 0 : 18;
}

/**
 * @param {HTMLElement} layer fixed overlay inside the table
 * @param {Array<{ seat: string, label: string }>} cards
 * @param {string} winnerSeat
 */
export function runTrickSweep(layer, cards, winnerSeat, options = {}) {
  if (!layer || !Array.isArray(cards) || !cards.length) {
    return Promise.resolve();
  }
  const reduced = options.reduced ?? prefersReducedMotion();
  const duration = trickSweepDurationMs(reduced);
  if (duration === 0) {
    return Promise.resolve();
  }
  const rect = layer.getBoundingClientRect();
  const target = SEAT_ANCHORS[winnerSeat] || SEAT_ANCHORS.You;
  const tx = rect.width * target.x;
  const ty = rect.height * target.y;

  const ghosts = cards.map((card, i) => {
    const el = document.createElement('div');
    el.className = 'ts-sweep-card';
    el.textContent = card.label || '?';
    el.style.left = `${rect.width * 0.5 + (i - 1.5) * 28}px`;
    el.style.top = `${rect.height * 0.42}px`;
    layer.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transition = `transform ${duration}ms cubic-bezier(.25,.9,.3,1), opacity ${duration}ms ease`;
      el.style.transform = `translate(${tx - parseFloat(el.style.left)}px, ${ty - parseFloat(el.style.top)}px) scale(0.35)`;
      el.style.opacity = '0';
    });
    return el;
  });

  return new Promise((resolve) => {
    setTimeout(() => {
      ghosts.forEach((g) => g.remove());
      resolve();
    }, duration + 40);
  });
}

export function pulseSpadesBroken(tableEl, reduced) {
  if (!tableEl) {
    return;
  }
  const motion = reduced ?? prefersReducedMotion();
  tableEl.classList.remove('ts-spades-flash');
  void tableEl.offsetWidth;
  if (!motion) {
    tableEl.classList.add('ts-spades-flash');
    setTimeout(() => tableEl.classList.remove('ts-spades-flash'), 900);
  } else {
    tableEl.classList.add('ts-spades-lit');
    setTimeout(() => tableEl.classList.remove('ts-spades-lit'), 400);
  }
}

export function spawnSpadeShards(canvas, reduced) {
  const motionReduced = reduced ?? prefersReducedMotion();
  if (!canvas || motionReduced) {
    return;
  }
  const count = spadesBrokenParticleCount(motionReduced);
  if (!count) {
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  const w = canvas.width;
  const h = canvas.height;
  const shards = [];
  for (let i = 0; i < count; i++) {
    shards.push({
      x: w * 0.5 + (Math.random() - 0.5) * 80,
      y: h * 0.4 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 6,
      vy: -2 - Math.random() * 5,
      life: 28 + Math.floor(Math.random() * 18)
    });
  }
  let frame = 0;
  function tick() {
    ctx.clearRect(0, 0, w, h);
    let alive = 0;
    for (const s of shards) {
      if (s.life <= 0) {
        continue;
      }
      alive++;
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.18;
      s.life--;
      ctx.fillStyle = 'rgba(180,210,255,0.85)';
      ctx.fillRect(s.x, s.y, 4, 6);
    }
    frame++;
    if (alive > 0 && frame < 60) {
      requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
  }
  requestAnimationFrame(tick);
}
