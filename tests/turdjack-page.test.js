import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

import { jackDeck } from './continue-fixtures.js';
import { validateJackSnapshot } from '../games/table-continue.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'turdjack.html'), 'utf8');
const openPages = [];
/** R2 turdjack.html is large; first JSDOM parse can exceed the default 5s hook. */
const PAGE_BOOT_TIMEOUT = 30000;

function makeFixture({ ranks = ['A', '5'], upcard = '9', dealerHitsSoft17 = false } = {}) {
  const shoe = jackDeck(1);
  const take = (rank, suit) => {
    const index = shoe.findIndex((card) => card.rank === rank && card.suit === suit);
    expect(index, `fixture contains ${rank}${suit} exactly once`).toBeGreaterThanOrEqual(0);
    return shoe.splice(index, 1)[0];
  };
  const playerHand = [take(ranks[0], 'H'), take(ranks[1], 'C')];
  const dealerHand = [take(upcard, 'D'), take('8', 'S')];
  const nextDraw = take('2', 'S');
  shoe.push(nextDraw);
  const inventory = [...playerHand, ...dealerHand, ...shoe];
  expect(inventory).toHaveLength(52);
  expect(new Set(inventory.map((card) => `${card.rank}${card.suit}`)).size).toBe(52);
  return { playerHand, dealerHand, shoe, dealerHitsSoft17 };
}

function boot(options) {
  const fixture = makeFixture(options);
  let nextTimer = 1;
  const timers = new Map();
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/turdjack.html',
    // External resources remain disabled. Cosmetic timers cannot run game actions.
    beforeParse(window) {
      window.setTimeout = (callback, delay) => {
        const id = nextTimer++;
        timers.set(id, { callback, delay });
        return id;
      };
      window.clearTimeout = (id) => timers.delete(id);
      window.setInterval = () => nextTimer++;
      window.clearInterval = () => {};
      window.requestAnimationFrame = () => nextTimer++;
      window.cancelAnimationFrame = () => {};
      window.Math.random = () => 0.42;
      window.localStorage.setItem('turdjackSoundOn_v1', '0');
      window.__TURDJACK_SKIP_KIT__ = true;
    }
  });
  openPages.push({ dom, timers });
  const w = dom.window;
  w.fixture = fixture;
  w.eval(`
    hideWelcomeGuide();
    rules = normalizeRules({ ...DEFAULT_RULES, decks: 1,
      dealerHitsSoft17: fixture.dealerHitsSoft17 });
    playerHand = fixture.playerHand;
    dealerHand = fixture.dealerHand;
    shoe = fixture.shoe;
    discard = [];
    splitHand = [];
    shoeDecks = 1;
    shoeGeneration = 1;
    dealerHoleShoeGeneration = 1;
    dealerHoleHidden = true;
    dealerHoleCountResolved = false;
    runningCount = [...playerHand, dealerHand[0]].reduce(
      (count, card) => count + hiLoValue(card), 0);
    cutCardsRemaining = 10;
    bankroll = 900;
    currentBet = 100;
    lastBet = 100;
    splitBet = 0;
    roundActive = true;
    firstDecisionOpen = true;
    splitRound = false;
    activeHandIndex = 0;
    stats = normalizeStats({ hands: 1 });
    decisionStreak = 0;
    hotStreak = 0;
    coldStreak = 0;
    renderCards();
    updateHud();
  `);
  delete w.fixture;
  return w;
}

function readState(w) {
  return JSON.parse(w.eval(`JSON.stringify({
    playerHand, dealerHand, shoe, discard, splitHand, bankroll, currentBet,
    roundActive, dealerHoleHidden, firstDecisionOpen, stats, decisionStreak,
    value: handValue(playerHand)
  })`));
}

function expectCompleteShoe(state) {
  const inventory = [
    ...state.playerHand, ...state.dealerHand, ...state.shoe,
    ...state.discard, ...state.splitHand
  ];
  expect(inventory).toHaveLength(52);
  expect(new Set(inventory.map((card) => `${card.rank}${card.suit}`)).size).toBe(52);
}

