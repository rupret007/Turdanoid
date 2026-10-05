import { createTurdspadesAudio } from './turdspades-audio.js';
import {
  prefersReducedMotion,
  pulseSpadesBroken,
  runTrickSweep,
  spawnSpadeShards
} from './turdspades-fx.js';
import { explainAiPlay, formatCardLabel, teamContractNeed } from './turdspades-ai.js';

const audio = createTurdspadesAudio();

function bindGestureUnlock() {
  const unlock = () => {
    audio.unlockFromGesture();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });
}

function ensureFxLayer(tableEl) {
  let layer = document.getElementById('tsSweepLayer');
  if (!layer && tableEl) {
    layer = document.createElement('div');
    layer.id = 'tsSweepLayer';
    layer.className = 'ts-sweep-layer';
    layer.setAttribute('aria-hidden', 'true');
    tableEl.appendChild(layer);
  }
  return layer;
}

function ensureFxCanvas(tableEl) {
  let canvas = document.getElementById('tsFxCanvas');
  if (!canvas && tableEl) {
    canvas = document.createElement('canvas');
    canvas.id = 'tsFxCanvas';
    canvas.className = 'ts-fx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    tableEl.appendChild(canvas);
    const resize = () => {
      const r = tableEl.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width));
      canvas.height = Math.max(1, Math.floor(r.height));
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });
  }
  return canvas;
}

function showBotHint(text) {
  if (!text) {
    return;
  }
  let el = document.getElementById('tsBotHint');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tsBotHint';
    el.className = 'ts-bot-hint';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(showBotHint._t);
  showBotHint._t = setTimeout(() => el.classList.remove('show'), 2800);
}

export function mountTurdspadesEnhancements() {
  bindGestureUnlock();
  const tableEl = document.querySelector('.table');
  const sweepLayer = ensureFxLayer(tableEl);
  const fxCanvas = ensureFxCanvas(tableEl);
  const reduced = () => prefersReducedMotion();

  window.__tsExplainAi = (player, card, flags = {}) => {
    const st = globalThis.state;
    if (!st) {
      return '';
    }
    const partner = (player + 2) % 4;
    const need = teamContractNeed(st.bids, st.tricks, player, partner);
    return explainAiPlay({
      player,
      card,
      playerBid: st.bids[player],
      partnerBid: st.bids[partner],
      teamNeed: need,
      nilCover: !!flags.nilCover,
      leading: !st.trick.length
    });
  };

  window.addEventListener('turdspades:card-played', (ev) => {
    const { card } = ev.detail || {};
    audio.playCardPlay(card);
  });

  window.addEventListener('turdspades:spades-broken', () => {
    audio.playSpadesBroken();
    pulseSpadesBroken(tableEl, reduced());
    spawnSpadeShards(fxCanvas, reduced());
  });

  window.addEventListener('turdspades:trick-complete', (ev) => {
    const { winner, trick } = ev.detail || {};
    audio.playTrickWin();
    if (!trick?.length) {
      return;
    }
    const cards = trick.map((e) => ({
      seat: e.playerName,
      label: formatCardLabel(e.card)
    }));
    const winnerName = ['You', 'West', 'North', 'East'][winner] || 'You';
    runTrickSweep(sweepLayer, cards, winnerName, { reduced: reduced() });
  });

  window.addEventListener('turdspades:bid-tick', () => audio.playBidTick());
  window.addEventListener('turdspades:bid-locked', (ev) => {
    audio.playBidLock(!!ev.detail?.nil);
  });
  window.addEventListener('turdspades:bag-penalty', () => audio.playBagPenalty());
  window.addEventListener('turdspades:match-end', (ev) => audio.playMatchFanfare(!!ev.detail?.won));

  window.addEventListener('turdspades:bot-hint', (ev) => {
    showBotHint(ev.detail?.text || '');
  });
}

mountTurdspadesEnhancements();
