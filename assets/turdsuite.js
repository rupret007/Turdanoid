/* ============================================================
   TurdAnoid Suite — shared runtime
   Loaded by every game. Provides:
   - Suite.toast(msg)       small floating message at the top
   - Suite.hype(msg, ms)    big center callout
   - Suite.fart() / .beep() / .ding() / .buzz()  shared SFX
   - auto: back-to-hub pill on every page (suppress with
     <body data-suite-no-back="1"> or window.SUITE_NO_BACK = true)
   - auto: ambient sewer backdrop (.suite-bg — tiles, wisps, bubbles;
     suppress with <body data-suite-no-bg="1">)
   - auto: iPhone double-tap-zoom prevention
   ============================================================ */
(function () {
  'use strict';

  // ---------- Audio ----------
  let actx = null;
  let muted = false;
  try { muted = localStorage.getItem('turdsuite_muted') === '1'; } catch (e) {}

  function ctx() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { actx = null; }
    }
    return actx;
  }
  function tone(freq, dur, type, vol, slide) {
    if (muted) return;
    const a = ctx(); if (!a) return;
    try {
      const o = a.createOscillator(), g = a.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), a.currentTime + dur);
      g.gain.value = vol || 0.05;
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
      o.connect(g).connect(a.destination);
      o.start(); o.stop(a.currentTime + dur);
    } catch (e) {}
  }

  const Suite = {
    setMuted(b) { muted = !!b; try { localStorage.setItem('turdsuite_muted', b ? '1' : '0'); } catch (e) {} },
    isMuted() { return muted; },
    beep: function (f, d, t, v, s) { tone(f || 660, d || 0.06, t || 'triangle', v || 0.05, s || 0); },
    ding: function () {
      tone(660, 0.08, 'triangle', 0.05); setTimeout(() => tone(990, 0.1, 'triangle', 0.05), 60);
    },
    buzz: function () { tone(180, 0.18, 'sawtooth', 0.07, -100); },
    fart: function () {
      if (muted) return;
      const a = ctx(); if (!a) return;
      try {
        const o = a.createOscillator(), g = a.createGain(), lfo = a.createOscillator(), lg = a.createGain();
        o.type = 'sawtooth'; o.frequency.value = 120 + Math.random() * 30;
        lfo.type = 'sine'; lfo.frequency.value = 18 + Math.random() * 12; lg.gain.value = 40;
        lfo.connect(lg).connect(o.frequency);
        g.gain.value = 0.05;
        g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.4);
        o.connect(g).connect(a.destination);
        o.start(); lfo.start();
        o.stop(a.currentTime + 0.4); lfo.stop(a.currentTime + 0.4);
      } catch (e) {}
    },
    win: function () {
      if (muted) return;
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.07), i * 110));
    }
  };

  // ---------- Toast ----------
  let toastEl = null;
  let toastT = 0;
  Suite.toast = function (msg, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'suite-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    void toastEl.offsetWidth; // restart transition
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), ms || 1400);
  };

  // ---------- Hype ----------
  let hypeEl = null;
  let hypeT = 0;
  Suite.hype = function (msg, ms) {
    if (!hypeEl) {
      hypeEl = document.createElement('div');
      hypeEl.className = 'suite-hype';
      document.body.appendChild(hypeEl);
    }
    hypeEl.textContent = msg;
    void hypeEl.offsetWidth;
    hypeEl.classList.add('show');
    clearTimeout(hypeT);
    hypeT = setTimeout(() => hypeEl.classList.remove('show'), ms || 800);
  };

  // ---------- Quip banks (use Suite.quip('win') in any game) ----------
  const QUIPS = {
    win:    ['CERTIFIED FLUSHER', 'BOWL DOMINATED', 'SEWER ROYALTY', 'YOU WIN, KING/QUEEN OF SMELL'],
    lose:   ['FLUSHED', 'PLUNGED INTO DESPAIR', 'THE BOWL WINS AGAIN', 'TRY HOLDING IT NEXT TIME'],
    bust:   ['BUSTED LIKE A SEWER PIPE', 'OOF. EXPLOSIVE.', 'THAT WAS A LOT', 'TOO MUCH CURRY'],
    win_s:  ['NICE!', 'SLEEK!', 'TIDY!', 'CHEFS KISS', '✨ FLUSH-WORTHY ✨'],
    lose_s: ['oof', 'rip', 'classic', 'plumbing required'],
    pickup: ['NICE GRAB', 'INTO THE BOWL', 'GOOD HANDS'],
    streak: ['ON A ROLL', 'COMBO LOCKED', 'CHAIN OF DOOKIE', 'UNFLUSHABLE'],
    deal:   ['DEAL ME IN', 'DEAL THOSE TURDS', 'ANTE UP'],
    bid:    ['BIG TALK', 'WE LOVE CONFIDENCE', 'BOLD MOVE'],
    knock:  ['KNOCK KNOCK', 'WHOS THERE? POINTS.', 'CLEAN-UP TIME'],
    gin:    ['GIN! 🍸', 'PERFECT HAND', 'ABSOLUTE UNIT'],
    spades_break: ['SPADES BROKEN', 'GLOVES OFF', 'NOW WE PLAY DIRTY'],
    line:   ['LINE CLEAR', 'SCRUBBED', 'SQUEAKY CLEAN'],
    tetris: ['TETRIS! ', 'QUAD KILL', 'FOUR LINES, ONE FLUSH'],
    tspin:  ['T-SPIN! ', 'TWIRLED & FLUSHED', 'SHOWING OFF'],
    perfect:['PERFECT CLEAR!', 'NOTHING LEFT', 'IMMACULATE'],
  };
  Suite.quip = function (key) {
    const arr = QUIPS[key]; if (!arr || !arr.length) return '';
    return arr[Math.floor(Math.random() * arr.length)];
  };

  // ---------- Back-to-Hub pill ----------
  function injectBackPill() {
    try {
      const skip = (document.body && document.body.dataset && document.body.dataset.suiteNoBack === '1') ||
                   window.SUITE_NO_BACK === true;
      if (skip) return;
      // Don't inject on either the canonical root hub or its legacy redirect.
      // GitHub Pages project URLs can be /Turdanoid or /Turdanoid/ — both are the door.
      if (isSuiteHubPage(currentPageName())) return;
      if (document.querySelector('.suite-back-pill')) return;
      const a = document.createElement('a');
      a.className = 'suite-back-pill';
      a.href = './';
      a.innerHTML = '<span class="arrow">←</span> Hub';
      a.setAttribute('aria-label', 'Back to game hub');
      document.body.appendChild(a);
    } catch (e) {}
  }

  // ---------- Ambient sewer backdrop ----------
  // Fixed layer behind every page (tiles, stink wisps, rising bubbles,
  // vignette). Pure CSS animation; suppress with <body data-suite-no-bg="1">.
  function injectAmbientBg() {
    try {
      if (!document.body) return;
      if (document.body.dataset && document.body.dataset.suiteNoBg === '1') return;
      if (document.querySelector('.suite-bg')) return;
      const bg = document.createElement('div');
      bg.className = 'suite-bg';
      bg.setAttribute('aria-hidden', 'true');
      let html = '<div class="suite-bg-tiles"></div>';
      for (let i = 0; i < 3; i++) html += '<div class="suite-bg-wisp"></div>';
      for (let i = 0; i < 12; i++) html += '<i class="suite-bg-bubble"></i>';
      html += '<div class="suite-bg-vignette"></div>';
      bg.innerHTML = html;
      document.body.insertBefore(bg, document.body.firstChild);
    } catch (e) {}
  }

  // ---------- iPhone niceties ----------
  function preventDoubleTapZoom() {
    let last = 0;
    document.addEventListener('touchend', function (e) {
      const now = Date.now();
      if (now - last <= 350) {
        // Don't prevent default on form controls — typing/scrolling needs to work
        const t = e.target;
        if (!t || (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA' && t.tagName !== 'SELECT')) {
          e.preventDefault();
        }
      }
      last = now;
    }, { passive: false });
  }

  // ---------- Last-played hub mark ----------
  const LIVE_HUB_GAMES = ['TurdAnoid.html', 'turdtris.html', 'turdjack.html', 'crapeights.html', 'turdrummy.html', 'turdspades.html'];
  const LAST_GAME_KEY = 'turdsuite_last_game';

  function currentPageName() {
    return (location.pathname || '').split('/').pop() || '';
  }

  function isSuiteHubPage(page) {
    const name = String(page || '').toLowerCase();
    return !name || name === 'index.html' || name === 'hub.html' || name === 'turdanoid';
  }

  function recordLastGame() {
    const page = currentPageName();
    if (!LIVE_HUB_GAMES.includes(page)) return;
    try { localStorage.setItem(LAST_GAME_KEY, page); } catch (e) {}
  }

  function markLastPlayedCard() {
    if (!isSuiteHubPage(currentPageName())) return;
    let last = '';
    try { last = localStorage.getItem(LAST_GAME_KEY) || ''; } catch (e) {}
    if (!LIVE_HUB_GAMES.includes(last)) return;
    const card = document.querySelector('.game-card[href="' + last + '"]');
    if (!card || card.classList.contains('last-played')) return;
    card.classList.add('last-played');
    const play = card.querySelector('.play');
    if (play) play.innerHTML = 'Play again <i>\u2192</i>';
    const title = card.querySelector('h2');
    if (title && !card.getAttribute('aria-label')) {
      card.setAttribute('aria-label', title.textContent.trim() + ', last played');
    }
  }

  // ---------- Boot ----------
  function boot() {
    injectAmbientBg();
    injectBackPill();
    preventDoubleTapZoom();
    recordLastGame();
    markLastPlayedCard();
    // unlock audio context on first interaction
    const unlock = function () {
      ctx();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.Suite = Suite;
})();
