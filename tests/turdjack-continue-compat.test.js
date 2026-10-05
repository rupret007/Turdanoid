import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

import { loadContinue, rememberContinue } from '../games/table-continue.js';
import { validJackSnapshot } from './continue-fixtures.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'turdjack.html'), 'utf8');
const openPages = [];
const PAGE_BOOT_TIMEOUT = 30000;

function bootPage() {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/turdjack.html',
    beforeParse(window) {
      window.__TURDJACK_SKIP_KIT__ = true;
      window.setTimeout = (fn) => {
        fn();
        return 1;
      };
      window.clearTimeout = () => {};
      window.setInterval = () => 1;
      window.clearInterval = () => {};
      window.requestAnimationFrame = () => 1;
      window.cancelAnimationFrame = () => {};
    }
  });
  openPages.push(dom);
  return dom.window;
}

afterEach(() => {
  openPages.splice(0).forEach((dom) => dom.window.close());
});

describe('Crapjack b3821b4 continue snapshot', () => {
  it(
    'restores validJackSnapshot through tryRestoreTable with no stats key drift',
    { timeout: PAGE_BOOT_TIMEOUT },
    () => {
      const snap = validJackSnapshot();
      const w = bootPage();
      expect(rememberContinue(w.localStorage, 'turdjack.html', snap)).toBe(true);
      const stored = loadContinue(w.localStorage, 'turdjack.html');
      expect(stored?.bankroll).toBe(snap.bankroll);
      w.localStorage.removeItem('turdjackBankroll');
      w.localStorage.removeItem('turdjackStats');
      const bankrollBeforeRound = w.localStorage.getItem('turdjackBankroll');
      w.eval(`
        hideWelcomeGuide();
        roundActive = false;
        const snap = ${JSON.stringify(stored)};
        if (!applyJackSnapshot(snap)) throw new Error('applyJackSnapshot failed');
        syncRulesToUi();
        updateRuleSummary();
        renderCards();
        setStatus(snap.status || 'Picked up the live hand.');
        updateHud();
      `);

      const state = JSON.parse(w.eval(`JSON.stringify({
        bankroll, currentBet, splitBet, lastBet,
        playerHand, dealerHand, splitHand, shoe, discard,
        runningCount, shoeGeneration, dealerHoleHidden,
        dealerHoleShoeGeneration, dealerHoleCountResolved,
        firstDecisionOpen, splitRound, activeHandIndex,
        cutCardsRemaining, shoeDecks, roundActive, rules, stats,
        decisionStreak, hotStreak, coldStreak
      })`));

      expect(state.roundActive).toBe(true);
      expect(state.bankroll).toBe(snap.bankroll);
      expect(state.currentBet).toBe(snap.currentBet);
      expect(state.dealerHoleHidden).toBe(true);
      expect(state.playerHand).toEqual(snap.playerHand);
      expect(state.dealerHand).toEqual(snap.dealerHand);
      expect(state.stats).toEqual(snap.stats);
      expect(state.rules.decks).toBe(4);
      expect(state.rules.blackjackPayout).toBe(1.5);

      w.eval('playerHit();');
      const afterHit = JSON.parse(w.eval(`JSON.stringify({
        playerLen: playerHand.length,
        roundActive,
        bankroll
      })`));
      expect(afterHit.roundActive).toBe(true);
      expect(afterHit.playerLen).toBe(3);

      expect(w.localStorage.getItem('turdjackBankroll')).toBe(bankrollBeforeRound);
      w.eval('roundActive = false; saveState();');
      expect(w.localStorage.getItem('turdjackBankroll')).toBe(String(snap.bankroll));
      const parsedStats = JSON.parse(w.localStorage.getItem('turdjackStats'));
      expect(parsedStats).toMatchObject({
        hands: expect.any(Number),
        wins: expect.any(Number),
        losses: expect.any(Number),
        pushes: expect.any(Number),
        surrenders: expect.any(Number),
        blackjacks: expect.any(Number),
        insuranceBets: expect.any(Number),
        insuranceWins: expect.any(Number),
        decisions: expect.any(Number),
        correctDecisions: expect.any(Number),
        bestDecisionStreak: expect.any(Number)
      });
    }
  );
});
