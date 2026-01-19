/* eslint-disable no-console */
(() => {
  'use strict';

  const STORAGE_KEY = 'bj_v1';

  /** @typedef {{rank:string, suit:string}} Card */
  /** @typedef {{cards:Card[], betCents:number, doubled:boolean, isSplitHand:boolean, isSplitAces:boolean, finished:boolean, outcome?:string}} PlayerHand */

  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  const Phase = Object.freeze({
    BETTING: 'BETTING',
    DEALING: 'DEALING',
    INSURANCE: 'INSURANCE',
    PLAYER: 'PLAYER',
    DEALER: 'DEALER',
    ROUND_OVER: 'ROUND_OVER',
  });

  function clampInt(n, min, max) {
    const x = Number.isFinite(n) ? Math.trunc(n) : min;
    return Math.max(min, Math.min(max, x));
  }

  function dollarsToCents(dollars) {
    const d = Number(dollars);
    if (!Number.isFinite(d)) return 0;
    return Math.max(0, Math.round(d * 100));
  }

  function centsToString(cents) {
    const sign = cents < 0 ? '-' : '';
    const abs = Math.abs(cents);
    const dollars = Math.floor(abs / 100);
    const rem = abs % 100;
    if (rem === 0) return `${sign}$${dollars}`;
    return `${sign}$${dollars}.${String(rem).padStart(2, '0')}`;
  }

  function hasCryptoRng() {
    return typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function';
  }

  function cryptoFloat01() {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  }

  function rngFloat01() {
    return hasCryptoRng() ? cryptoFloat01() : Math.random();
  }

  function rngInt(maxExclusive) {
    if (maxExclusive <= 1) return 0;
    return Math.floor(rngFloat01() * maxExclusive);
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rngInt(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
  }

  function makeDeck() {
    /** @type {Card[]} */
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ rank, suit });
      }
    }
    return deck;
  }

  class Shoe {
    /**
     * @param {{decks:number, reshufflePenetration:number}} cfg
     */
    constructor(cfg) {
      this.decks = clampInt(cfg.decks, 1, 8);
      this.reshufflePenetration = Math.min(0.75, Math.max(0.1, cfg.reshufflePenetration));
      /** @type {Card[]} */
      this.cards = [];
      this.initialSize = 0;
      this.reset();
    }

    reset() {
      this.cards = [];
      for (let d = 0; d < this.decks; d++) {
        this.cards.push(...makeDeck());
      }
      shuffleInPlace(this.cards);
      this.initialSize = this.cards.length;
    }

    remaining() {
      return this.cards.length;
    }

    needsShuffle() {
      if (this.initialSize <= 0) return true;
      const remainingRatio = this.cards.length / this.initialSize;
      return remainingRatio <= (1 - this.reshufflePenetration);
    }

    draw() {
      if (this.cards.length === 0 || this.needsShuffle()) {
        this.reset();
      }
      const card = this.cards.pop();
      if (!card) {
        // Should never happen, but keep the game running.
        this.reset();
        return /** @type {Card} */ ({ rank: 'A', suit: '♠' });
      }
      return card;
    }
  }

  function isRedSuit(suit) {
    return suit === '♥' || suit === '♦';
  }

  function cardValue(card) {
    if (card.rank === 'A') return 1;
    if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') return 10;
    return clampInt(Number(card.rank), 2, 10);
  }

  function computeHand(cards) {
    let hard = 0;
    let aces = 0;
    for (const c of cards) {
      if (c.rank === 'A') aces++;
      hard += cardValue(c);
    }
    const soft = aces > 0 && hard + 10 <= 21 ? hard + 10 : null;
    const best = soft !== null ? soft : hard;
    const isSoft = soft !== null;
    const isBlackjack = cards.length === 2 && best === 21;
    const isBust = hard > 21;
    return { hard, soft, best, isSoft, isBlackjack, isBust };
  }

  function sameRankForSplit(a, b) {
    return a.rank === b.rank;
  }

  function isTenValue(card) {
    return card.rank === '10' || card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
  }

  function canOfferInsurance(dealerUpcard) {
    return dealerUpcard.rank === 'A';
  }

  function dealerUpcardSuggestsPeek(dealerUpcard) {
    return dealerUpcard.rank === 'A' || isTenValue(dealerUpcard);
  }

  function nowMs() {
    return Date.now();
  }

  function safeJsonParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  function loadPersisted() {
    const raw = globalThis.localStorage ? globalThis.localStorage.getItem(STORAGE_KEY) : null;
    const data = raw ? safeJsonParse(raw) : null;
    const defaults = {
      bankrollCents: 50000,
      settings: {
        decks: 6,
        hitSoft17: true,
        startingBankrollCents: 50000,
      },
      stats: {
        rounds: 0,
        hands: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
        blackjacks: 0,
        biggestWinCents: 0,
        lastPlayedAt: 0,
      },
    };
    if (!data || typeof data !== 'object') return defaults;

    const bankrollCents = clampInt(data.bankrollCents, 0, 10_000_000);
    const decks = clampInt(data?.settings?.decks, 1, 8);
    const hitSoft17 = Boolean(data?.settings?.hitSoft17);
    const startingBankrollCents = clampInt(data?.settings?.startingBankrollCents, 1000, 10_000_000);

    const stats = {
      rounds: clampInt(data?.stats?.rounds, 0, 1_000_000),
      hands: clampInt(data?.stats?.hands, 0, 5_000_000),
      wins: clampInt(data?.stats?.wins, 0, 5_000_000),
      losses: clampInt(data?.stats?.losses, 0, 5_000_000),
      pushes: clampInt(data?.stats?.pushes, 0, 5_000_000),
      blackjacks: clampInt(data?.stats?.blackjacks, 0, 5_000_000),
      biggestWinCents: clampInt(data?.stats?.biggestWinCents, 0, 10_000_000),
      lastPlayedAt: clampInt(data?.stats?.lastPlayedAt, 0, 9_999_999_999_999),
    };

    return {
      bankrollCents,
      settings: { decks, hitSoft17, startingBankrollCents },
      stats,
    };
  }

  function savePersisted(state) {
    if (!globalThis.localStorage) return;
    const safe = {
      bankrollCents: clampInt(state.bankrollCents, 0, 10_000_000),
      settings: {
        decks: clampInt(state.settings.decks, 1, 8),
        hitSoft17: Boolean(state.settings.hitSoft17),
        startingBankrollCents: clampInt(state.settings.startingBankrollCents, 1000, 10_000_000),
      },
      stats: { ...state.stats, lastPlayedAt: nowMs() },
    };
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  }

  function el(id) {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Missing element: ${id}`);
    return node;
  }

  // --- UI bindings ---
  const ui = {
    bankroll: el('bankroll'),
    shoeInfo: el('shoeInfo'),
    dealerRuleInfo: el('dealerRuleInfo'),
    dealerSub: el('dealerSub'),
    dealerTotalLabel: el('dealerTotalLabel'),
    dealerTotal: el('dealerTotal'),
    dealerCards: el('dealerCards'),
    playerSub: el('playerSub'),
    playerBet: el('playerBet'),
    playerTotal: el('playerTotal'),
    playerCards: el('playerCards'),
    handTabs: el('handTabs'),
    roundState: el('roundState'),
    outcomeBadge: el('outcomeBadge'),
    outcomeText: el('outcomeText'),
    statusLine: el('statusLine'),
    statusSub: el('statusSub'),
    a11yAnnounce: el('a11yAnnounce'),
    // Buttons
    dealBtn: el('dealBtn'),
    hitBtn: el('hitBtn'),
    standBtn: el('standBtn'),
    doubleBtn: el('doubleBtn'),
    splitBtn: el('splitBtn'),
    insuranceBtn: el('insuranceBtn'),
    newRoundBtn: el('newRoundBtn'),
    resetBtn: el('resetBtn'),
    clearBet: el('clearBet'),
    maxBet: el('maxBet'),
    chipsRow: el('chipsRow'),
    // Modals
    settingsBtn: el('settingsBtn'),
    helpBtn: el('helpBtn'),
    settingsModal: el('settingsModal'),
    helpModal: el('helpModal'),
    closeSettingsBtn: el('closeSettingsBtn'),
    closeHelpBtn: el('closeHelpBtn'),
    decksSelect: el('decksSelect'),
    hitSoft17Toggle: el('hitSoft17Toggle'),
    startingBankroll: el('startingBankroll'),
    statsLine: el('statsLine'),
    resetStatsBtn: el('resetStatsBtn'),
  };

  function setModalOpen(modalEl, openerBtn, open) {
    modalEl.setAttribute('aria-hidden', open ? 'false' : 'true');
    openerBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function announce(text) {
    ui.a11yAnnounce.textContent = text;
  }

  // --- Game state ---
  const persisted = loadPersisted();

  const state = {
    bankrollCents: persisted.bankrollCents,
    settings: { ...persisted.settings },
    stats: { ...persisted.stats },

    shoe: new Shoe({ decks: persisted.settings.decks, reshufflePenetration: 0.75 }),
    phase: Phase.BETTING,

    pendingBetCents: 0,
    dealerCards: /** @type {Card[]} */ ([]),
    dealerHoleHidden: true,

    hands: /** @type {PlayerHand[]} */ ([]),
    activeHandIndex: 0,

    insuranceOffered: false,
    insuranceBetCents: 0,
    lastRoundNetCents: 0,
  };

  function updateRulesBadges() {
    ui.shoeInfo.textContent = `${state.settings.decks}D`;
    ui.dealerRuleInfo.textContent = state.settings.hitSoft17 ? 'H17' : 'S17';
  }

  function updateStatsLine() {
    ui.statsLine.textContent =
      `Rounds ${state.stats.rounds} • Hands ${state.stats.hands} • W-L-P ${state.stats.wins}-${state.stats.losses}-${state.stats.pushes} • BJ ${state.stats.blackjacks}`;
  }

  function setStatus(line, sub = '') {
    ui.statusLine.textContent = line;
    ui.statusSub.textContent = sub;
    announce(line);
  }

  function setPhase(phase) {
    state.phase = phase;
    ui.roundState.textContent = ({
      [Phase.BETTING]: 'Betting',
      [Phase.DEALING]: 'Dealing',
      [Phase.INSURANCE]: 'Insurance',
      [Phase.PLAYER]: 'Your turn',
      [Phase.DEALER]: 'Dealer',
      [Phase.ROUND_OVER]: 'Round over',
    })[phase] || phase;
  }

  function renderCard(card, faceDown = false) {
    const div = document.createElement('div');
    div.className = `card ${faceDown ? 'back' : (isRedSuit(card.suit) ? 'red' : 'black')}`;
    div.setAttribute('role', 'img');
    if (faceDown) {
      div.setAttribute('aria-label', 'Face down card');
      const pip = document.createElement('div');
      pip.className = 'pip';
      pip.textContent = '🂠';
      div.appendChild(pip);
      return div;
    }
    div.setAttribute('aria-label', `${card.rank}${card.suit}`);

    const c1 = document.createElement('div');
    c1.className = 'corner';
    c1.innerHTML = `<div>${card.rank}</div><div>${card.suit}</div>`;

    const c2 = document.createElement('div');
    c2.className = 'corner bottom';
    c2.innerHTML = `<div>${card.rank}</div><div>${card.suit}</div>`;

    const pip = document.createElement('div');
    pip.className = 'pip';
    pip.textContent = card.suit;

    div.appendChild(c1);
    div.appendChild(pip);
    div.appendChild(c2);
    return div;
  }

  function renderHands() {
    // Dealer
    ui.dealerCards.innerHTML = '';
    const dealerCards = state.dealerCards;
    for (let i = 0; i < dealerCards.length; i++) {
      const faceDown = state.dealerHoleHidden && i === 1 && dealerCards.length >= 2;
      ui.dealerCards.appendChild(renderCard(dealerCards[i], faceDown));
    }

    // Player active hand
    ui.playerCards.innerHTML = '';
    const active = state.hands[state.activeHandIndex];
    const activeCards = active ? active.cards : [];
    for (const c of activeCards) ui.playerCards.appendChild(renderCard(c, false));

    // Tabs if split
    if (state.hands.length > 1) {
      ui.handTabs.style.display = '';
      ui.handTabs.innerHTML = '';
      state.hands.forEach((h, idx) => {
        const totals = computeHand(h.cards);
        const tab = document.createElement('button');
        tab.className = 'tab';
        tab.type = 'button';
        tab.setAttribute('aria-selected', idx === state.activeHandIndex ? 'true' : 'false');
        const totalLabel = totals.isBust ? 'BUST' : String(totals.best);
        const outcomeLabel = (state.phase === Phase.ROUND_OVER && h.outcome) ? ` • ${h.outcome}` : '';
        tab.textContent = `Hand ${idx + 1} • ${totalLabel}${outcomeLabel}`;
        tab.addEventListener('click', () => {
          state.activeHandIndex = idx;
          renderAll();
        });
        ui.handTabs.appendChild(tab);
      });
    } else {
      ui.handTabs.style.display = 'none';
    }
  }

  function renderTotals() {
    // Dealer total
    if (state.dealerCards.length === 0) {
      ui.dealerTotal.textContent = '?';
      ui.dealerTotalLabel.textContent = 'Total';
    } else if (state.dealerHoleHidden && state.dealerCards.length >= 2) {
      const up = computeHand([state.dealerCards[0]]);
      ui.dealerTotal.textContent = String(up.best);
      ui.dealerTotalLabel.textContent = 'Up';
    } else {
      const d = computeHand(state.dealerCards);
      ui.dealerTotal.textContent = String(d.best);
      ui.dealerTotalLabel.textContent = d.isSoft ? 'Soft' : 'Total';
    }

    // Player total + bet
    const active = state.hands[state.activeHandIndex];
    const totals = active ? computeHand(active.cards) : { best: 0, isSoft: false, isBust: false };
    ui.playerTotal.textContent = String(totals.best);
    ui.playerBet.textContent = centsToString(active ? active.betCents : state.pendingBetCents);
  }

  function renderTop() {
    ui.bankroll.textContent = centsToString(state.bankrollCents);
    updateRulesBadges();
    updateStatsLine();
  }

  function allowedActions() {
    const active = state.hands[state.activeHandIndex];
    const dealerUp = state.dealerCards[0];
    const can = {
      deal: false,
      hit: false,
      stand: false,
      double: false,
      split: false,
      insurance: false,
      next: false,
    };

    if (state.phase === Phase.BETTING) {
      can.deal = state.pendingBetCents > 0 && state.pendingBetCents <= state.bankrollCents;
      return can;
    }

    if (state.phase === Phase.INSURANCE) {
      can.insurance = dealerUp ? canOfferInsurance(dealerUp) : false;
      return can;
    }

    if (state.phase === Phase.PLAYER && active && !active.finished) {
      const totals = computeHand(active.cards);
      can.hit = !totals.isBust && totals.best < 21 && !(active.isSplitAces);
      can.stand = true;

      const isFirstDecision = active.cards.length === 2 && !active.doubled && !active.finished;
      if (isFirstDecision && state.bankrollCents >= active.betCents) {
        can.double = true;
      }

      if (isFirstDecision && active.cards.length === 2) {
        const [a, b] = active.cards;
        if (a && b && sameRankForSplit(a, b) && state.bankrollCents >= active.betCents) {
          can.split = true;
        }
      }
    }

    if (state.phase === Phase.ROUND_OVER) {
      can.next = true;
    }
    return can;
  }

  function renderButtons() {
    const can = allowedActions();
    ui.dealBtn.disabled = !can.deal;
    ui.hitBtn.disabled = !can.hit;
    ui.standBtn.disabled = !can.stand;
    ui.doubleBtn.disabled = !can.double;
    ui.splitBtn.disabled = !can.split;
    ui.insuranceBtn.disabled = !(state.phase === Phase.INSURANCE && can.insurance);
    ui.newRoundBtn.disabled = !can.next;

    // Betting chips row only when betting
    ui.chipsRow.style.display = state.phase === Phase.BETTING ? '' : 'none';

    // Contextual button labels for insurance phase
    if (state.phase === Phase.INSURANCE) {
      ui.insuranceBtn.textContent = 'Take Ins.';
      ui.standBtn.textContent = 'No Ins.';
      ui.standBtn.disabled = false;
    } else {
      ui.insuranceBtn.textContent = 'Insurance';
      ui.standBtn.textContent = 'Stand';
    }
  }

  function renderLabels() {
    ui.dealerSub.textContent = state.dealerHoleHidden ? 'Upcard shown' : 'Playing out';
    if (state.phase === Phase.BETTING) ui.playerSub.textContent = 'Place a bet to start';
    if (state.phase === Phase.INSURANCE) ui.playerSub.textContent = 'Insurance? (Dealer shows Ace)';
    if (state.phase === Phase.PLAYER) ui.playerSub.textContent = 'Your move';
    if (state.phase === Phase.DEALER) ui.playerSub.textContent = 'Dealer plays';
    if (state.phase === Phase.ROUND_OVER) ui.playerSub.textContent = 'Round complete';
  }

  function renderOutcome() {
    if (state.phase !== Phase.ROUND_OVER) {
      ui.outcomeBadge.style.display = 'none';
      return;
    }
    ui.outcomeBadge.style.display = '';
    const net = state.lastRoundNetCents;
    if (net > 0) ui.outcomeText.textContent = `+${centsToString(net)}`;
    else if (net < 0) ui.outcomeText.textContent = `${centsToString(net)}`;
    else ui.outcomeText.textContent = 'Push';
  }

  function renderAll() {
    renderTop();
    renderHands();
    renderTotals();
    renderLabels();
    renderButtons();
    renderOutcome();
  }

  function ensureShoeConfig() {
    state.shoe = new Shoe({ decks: state.settings.decks, reshufflePenetration: 0.75 });
  }

  function resetRoundToBetting({ keepPendingBet = false } = {}) {
    state.dealerCards = [];
    state.dealerHoleHidden = true;
    state.hands = [];
    state.activeHandIndex = 0;
    state.insuranceOffered = false;
    state.insuranceBetCents = 0;
    state.lastRoundNetCents = 0;
    if (!keepPendingBet) state.pendingBetCents = 0;
    setPhase(Phase.BETTING);
  }

  function startRound() {
    if (state.phase !== Phase.BETTING) return;
    const bet = state.pendingBetCents;
    if (bet <= 0) return;
    if (bet > state.bankrollCents) {
      setStatus('Not enough bankroll for that bet.', 'Lower the bet or reset bankroll in Settings.');
      return;
    }

    state.stats.rounds++;
    state.stats.hands++;
    state.stats.lastPlayedAt = nowMs();

    // Put bet at risk
    state.bankrollCents -= bet;
    state.hands = [{
      cards: [],
      betCents: bet,
      doubled: false,
      isSplitHand: false,
      isSplitAces: false,
      finished: false,
    }];
    state.activeHandIndex = 0;

    state.dealerCards = [];
    state.dealerHoleHidden = true;
    state.insuranceOffered = false;
    state.insuranceBetCents = 0;
    state.lastRoundNetCents = 0;

    state.pendingBetCents = bet; // Keep displayed bet during the hand
    setPhase(Phase.DEALING);
    dealInitial();
  }

  function dealCardToDealer() {
    state.dealerCards.push(state.shoe.draw());
  }

  function dealCardToHand(handIdx) {
    state.hands[handIdx].cards.push(state.shoe.draw());
  }

  function dealInitial() {
    // Initial deal: player, dealer, player, dealer
    dealCardToHand(0);
    dealCardToDealer();
    dealCardToHand(0);
    dealCardToDealer();

    // Hide dealer hole card initially
    state.dealerHoleHidden = true;

    const player0 = computeHand(state.hands[0].cards);
    const dealer0 = computeHand(state.dealerCards);
    const upcard = state.dealerCards[0];

    // Offer insurance if upcard Ace (before peek)
    if (upcard && canOfferInsurance(upcard)) {
      state.insuranceOffered = true;
      setPhase(Phase.INSURANCE);
      setStatus('Dealer shows an Ace.', 'Insurance is optional (Take Ins. or No Ins.).');
      renderAll();
      return;
    }

    // Peek if upcard suggests it
    if (upcard && dealerUpcardSuggestsPeek(upcard) && dealer0.isBlackjack) {
      // Dealer blackjack ends round immediately
      revealDealer();
      settleRound();
      return;
    }

    // If player blackjack (and dealer not blackjack), settle immediately
    if (player0.isBlackjack) {
      revealDealer();
      settleRound();
      return;
    }

    setPhase(Phase.PLAYER);
    setStatus('Your turn.', 'Hit, Stand, Double, or Split (if available).');
    renderAll();
  }

  function takeInsurance() {
    if (state.phase !== Phase.INSURANCE) return;
    const baseBet = state.hands[0]?.betCents ?? 0;
    const ins = Math.min(Math.floor(baseBet / 2), state.bankrollCents);
    if (ins <= 0) {
      setStatus('No bankroll available for insurance.', 'Continuing without insurance.');
      state.insuranceBetCents = 0;
    } else {
      state.bankrollCents -= ins;
      state.insuranceBetCents = ins;
      setStatus(`Insurance taken: ${centsToString(ins)}.`, 'Dealer will now check for blackjack.');
    }
    resolvePostInsurancePeek();
  }

  function skipInsurance() {
    if (state.phase !== Phase.INSURANCE) return;
    state.insuranceBetCents = 0;
    setStatus('No insurance.', 'Dealer will now check for blackjack.');
    resolvePostInsurancePeek();
  }

  function resolvePostInsurancePeek() {
    const dealer0 = computeHand(state.dealerCards);
    const player0 = computeHand(state.hands[0].cards);
    const dealerHasBJ = dealer0.isBlackjack;

    if (dealerHasBJ) {
      revealDealer();
      settleRound();
      return;
    }

    // Insurance lost (if taken) when dealer doesn't have blackjack; already deducted.
    if (player0.isBlackjack) {
      revealDealer();
      settleRound();
      return;
    }

    setPhase(Phase.PLAYER);
    setStatus('Your turn.', 'Dealer does not have blackjack.');
    renderAll();
  }

  function revealDealer() {
    state.dealerHoleHidden = false;
  }

  function activeHand() {
    return state.hands[state.activeHandIndex] || null;
  }

  function moveToNextUnfinishedHandOrDealer() {
    for (let i = 0; i < state.hands.length; i++) {
      const idx = (state.activeHandIndex + 1 + i) % state.hands.length;
      if (!state.hands[idx].finished) {
        state.activeHandIndex = idx;
        renderAll();
        return;
      }
    }
    // All hands done -> dealer
    dealerPlay();
  }

  function hit() {
    if (state.phase !== Phase.PLAYER) return;
    const h = activeHand();
    if (!h || h.finished) return;
    if (h.isSplitAces) return;

    dealCardToHand(state.activeHandIndex);
    const t = computeHand(h.cards);
    if (t.isBust) {
      h.finished = true;
      setStatus('Bust.', 'Moving on.');
      moveToNextUnfinishedHandOrDealer();
      return;
    }
    if (t.best === 21) {
      h.finished = true;
      setStatus('21.', 'Standing automatically.');
      moveToNextUnfinishedHandOrDealer();
      return;
    }
    renderAll();
  }

  function stand() {
    if (state.phase !== Phase.PLAYER) return;
    const h = activeHand();
    if (!h || h.finished) return;
    h.finished = true;
    setStatus('Stand.', 'Moving on.');
    moveToNextUnfinishedHandOrDealer();
  }

  function doubleDown() {
    if (state.phase !== Phase.PLAYER) return;
    const h = activeHand();
    if (!h || h.finished) return;
    if (h.cards.length !== 2 || h.doubled) return;
    if (state.bankrollCents < h.betCents) {
      setStatus('Not enough bankroll to double.', 'Try Hit or Stand.');
      renderAll();
      return;
    }
    state.bankrollCents -= h.betCents;
    h.betCents *= 2;
    h.doubled = true;

    dealCardToHand(state.activeHandIndex);
    h.finished = true;
    setStatus('Double.', 'One card and stand.');
    moveToNextUnfinishedHandOrDealer();
  }

  function split() {
    if (state.phase !== Phase.PLAYER) return;
    const h = activeHand();
    if (!h || h.finished) return;
    if (h.cards.length !== 2) return;
    if (state.bankrollCents < h.betCents) {
      setStatus('Not enough bankroll to split.', 'Try Hit or Stand.');
      renderAll();
      return;
    }

    const [c1, c2] = h.cards;
    if (!c1 || !c2 || !sameRankForSplit(c1, c2)) return;

    // Take another equal bet
    state.bankrollCents -= h.betCents;
    state.stats.hands++;

    // Create two hands
    const isAces = c1.rank === 'A';
    /** @type {PlayerHand} */
    const hand1 = {
      cards: [c1],
      betCents: h.betCents,
      doubled: false,
      isSplitHand: true,
      isSplitAces: isAces,
      finished: false,
    };
    /** @type {PlayerHand} */
    const hand2 = {
      cards: [c2],
      betCents: h.betCents,
      doubled: false,
      isSplitHand: true,
      isSplitAces: isAces,
      finished: false,
    };

    // Replace current hand with hand1 and insert hand2
    state.hands.splice(state.activeHandIndex, 1, hand1, hand2);

    // Deal one additional card to each split hand
    dealCardToHand(state.activeHandIndex);
    dealCardToHand(state.activeHandIndex + 1);

    if (isAces) {
      // Split aces: one card each, auto-finish both
      state.hands[state.activeHandIndex].finished = true;
      state.hands[state.activeHandIndex + 1].finished = true;
      setStatus('Split Aces.', 'One card each. Dealer plays next.');
      moveToNextUnfinishedHandOrDealer();
      return;
    }

    setStatus('Split.', 'Play each hand in order.');
    renderAll();
  }

  function dealerShouldHit() {
    const d = computeHand(state.dealerCards);
    if (d.best < 17) return true;
    if (d.best > 17) return false;
    // 17
    if (d.isSoft && state.settings.hitSoft17) return true;
    return false;
  }

  function dealerPlay() {
    setPhase(Phase.DEALER);
    revealDealer();
    renderAll();

    // Dealer draws until rule satisfied
    // Keep it synchronous for simplicity and correctness.
    while (dealerShouldHit()) {
      dealCardToDealer();
    }

    settleRound();
  }

  function settleHandOutcome(hand, dealerTotals) {
    const pt = computeHand(hand.cards);
    if (pt.isBust) return { outcome: 'LOSE', payoutCents: 0 };

    if (dealerTotals.isBust) return { outcome: 'WIN', payoutCents: hand.betCents * 2 };

    const pBest = pt.best;
    const dBest = dealerTotals.best;

    const isNaturalBJ = pt.isBlackjack && !hand.isSplitHand;
    const dealerBJ = dealerTotals.isBlackjack;

    if (isNaturalBJ && dealerBJ) return { outcome: 'PUSH', payoutCents: hand.betCents };
    if (isNaturalBJ && !dealerBJ) {
      // 3:2 payout: return stake + profit 1.5x
      const payout = hand.betCents + Math.floor(hand.betCents * 3 / 2);
      return { outcome: 'BLACKJACK', payoutCents: payout };
    }

    if (dealerBJ && !isNaturalBJ) return { outcome: 'LOSE', payoutCents: 0 };

    if (pBest > dBest) return { outcome: 'WIN', payoutCents: hand.betCents * 2 };
    if (pBest < dBest) return { outcome: 'LOSE', payoutCents: 0 };
    return { outcome: 'PUSH', payoutCents: hand.betCents };
  }

  function settleRound() {
    setPhase(Phase.ROUND_OVER);
    revealDealer();

    const dealerTotals = computeHand(state.dealerCards);

    // Insurance resolution
    let insuranceNet = 0;
    if (state.insuranceBetCents > 0) {
      if (dealerTotals.isBlackjack) {
        // Pays 2:1 plus returns stake: total 3x stake
        const payout = state.insuranceBetCents * 3;
        state.bankrollCents += payout;
        insuranceNet = payout - state.insuranceBetCents;
      } else {
        insuranceNet = -state.insuranceBetCents;
      }
    }

    // Settle each player hand
    let roundNet = 0;
    const perHandOutcomes = [];
    for (const hand of state.hands) {
      const { outcome, payoutCents } = settleHandOutcome(hand, dealerTotals);
      hand.outcome = outcome;
      state.bankrollCents += payoutCents;

      // Net vs the original bet stake already removed
      const net = payoutCents - hand.betCents;
      roundNet += net;
      perHandOutcomes.push(outcome);

      if (outcome === 'WIN' || outcome === 'BLACKJACK') state.stats.wins++;
      else if (outcome === 'PUSH') state.stats.pushes++;
      else state.stats.losses++;

      if (outcome === 'BLACKJACK') state.stats.blackjacks++;
      if (net > state.stats.biggestWinCents) state.stats.biggestWinCents = net;
    }

    roundNet += insuranceNet;
    state.lastRoundNetCents = roundNet;

    const all = perHandOutcomes.join(' • ');
    const netLabel = roundNet > 0 ? `+${centsToString(roundNet)}` : (roundNet < 0 ? centsToString(roundNet) : 'Push');
    setStatus(`Round over: ${all || '—'}. (${netLabel})`, 'Tap “Next Hand” to keep playing.');

    // After a round, the bet is no longer pending
    state.pendingBetCents = 0;

    savePersisted(state);
    renderAll();
  }

  function nextHand() {
    if (state.phase !== Phase.ROUND_OVER) return;
    resetRoundToBetting();
    savePersisted(state);
    setStatus('Choose a chip, then Deal.', 'Tip: Splits create multiple hands; each is scored separately.');
    renderAll();
  }

  function addChip(dollars) {
    if (state.phase !== Phase.BETTING) return;
    const add = dollarsToCents(dollars);
    if (add <= 0) return;
    const next = state.pendingBetCents + add;
    state.pendingBetCents = Math.min(next, state.bankrollCents);
    renderAll();
  }

  function clearBet() {
    if (state.phase !== Phase.BETTING) return;
    state.pendingBetCents = 0;
    renderAll();
  }

  function maxBet() {
    if (state.phase !== Phase.BETTING) return;
    state.pendingBetCents = state.bankrollCents;
    renderAll();
  }

  function resetBankrollAndRound() {
    const target = clampInt(state.settings.startingBankrollCents, 1000, 10_000_000);
    state.bankrollCents = target;
    ensureShoeConfig();
    resetRoundToBetting();
    savePersisted(state);
    setStatus('Reset complete.', `Bankroll set to ${centsToString(target)} and shoe reshuffled.`);
    renderAll();
  }

  // --- Event wiring ---
  document.querySelectorAll('button[data-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const raw = btn.getAttribute('data-chip') || '0';
      addChip(Number(raw));
    });
  });

  ui.clearBet.addEventListener('click', clearBet);
  ui.maxBet.addEventListener('click', maxBet);

  ui.dealBtn.addEventListener('click', () => {
    startRound();
    savePersisted(state);
    renderAll();
  });
  ui.hitBtn.addEventListener('click', () => {
    hit();
    savePersisted(state);
    renderAll();
  });
  ui.standBtn.addEventListener('click', () => {
    if (state.phase === Phase.INSURANCE) {
      skipInsurance();
    } else {
      stand();
    }
    savePersisted(state);
    renderAll();
  });
  ui.doubleBtn.addEventListener('click', () => {
    doubleDown();
    savePersisted(state);
    renderAll();
  });
  ui.splitBtn.addEventListener('click', () => {
    split();
    savePersisted(state);
    renderAll();
  });

  ui.insuranceBtn.addEventListener('click', () => {
    // Insurance button acts as "Take Insurance"
    takeInsurance();
    savePersisted(state);
    renderAll();
  });

  ui.newRoundBtn.addEventListener('click', () => {
    nextHand();
  });

  ui.resetBtn.addEventListener('click', () => {
    const ok = globalThis.confirm('Reset bankroll and reshuffle shoe? (Stats are kept)');
    if (!ok) return;
    resetBankrollAndRound();
  });

  // Settings modal wiring
  ui.settingsBtn.addEventListener('click', () => setModalOpen(ui.settingsModal, ui.settingsBtn, true));
  ui.closeSettingsBtn.addEventListener('click', () => setModalOpen(ui.settingsModal, ui.settingsBtn, false));
  ui.settingsModal.addEventListener('click', (e) => {
    if (e.target === ui.settingsModal) setModalOpen(ui.settingsModal, ui.settingsBtn, false);
  });

  ui.decksSelect.addEventListener('change', () => {
    state.settings.decks = clampInt(Number(ui.decksSelect.value), 1, 8);
    ensureShoeConfig();
    updateRulesBadges();
    savePersisted(state);
    renderAll();
  });
  ui.hitSoft17Toggle.addEventListener('change', () => {
    state.settings.hitSoft17 = Boolean(ui.hitSoft17Toggle.checked);
    updateRulesBadges();
    savePersisted(state);
    renderAll();
  });
  ui.startingBankroll.addEventListener('change', () => {
    const cents = dollarsToCents(Number(ui.startingBankroll.value));
    state.settings.startingBankrollCents = clampInt(cents, 1000, 10_000_000);
    savePersisted(state);
    renderAll();
  });
  ui.resetStatsBtn.addEventListener('click', () => {
    const ok = globalThis.confirm('Reset stats? (Bankroll is kept)');
    if (!ok) return;
    state.stats = {
      rounds: 0,
      hands: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      blackjacks: 0,
      biggestWinCents: 0,
      lastPlayedAt: nowMs(),
    };
    savePersisted(state);
    updateStatsLine();
    setStatus('Stats reset.', 'Keep playing to build them back up.');
    renderAll();
  });

  // Help modal wiring
  ui.helpBtn.addEventListener('click', () => setModalOpen(ui.helpModal, ui.helpBtn, true));
  ui.closeHelpBtn.addEventListener('click', () => setModalOpen(ui.helpModal, ui.helpBtn, false));
  ui.helpModal.addEventListener('click', (e) => {
    if (e.target === ui.helpModal) setModalOpen(ui.helpModal, ui.helpBtn, false);
  });

  // Keyboard shortcuts (desktop)
  document.addEventListener('keydown', (e) => {
    if (ui.settingsModal.getAttribute('aria-hidden') === 'false' || ui.helpModal.getAttribute('aria-hidden') === 'false') {
      if (e.key === 'Escape') {
        setModalOpen(ui.settingsModal, ui.settingsBtn, false);
        setModalOpen(ui.helpModal, ui.helpBtn, false);
      }
      return;
    }
    if (e.key === 'Escape') return;
    if (state.phase === Phase.BETTING && e.key === 'Enter') ui.dealBtn.click();
    if (state.phase === Phase.PLAYER) {
      if (e.key.toLowerCase() === 'h') ui.hitBtn.click();
      if (e.key.toLowerCase() === 's') ui.standBtn.click();
      if (e.key.toLowerCase() === 'd') ui.doubleBtn.click();
      if (e.key.toLowerCase() === 'p') ui.splitBtn.click();
    }
    if (state.phase === Phase.INSURANCE) {
      if (e.key.toLowerCase() === 'i') ui.insuranceBtn.click();
      if (e.key.toLowerCase() === 'n') skipInsurance();
    }
  });

  // Insurance offer UX: (optional) long-press “Take Ins.” to skip (fast one-handed play)
  let insurancePressTimer = null;
  ui.insuranceBtn.addEventListener('touchstart', () => {
    if (state.phase !== Phase.INSURANCE) return;
    insurancePressTimer = setTimeout(() => {
      skipInsurance();
      renderAll();
    }, 650);
  }, { passive: true });
  ui.insuranceBtn.addEventListener('touchend', () => {
    if (insurancePressTimer) clearTimeout(insurancePressTimer);
    insurancePressTimer = null;
  }, { passive: true });

  // Init settings controls
  ui.decksSelect.value = String(state.settings.decks);
  ui.hitSoft17Toggle.checked = state.settings.hitSoft17;
  ui.startingBankroll.value = String(Math.floor(state.settings.startingBankrollCents / 100));

  updateRulesBadges();
  updateStatsLine();
  resetRoundToBetting();
  setStatus('Choose a chip, then Deal.', 'Tip: Dealer peeks for blackjack on A or 10-value upcards.');
  renderAll();
})();