afterEach(() => {
  openPages.splice(0).forEach(({ dom, timers }) => {
    dom.window.close();
    timers.clear();
  });
});

describe('Crapjack dealer settlement ownership', () => {
  it.each(['none', 'manual', 'cut'])('keeps the next natural deal saveable after a completed hand, shuffle=%s', shuffle => {
    const w = boot({ ranks: ['K', '10'], upcard: '9' });
    w.Suite = { table: {
      remember(page, snapshot) { w.latestSnapshot = JSON.parse(JSON.stringify(snapshot)); },
      clear() {}
    } };
    w.playerStand();
    expect(readState(w).roundActive).toBe(false);
    // Deterministic unit shuffle: the second deal must remain a live player turn.
    w.crypto.getRandomValues = pool => { pool.fill(3); return pool; };
    if (shuffle === 'manual') { w.newShoe(); }
    if (shuffle === 'cut') { w.eval('cutCardsRemaining = shoe.length;'); }
    w.startRound();
    expect(w.latestSnapshot.stats.hands).toBe(2);
    expect(w.latestSnapshot.discard).toHaveLength(shuffle === 'none' ? 4 : 0);
    expect(validateJackSnapshot(w.latestSnapshot)).not.toBeNull();
    expectCompleteShoe(readState(w));
  });

  it.each([
    { ranks: ['K', '10'], upcard: '9', result: 'wins', bank: 1100 },
    { ranks: ['10', '6'], upcard: '9', result: 'losses', bank: 900 }
  ])('settles $result once while rapid controls arrive during the dealer reveal', fixture => {
    const w = boot(fixture);
    w.eval('turdjackKit = { dealerRevealBeat(done) { window.finishReveal = done; }, dealerHitDelayMs() { return 0; } };');
    w.document.getElementById('standBtn').click();
    expect(w.eval('dealerResolving')).toBe(true);
    const before = readState(w);
    for (const code of ['KeyS', 'KeyH', 'KeyD', 'KeyP', 'KeyX', 'Enter']) {
      w.document.dispatchEvent(new w.KeyboardEvent('keydown', { code, bubbles: true }));
    }
    expect(readState(w)).toEqual(before);
    for (const selector of ['#standBtn', '#hitBtn', '#doubleBtn', '#splitBtn', '#surrenderBtn', '[data-mobile-action="smart"]']) {
      expect(w.document.querySelector(selector).disabled).toBe(true);
    }
    w.finishReveal();
    w.finishReveal();
    const after = readState(w);
    expect(after.stats[fixture.result]).toBe(1);
    expect(after.stats.decisions).toBe(1);
    expect(after.bankroll).toBe(fixture.bank);
    expect(after.roundActive).toBe(false);
    expect(w.eval('dealerResolving')).toBe(false);
    expectCompleteShoe(after);
  });
});

