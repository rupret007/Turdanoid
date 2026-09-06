import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

import { jackDeck } from './continue-fixtures.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'turdjack.html'), 'utf8');
const openPages = [];

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
  it.each(softCases)('recommends Hit for $name', (fixture) => {
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
