import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { createJackConfirmAsk } from '../games/turdjack-confirm-modal.js';
import { validateJackSnapshot } from '../games/table-continue.js';
import { jackDeck, validJackSnapshot } from './continue-fixtures.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'turdjack.html'), 'utf8');
const core = readFileSync(join(root, 'games/table-continue-core.js'), 'utf8');
const suite = readFileSync(join(root, 'assets/turdsuite.js'), 'utf8');
const pages = [];
const flush = async () => { for (let i = 0; i < 12; i++) { await Promise.resolve(); } };

function boot(storage = {}) {
  // JSDOM cannot import the page's module; inject the real modal factory before init.
  const dom = new JSDOM(html.replace('    init();', '    askJackConfirm = window.testAsk;\n    init();'), {
    url: 'http://localhost/turdjack.html', runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.__TURDJACK_SKIP_KIT__ = true;
      w.setTimeout = () => 1;
      w.clearTimeout = () => {};
      w.setInterval = () => 1;
      w.clearInterval = () => {};
      w.requestAnimationFrame = () => 1;
      w.cancelAnimationFrame = () => {};
      for (const [key, value] of Object.entries(storage)) { w.localStorage.setItem(key, value); }
      w.localStorage.setItem('turdjackSoundOn_v1', '0');
      w.eval(core);
      w.eval(suite);
      w.dialogSnapshots = [];
      let ask;
      w.testAsk = (options) => {
        // Capture the real validated store at the instant the dialog is requested.
        w.dialogSnapshots.push(w.Suite.table.load('turdjack.html'));
        ask ||= createJackConfirmAsk(w.document, w);
        return ask(options);
      };
    }
  });
  pages.push(dom);
  return dom.window;
}

function storageOf(w) {
  return Object.fromEntries(Array.from({ length: w.localStorage.length }, (_, i) => {
    const key = w.localStorage.key(i);
    return [key, w.localStorage.getItem(key)];
  }));
}

function stateOf(w) {
  return JSON.parse(w.eval(`JSON.stringify({ playerHand, dealerHand, shoe, discard,
    bankroll, currentBet, runningCount, stats, roundActive, dealerHoleHidden })`));
}

function deal(w, natural, dealerNatural) {
  const shoe = jackDeck(1);
  const take = (rank, suit) => shoe.splice(shoe.findIndex((c) => c.rank === rank && c.suit === suit), 1)[0];
  const cards = [take(natural ? 'A' : '9', 'H'), take('A', 'D'),
    take(natural ? 'K' : '8', 'C'), take(dealerNatural ? 'K' : '6', 'S')];
  shoe.push(...cards.reverse());
  w.riggedShoe = shoe;
  w.eval(`hideWelcomeGuide(); rules = normalizeRules({ ...DEFAULT_RULES, decks: 1 });
    shoe = riggedShoe; shoeDecks = 1; cutCardsRemaining = 10; runningCount = 0;
    bankroll = 1000; currentBet = 100; stats = normalizeStats({}); saveState();`);
  w.document.getElementById('dealBtn').click();
}

afterEach(() => pages.splice(0).forEach((dom) => dom.window.close()));

