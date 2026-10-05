/**
 * Crapjack page integrations (imported dynamically from turdjack.html).
 */
import { buildChipStackHtml } from './turdjack-chips.js';
import { buildFeltInlay } from './turdjack-felt.js';
import { createTurdjackAudio } from './turdjack-audio.js';
import { createTableFx } from './turdjack-fx.js';
import { handMeterState, renderHandMeterHtml } from './turdjack-hand-meter.js';

function suiteMuted() {
  try {
    return localStorage.getItem('turdsuite_muted') === '1';
  } catch (e) {
    return false;
  }
}

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
}

/**
 * @param {Window} win
 */
export function installTurdjackKit(win) {
  const doc = win.document;
  const table = doc.querySelector('.table');
  const canvas = doc.getElementById('tableFxCanvas');
  const ruleSummary = doc.getElementById('ruleSummary');

  const audio = createTurdjackAudio({
    getSoundEnabled: () => !!win.__turdjackSoundEnabled,
    getSuiteMuted: suiteMuted
  });

  win.__turdjackAudio = audio;

  let fx = null;
  if (canvas && table) {
    fx = createTableFx(canvas, { reducedMotion: prefersReducedMotion() });
    win.addEventListener('resize', () => fx.resize());
    try {
      win.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
        fx.setReducedMotion(e.matches);
      });
    } catch (e) {
      /* ignore */
    }
  }

  function paintFeltInlay() {
    if (!table) {return;}
    const note = ruleSummary ? String(ruleSummary.textContent || '') : '';
    const payout = note.includes('6:5') ? '6:5' : '3:2';
    const stands = !note.includes('hits soft 17');
    table.style.setProperty('--felt-inlay', buildFeltInlay(payout, stands));
  }

  paintFeltInlay();
  if (ruleSummary && win.MutationObserver) {
    new win.MutationObserver(paintFeltInlay).observe(ruleSummary, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  doc.querySelectorAll('[data-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) {return;}
      btn.classList.remove('tossed');
      void btn.offsetWidth;
      btn.classList.add('tossed');
    });
    btn.addEventListener('animationend', () => btn.classList.remove('tossed'));
  });

  function afterHud(state) {
    try {
      const betEl = doc.getElementById('betText');
      if (betEl && state) {
        const amount = state.splitRound
          ? (state.currentBet || 0) + (state.splitBet || 0)
          : (state.currentBet || 0);
        betEl.innerHTML = '$' + amount.toLocaleString() + buildChipStackHtml(amount);
      }
      updateHandMeters(doc, state);
    } catch (e) {
      /* ignore */
    }
  }

  function afterStatus(text) {
    if (!fx) {return;}
    try {
      fx.burstFromStatus(text);
      const note = String(text || '').toLowerCase();
      if (note.includes('bust') || (note.includes('blackjack') && !note.includes('dealer'))) {
        fx.shakeTable(table);
      }
      const live = doc.getElementById('jackLiveRegion');
      if (live) {live.textContent = String(text || '');}
    } catch (e) {
      /* ignore */
    }
  }

  return { audio, fx, paintFeltInlay, afterHud, afterStatus };
}

function updateHandMeters(doc, state) {
  if (!state || typeof state.handValue !== 'function') {return;}
  const playerMeter = doc.getElementById('playerHandMeter');
  const splitMeter = doc.getElementById('splitHandMeter');
  if (!playerMeter) {return;}

  const pTotal = state.handValue(state.playerHand || []);
  const pSoft = typeof state.isSoftHand === 'function' && state.isSoftHand(state.playerHand || []);
  playerMeter.innerHTML = renderHandMeterHtml(handMeterState(pTotal, pSoft));

  if (splitMeter) {
    const show = state.splitRound || (state.splitHand && state.splitHand.length);
    splitMeter.hidden = !show;
    if (show) {
      const sTotal = state.handValue(state.splitHand || []);
      const sSoft = typeof state.isSoftHand === 'function' && state.isSoftHand(state.splitHand || []);
      splitMeter.innerHTML = renderHandMeterHtml(handMeterState(sTotal, sSoft));
    }
  }
}