describe('Crapjack neutral split rounds and streak bonuses', () => {
  it.each([
    { previous: 2, bonus: 50 }, { previous: 4, bonus: 150 },
    { previous: 6, bonus: 400 }, { previous: 9, bonus: 1000 }
  ])('still pays a newly reached heater milestone after $previous wins', ({ previous, bonus }) => {
    const w = boot({ ranks: ['K', '9'], upcard: '9' });
    w.eval(`hotStreak = ${previous}; coldStreak = 0;`);
    w.playerStand();
    expect(readState(w).bankroll).toBe(1100 + bonus);
    expect(w.eval('hotStreak')).toBe(previous + 1);
  });

  it('still pays a newly reached pity milestone after four losses', () => {
    const w = boot({ ranks: ['10', '6'], upcard: '9' });
    w.eval('hotStreak = 0; coldStreak = 4;');
    w.playerStand();
    expect(readState(w).bankroll).toBe(925);
    expect(w.eval('coldStreak')).toBe(5);
  });

  it.each([
    { hot: 3, cold: 0 }, { hot: 5, cold: 0 }, { hot: 7, cold: 0 },
    { hot: 10, cold: 0 }, { hot: 0, cold: 5 }
  ])('does not repeat a milestone bonus after a split win/loss at $hot/$cold', ({ hot, cold }) => {
    const w = boot();
    w.auditStreak = { hot, cold };
    w.eval(`
      createShoe(1);
      function takeAuditCard(rank, suit) {
        const index = shoe.findIndex(card => card.rank === rank && card.suit === suit);
        return shoe.splice(index, 1)[0];
      }
      playerHand = [takeAuditCard('10','H'), takeAuditCard('8','C')];
      splitHand = [takeAuditCard('8','H'), takeAuditCard('6','C')];
      dealerHand = [takeAuditCard('10','D'), takeAuditCard('7','S')];
      discard = []; bankroll = 800; currentBet = 100; splitBet = 100;
      splitRound = true; activeHandIndex = 1; firstDecisionOpen = true;
      roundActive = true; dealerResolving = false;
      hotStreak = auditStreak.hot; coldStreak = auditStreak.cold;
      stats = normalizeStats({ hands: 1 });
    `);
    w.playerStand();
    const result = readState(w);
    expect(result.roundActive).toBe(false);
    expect(result.stats).toMatchObject({ wins: 1, losses: 1 });
    expect(result.bankroll).toBe(1000);
    expect(w.eval('hotStreak')).toBe(0);
    expect(w.eval('coldStreak')).toBe(0);
    expectCompleteShoe(result);
    w.playerStand();
    expect(readState(w)).toEqual(result);
  });
});

const softCases = [false, true].flatMap((dealerHitsSoft17) =>
  ['4', '5'].flatMap((rank) =>
    ['9', '10', 'A'].map((upcard) => ({
      name: `soft ${11 + Number(rank)} versus ${upcard}, ${dealerHitsSoft17 ? 'H17' : 'S17'}`,
      ranks: ['A', rank],
      upcard,
      dealerHitsSoft17
    }))
  )
);

describe('Crapjack live-page soft-hand guidance', () => {
  it.each(['Enter', 'Space'])('%s explains the focused hint without playing a card', (code) => {
    const w = boot();
    const hint = w.document.getElementById('hintText');
    const before = readState(w);
    w.hintCalls = [];
    w.eval('turdjackKit = { coachHint(advice) { window.hintCalls.push(advice.action); } };');

    expect(hint.getAttribute('role')).toBe('button');
    expect(hint.tabIndex).toBe(0);
    hint.focus();
    const event = new w.KeyboardEvent('keydown', {
      code, key: code === 'Space' ? ' ' : 'Enter', bubbles: true, cancelable: true
    });
    hint.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(w.hintCalls).toEqual(['hit']);
    expect(readState(w)).toEqual(before);

    hint.click();
    expect(w.hintCalls).toEqual(['hit', 'hit']);
    expect(readState(w)).toEqual(before);
  });

  it.each(softCases)('recommends Hit for $name', { timeout: PAGE_BOOT_TIMEOUT }, (fixture) => {
    const w = boot(fixture);

    expect(w.strategyDecision()).toMatchObject({ action: 'hit' });
    const hint = w.document.getElementById('hintText').textContent;
    expect(hint).toMatch(/^Hint: Hit\./);
    expect(hint).toMatch(/soft/i);
    expect(hint).not.toMatch(/surrender/i);
  });

  it.each(['Enter', 'mobile Smart'])('%s draws on soft 16 without forfeiting the bet', (control) => {
    const w = boot();
    const initialHint = w.document.getElementById('hintText').textContent;

    if (control === 'Enter') {
      w.document.dispatchEvent(new w.KeyboardEvent('keydown', {
        code: 'Enter', key: 'Enter', bubbles: true, cancelable: true
      }));
    } else {
      const smart = w.document.querySelector('[data-mobile-action="smart"]');
      expect(smart.disabled).toBe(false);
      smart.click();
    }

    const state = readState(w);
    expect(state.playerHand).toEqual([
      { rank: 'A', suit: 'H' }, { rank: '5', suit: 'C' }, { rank: '2', suit: 'S' }
    ]);
    expect(state.value).toBe(18);
    expect(state.roundActive).toBe(true);
    expect(state.firstDecisionOpen).toBe(false);
    expect(state.dealerHoleHidden).toBe(true);
    expect(state.bankroll).toBe(900);
    expect(state.currentBet).toBe(100);
    expect(initialHint).toMatch(/^Hint: Hit\./);
    expect(state.stats).toMatchObject({
      surrenders: 0, losses: 0, decisions: 1, correctDecisions: 1, bestDecisionStreak: 1
    });
    expect(state.decisionStreak).toBe(1);
    expect(w.document.getElementById('bankrollText').textContent).toBe('$900');
    expect(w.document.getElementById('playerScoreText').textContent).toBe('Score: 18');
    expect(w.document.getElementById('disciplineText').textContent).toBe('100%');
    expectCompleteShoe(state);
  });

  it('keeps manual soft-hand surrender legal without calling it correct strategy', () => {
    const w = boot();
    const surrender = w.document.getElementById('surrenderBtn');
    expect(surrender.disabled).toBe(false);
    surrender.click();

    const state = readState(w);
    expect(state.playerHand).toHaveLength(2);
    expect(state.roundActive).toBe(false);
    expect(state.dealerHoleHidden).toBe(false);
    expect(state.bankroll).toBe(950);
    expect(state.stats).toMatchObject({
      surrenders: 1, losses: 1, decisions: 1, correctDecisions: 0
    });
    expect(state.decisionStreak).toBe(0);
    expect(w.document.getElementById('disciplineText').textContent).toBe('0%');
    expectCompleteShoe(state);
  });
});