describe('Crapjack pending decision survives page/store reload', () => {
  it.each([false, true].flatMap((natural) => [false, true].flatMap((dealerNatural) =>
    [false, true].map((accept) => ({ natural, dealerNatural, accept }))
  )))('natural=$natural dealerNatural=$dealerNatural accept=$accept', async ({ natural, dealerNatural, accept }) => {
    const first = boot();
    deal(first, natural, dealerNatural);
    const beforeDialog = stateOf(first);
    // The module/promise gap must be protected before the modal is even visible.
    for (const code of ['KeyH', 'KeyS', 'KeyD', 'KeyP', 'KeyX', 'Enter']) {
      first.document.dispatchEvent(new first.KeyboardEvent('keydown', { code, bubbles: true }));
    }
    expect(stateOf(first)).toEqual(beforeDialog);
    await flush();
    const initial = stateOf(first);
    const pending = first.Suite.table.load('turdjack.html');
    expect(pending).toMatchObject({ pendingDecision: natural ? 'even-money' : 'insurance', bankroll: 900 });
    expect(first.dialogSnapshots).toEqual([pending]);
    expect(initial.stats.hands).toBe(1);
    expect(first.document.getElementById('jackConfirmTitle').textContent).toBe(natural ? 'Even money' : 'Insurance');

    // Attempt bypasses through buttons, mobile actions, and the public page functions.
    for (const id of ['hitBtn', 'standBtn', 'doubleBtn', 'splitBtn', 'surrenderBtn']) {
      expect(first.document.getElementById(id).disabled).toBe(true);
      first.document.getElementById(id).click();
    }
    first.eval('playerHit(); playerStand(); playerDouble(); playerSplit(); playerSurrender(); smartAction(); startRound();');
    expect(first.document.querySelector('[data-mobile-action="smart"]').disabled).toBe(true);
    first.tryRestoreTable();
    await flush();
    expect(first.dialogSnapshots).toHaveLength(1);
    first.document.querySelector('[data-mobile-action="smart"]').click();
    expect(stateOf(first)).toEqual(initial);

    // Two consecutive reloads must keep the same pending hand and deduction.
    const second = boot(storageOf(first));
    await flush();
    expect(stateOf(second)).toEqual(initial);
    expect(second.dialogSnapshots).toEqual([pending]);
    const resumed = boot(storageOf(second));
    await flush();
    expect(stateOf(resumed)).toEqual(initial);
    expect(resumed.dialogSnapshots).toEqual([pending]);
    expect(resumed.document.getElementById('jackConfirmMessage').textContent)
      .toBe(first.document.getElementById('jackConfirmMessage').textContent);

    const button = resumed.document.getElementById(accept ? 'jackConfirmYes' : 'jackConfirmNo');
    button.click();
    button.click();
    await flush();
    const after = stateOf(resumed);
    const expectedBank = natural ? (accept ? 1100 : dealerNatural ? 1000 : 1150)
      : (accept ? (dealerNatural ? 1000 : 850) : 900);
    expect(after.bankroll).toBe(expectedBank);
    expect(after.playerHand).toEqual(initial.playerHand);
    expect(after.dealerHand).toEqual(initial.dealerHand);
    expect(after.shoe).toEqual(initial.shoe);
    expect(after.stats).toMatchObject({ hands: 1, decisions: 0,
      insuranceBets: !natural && accept ? 1 : 0,
      insuranceWins: !natural && accept && dealerNatural ? 1 : 0,
      wins: natural && (accept || !dealerNatural) ? 1 : 0,
      pushes: natural && !accept && dealerNatural ? 1 : 0,
      losses: !natural && dealerNatural ? 1 : 0,
      blackjacks: natural && (accept || !dealerNatural) ? 1 : 0 });
    expect(after.roundActive).toBe(!natural && !dealerNatural);
    const saved = resumed.Suite.table.load('turdjack.html');
    if (after.roundActive) {
      expect(saved).toMatchObject({ pendingDecision: null, bankroll: expectedBank });
      const playing = boot(storageOf(resumed));
      await flush();
      expect(stateOf(playing)).toEqual(after);
      expect(playing.dialogSnapshots).toHaveLength(0);
      expect(playing.document.getElementById('hitBtn').disabled).toBe(false);
    } else {
      expect(saved).toBeNull();
      expect(resumed.localStorage.getItem('turdjackBankroll')).toBe(String(expectedBank));
    }
  });

  it('restores legacy v1 player turns without a pending decision', () => {
    const first = boot();
    expect(first.Suite.table.remember('turdjack.html', validJackSnapshot())).toBe(true);
    const resumed = boot(storageOf(first));
    expect(resumed.dialogSnapshots).toHaveLength(0);
    expect(resumed.document.getElementById('hitBtn').disabled).toBe(false);
    resumed.playerHit();
    expect(stateOf(resumed).playerHand).toHaveLength(3);
  });

  it('rejects unknown pending phases rather than silently turning them into player turns', () => {
    expect(validateJackSnapshot({ ...validJackSnapshot(), pendingDecision: 'unknown' })).toBeNull();
  });

  it('allows sequential non-ace deals without leaving openingHandInFlight set', async () => {
    const w = boot();
    const runHand = (hiddenRank) => {
      w.eval(`bankroll = 1000; currentBet = 20; roundActive = false; runningCount = 0;
        playerHand = []; dealerHand = []; shoe = [
          { rank: '${hiddenRank}', suit: 'S' }, { rank: '9', suit: 'D' },
          { rank: '5', suit: 'H' }, { rank: '2', suit: 'C' }
        ]; stats = normalizeStats({});`);
      w.startRound();
    };
    runHand('K');
    expect(w.eval('roundActive')).toBe(true);
    w.playerStand();
    await flush();
    expect(w.eval('roundActive')).toBe(false);
    runHand('3');
    expect(w.eval('roundActive')).toBe(true);
    expect(w.eval('playerHand.length')).toBe(2);
    await flush();
    expect(w.eval('openingHandInFlight')).toBe(false);
  });
});

function pendingSnapshot() {
  const snap = validJackSnapshot();
  const aceIndex = snap.shoe.findIndex((card) => card.rank === 'A');
  [snap.dealerHand[0], snap.shoe[aceIndex]] = [snap.shoe[aceIndex], snap.dealerHand[0]];
  return { ...snap, pendingDecision: 'insurance' };
}

describe('pending decision snapshot validation', () => {
  it('round-trips a valid pending decision and defaults legacy turns to null', () => {
    expect(validateJackSnapshot(pendingSnapshot())?.pendingDecision).toBe('insurance');
    expect(validateJackSnapshot(validJackSnapshot())?.pendingDecision).toBeNull();
  });

  it.each([
    ['insurance disabled', (snap) => { snap.rules.allowInsurance = false; }],
    ['hole revealed', (snap) => { snap.dealerHoleHidden = false; }],
    ['hole already counted', (snap) => { snap.dealerHoleCountResolved = true; }],
    ['wrong shoe generation', (snap) => { snap.dealerHoleShoeGeneration = 0; }],
    ['decision closed', (snap) => { snap.firstDecisionOpen = false; }],
    ['premium unaffordable', (snap) => { snap.bankroll = 0; }],
    ['split bet', (snap) => { snap.splitBet = 20; }],
    ['wrong natural type', (snap) => { snap.pendingDecision = 'even-money'; }],
    ['extra dealt card', (snap) => { snap.playerHand.push(snap.shoe.pop()); }],
    ['missing shoe card', (snap) => { snap.shoe.pop(); }],
    ['dealer does not show ace', (snap) => { snap.dealerHand.reverse(); }]
  ])('rejects %s', (_, mutate) => {
    const snap = pendingSnapshot();
    mutate(snap);
    expect(validateJackSnapshot(snap)).toBeNull();
  });
});