const hardSurrenderCases = [false, true].flatMap((dealerHitsSoft17) => [
  ...['9', '10', 'A'].map((upcard) => ({ ranks: ['10', '6'], upcard, dealerHitsSoft17 })),
  { ranks: ['10', '5'], upcard: '10', dealerHitsSoft17 },
  ...(dealerHitsSoft17 ? [{ ranks: ['10', '5'], upcard: 'A', dealerHitsSoft17 }] : [])
]);

describe('Crapjack strategy boundaries around the soft-hand correction', () => {
  it.each(hardSurrenderCases)('still surrenders $ranks versus $upcard, H17=$dealerHitsSoft17', (fixture) => {
    const w = boot(fixture);
    expect(w.strategyDecision()).toMatchObject({ action: 'surrender' });
    expect(w.document.getElementById('hintText').textContent).toMatch(/^Hint: Surrender\./);
    w.document.querySelector('[data-mobile-action="smart"]').click();

    const state = readState(w);
    expect(state.roundActive).toBe(false);
    expect(state.bankroll).toBe(950);
    expect(state.stats).toMatchObject({
      surrenders: 1, losses: 1, decisions: 1, correctDecisions: 1
    });
    expectCompleteShoe(state);
  });

  it.each([
    { ranks: ['10', '5'], upcard: '9', action: 'hit' },
    { ranks: ['10', '5'], upcard: 'A', action: 'hit' },
    { ranks: ['A', 'A'], upcard: '9', action: 'split' },
    { ranks: ['8', '8'], upcard: '10', action: 'split' },
    { ranks: ['A', '4'], upcard: '4', action: 'double' },
    { ranks: ['A', '5'], upcard: '4', action: 'double' },
    { ranks: ['A', '5'], upcard: '3', dealerHitsSoft17: true, action: 'double' },
    { ranks: ['A', '7'], upcard: '7', action: 'stand' },
    { ranks: ['A', '8'], upcard: '10', dealerHitsSoft17: true, action: 'stand' }
  ])('keeps $action for $ranks versus $upcard', (fixture) => {
    const w = boot(fixture);
    expect(w.strategyDecision()).toMatchObject({ action: fixture.action });
    const label = fixture.action[0].toUpperCase() + fixture.action.slice(1);
    expect(w.document.getElementById('hintText').textContent.startsWith(`Hint: ${label}.`)).toBe(true);
  });
});
