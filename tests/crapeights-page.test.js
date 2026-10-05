import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';
import { validEightsSnapshot } from './continue-fixtures.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const openPages = [];
const sources = ['table-continue-core', 'crapeights-ai', 'crapeights-presentation', 'crapeights-table', 'crapeights-hand', 'crapeights-effects']
  .map((name) => readFileSync(join(root, 'games', `${name}.js`), 'utf8'));

function pendingWildSnapshot() {
  const snapshot = validEightsSnapshot();
  const wild = snapshot.players[1].hand[0];
  expect(wild.rank).toBe('8');
  snapshot.players[1].hand[0] = snapshot.players[0].hand[0];
  snapshot.players[0].hand[0] = wild;
  snapshot.pendingWildCard = { ...wild };
  snapshot.selectedCardId = wild.id;
  return snapshot;
}

function boot(snapshot = validEightsSnapshot(), initialStorage = {}) {
  const timers = new Map();
  const errors = [];
  const writes = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  let nextTimer = 1;
  const dom = new JSDOM(readFileSync(join(root, 'crapeights.html'), 'utf8'), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/crapeights.html',
    virtualConsole,
    // Local modules are preloaded explicitly; no external resources or timers run.
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
      window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.localStorage.setItem('crapeightsSoundOn_v1', '0');
      window.localStorage.setItem('turdsuite_muted', '1');
      window.localStorage.setItem('turdsuite_continue_v1', JSON.stringify({
        v: 1, games: { 'crapeights.html': { updatedAt: 1, snapshot } }
      }));
      Object.entries(initialStorage).forEach(([key, value]) => window.localStorage.setItem(key, JSON.stringify(value)));
      const setItem = window.Storage.prototype.setItem;
      window.Storage.prototype.setItem = function (key, value) {
        writes.push({ key, value });
        return setItem.call(this, key, value);
      };
      sources.forEach((source) => window.eval(source));
      const core = window.TurdSuiteTableContinue;
      window.Suite = {
        table: {
          load: (page) => core.loadContinue(window.localStorage, page),
          remember: (page, state) => core.rememberContinue(window.localStorage, page, state),
          clear: (page) => core.clearContinue(window.localStorage, page)
        },
        guide: { hasSeen: () => true, mark() {} },
        toast() {},
        isMuted: () => true
      };
    }
  });
  openPages.push({ dom, errors });
  const w = dom.window;
  return {
    w,
    timers,
    writes,
    state: () => JSON.parse(w.eval('JSON.stringify({players,deck,discard,currentPlayer,roundNumber,direction,activeSuit,hasDrawnThisTurn,pendingWildCard,roundActive})')),
    snapshot: () => JSON.parse(w.eval('JSON.stringify({kind:"crapeights",v:1,players,deck,discard,roundNumber,currentPlayer,direction,activeSuit,pendingDrawCards,pendingSkips,roundActive,hasDrawnThisTurn,selectedCardId,pendingWildCard,historyLog,nextCardId,overlay:lastOverlay})')),
    stored: () => JSON.parse(w.localStorage.getItem('turdsuite_continue_v1')).games['crapeights.html'].snapshot
  };
}

afterEach(() => {
  openPages.splice(0).forEach(({ dom, errors }) => {
    dom.window.close();
    expect(errors).toEqual([]);
  });
});

describe('Crappy Eights live-page save and input regressions', () => {
  it('loads the old v1 fixture, keeps every card and preserves its save shape', () => {
    const old = validEightsSnapshot();
    const game = boot(old);
    expect(game.w.eval('onboardingOpen')).toBe(false);
    // This is the exact historical fixture: no optional defaults are added first.
    // Check the live variables as well as storage, which alone could hide a
    // renderer that left the old save untouched but restored the wrong state.
    expect(game.snapshot()).toEqual(old);
    expect(game.stored()).toEqual(old);
    expect(game.w.document.querySelectorAll('#playerHand .card-btn')).toHaveLength(7);
    expect(game.w.document.querySelector('#playerHand [aria-pressed="true"]').dataset.cardId).toBe(String(old.selectedCardId));
    expect(game.w.document.getElementById('historyText').textContent).toContain(old.historyLog[0]);
    game.w.document.getElementById('playBtn').click();
    expect(game.state().discard.at(-1)).toEqual(old.players[0].hand[0]);
    expect(game.state().players[0].hand).toHaveLength(6);
    expect(game.state().currentPlayer).toBe(1);
    expect(boot(game.stored()).snapshot()).toEqual(game.stored());
  });

  it('resolves old saved draw and skip penalties once while preserving all 52 cards', () => {
    const snapshot = validEightsSnapshot();
    snapshot.direction = -1;
    snapshot.pendingDrawCards = 2;
    snapshot.pendingSkips = 1;
    const game = boot(snapshot);
    expect(game.snapshot()).toMatchObject({
      direction: -1, currentPlayer: 2, pendingDrawCards: 0, pendingSkips: 0,
      hasDrawnThisTurn: false, selectedCardId: null, nextCardId: 53
    });
    expect(game.state().players[0].hand).toEqual([
      ...snapshot.players[0].hand, snapshot.deck.at(-1), snapshot.deck.at(-2)
    ]);
    expect(game.state().players.slice(1)).toEqual(snapshot.players.slice(1));
    expect(game.state().deck).toEqual(snapshot.deck.slice(0, -2));
    expect(game.snapshot().historyLog).toEqual([
      expect.stringContaining('Riley got skipped.'),
      expect.stringContaining('You draws 2 and loses turn.'),
      ...snapshot.historyLog
    ]);
    const cards = [...game.state().deck, ...game.state().discard, ...game.state().players.flatMap(player => player.hand)];
    expect(cards.map(card => card.id).sort((a, b) => a - b)).toEqual(Array.from({ length: 52 }, (_, i) => i + 1));
    const resumed = boot(game.stored());
    expect(resumed.snapshot()).toEqual(game.stored());
    expect(resumed.w.eval('aiTurnTimeoutId')).not.toBeNull();
  });

  it('accepts one draw across repeated button and direct input after restoring', () => {
    const game = boot();
    const before = game.state();
    game.w.document.getElementById('drawBtn').click();
    const once = game.state();
    game.w.document.getElementById('drawBtn').click();
    game.w.drawForHuman();
    expect(game.state()).toEqual(once);
    expect(once.players[0].hand).toHaveLength(before.players[0].hand.length + 1);
    expect(once.deck).toHaveLength(before.deck.length - 1);
    expect(once.hasDrawnThisTurn).toBe(true);
  });

  it('preserves a saved drawn turn and accepts Pass after Continue without drawing twice', () => {
    const game = boot();
    game.w.document.getElementById('drawBtn').click();
    const saved = game.stored();
    const resumed = boot(saved);
    expect(resumed.snapshot()).toEqual(saved);
    expect(resumed.w.document.getElementById('drawBtn').disabled).toBe(true);
    resumed.w.drawForHuman();
    expect(resumed.snapshot()).toEqual(saved);
    resumed.w.document.getElementById('passBtn').click();
    expect(resumed.state().currentPlayer).toBe(1);
    expect(resumed.state().hasDrawnThisTurn).toBe(false);
    expect(resumed.state().players).toEqual(saved.players);
    expect(resumed.state().deck).toEqual(saved.deck);
  });

  it('learns a public pass only when it commits, regardless of hidden playable cards', () => {
    const game = boot();
    expect(game.w.eval('getPlayableCards(players[0].hand).length')).toBeGreaterThan(0);
    game.w.drawForHuman();
    expect(game.w.eval('aiMemory.seats[0]')).toBeUndefined();
    const pending = game.w.eval('humanAutoPassTimeoutId');
    expect(game.timers.has(pending)).toBe(true);
    game.timers.get(pending).callback();
    expect(game.w.eval('aiMemory.seats[0].shortSuits.C')).toBe(1);
    expect(game.state().currentPlayer).not.toBe(0);
  });

  it('blocks game actions behind the welcome guide', () => {
    const game = boot();
    game.w.showWelcomeGuide();
    const before = game.state();
    game.w.drawForHuman();
    game.w.playSelectedCard();
    game.w.smartMove();
    expect(game.state()).toEqual(before);
    expect(game.w.eval('onboardingOpen')).toBe(true);
  });

  it('holds human actions while focus is suspended', () => {
    const game = boot();
    game.w.dispatchEvent(new game.w.Event('blur'));
    const before = game.state();
    game.w.drawForHuman();
    game.w.playSelectedCard();
    game.w.smartMove();
    expect(game.state()).toEqual(before);
    game.w.dispatchEvent(new game.w.Event('focus'));
    game.w.drawForHuman();
    expect(game.state().hasDrawnThisTurn).toBe(true);
  });

  it('restores an unresolved wild and blocks draws until the suit is chosen', () => {
    const snapshot = pendingWildSnapshot();
    const wild = snapshot.pendingWildCard;
    const game = boot(snapshot);
    expect(game.snapshot()).toEqual(snapshot);
    expect(game.stored()).toEqual(snapshot);
    expect(game.w.document.getElementById('suitChooser').style.display).toBe('flex');
    expect(game.w.document.activeElement).toBe(game.w.document.querySelector('#suitChooser .recommended'));
    const before = game.state();
    game.w.drawForHuman();
    game.w.smartMove();
    expect(game.state()).toEqual(before);
    game.w.handleSuitChoice('D');
    expect(game.state().pendingWildCard).toBeNull();
    expect(game.state().discard.at(-1)).toEqual(wild);
    expect(game.state().activeSuit).toBe('D');
    expect(game.state().players[0].hand).toHaveLength(6);
  });

  it.each(['Help', 'background'])('preserves the unresolved wild while %s pauses input', (reason) => {
    const game = boot(pendingWildSnapshot());
    if (reason === 'Help') { game.w.showWelcomeGuide(); }
    else { game.w.dispatchEvent(new game.w.Event('blur')); }
    const before = game.state();
    game.w.handleSuitChoice('D');
    expect(game.state()).toEqual(before);
    if (reason === 'Help') { game.w.hideWelcomeGuide(); }
    else { game.w.dispatchEvent(new game.w.Event('focus')); }
    game.w.handleSuitChoice('D');
    expect(game.state().pendingWildCard).toBeNull();
    expect(game.state().activeSuit).toBe('D');
  });

  it('opening the wild wheel cancels an automatic pass without advancing the turn', () => {
    const snapshot = pendingWildSnapshot();
    const game = boot(snapshot);
    game.w.hideSuitChooser();
    game.w.eval('hasDrawnThisTurn = true; queueHumanAutoPass(460);');
    const timer = game.w.eval('humanAutoPassTimeoutId');
    game.w.showSuitChooser(game.w.eval('players[0].hand[0]'));
    expect(game.timers.has(timer)).toBe(false);
    expect(game.state().currentPlayer).toBe(0);
    game.w.handleSuitChoice('D');
    expect(game.state().discard.at(-1)).toEqual(snapshot.pendingWildCard);
  });

  it('cancels a pending wild with Escape without losing or playing the card', () => {
    const game = boot(pendingWildSnapshot());
    const before = game.state();
    const modal = game.w.document.getElementById('suitChooser');
    modal.querySelector('button').dispatchEvent(new game.w.KeyboardEvent('keydown', {
      key: 'Escape', code: 'Escape', bubbles: true, cancelable: true
    }));
    expect(game.state()).toEqual({ ...before, pendingWildCard: null });
    expect(modal.style.display).toBe('none');
    expect(game.w.document.querySelector('.shell').inert).toBe(false);
    expect(game.stored().pendingWildCard).toBeNull();
  });

  it('does not hijack native Enter activation on a focused button', () => {
    const game = boot();
    const button = game.w.document.getElementById('drawBtn');
    button.focus();
    const before = game.state();
    const event = new game.w.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    // JSDOM does not synthesize the native click; only the shortcut handler runs.
    expect(event.defaultPrevented).toBe(false);
    expect(game.state()).toEqual(before);
  });

  it.each([
    ['card face', '#playerHand .card-btn .center', null],
    ['modal control', '#quickStartBtn', 'showWelcomeGuide'],
    ['details summary', '#tableDrawer summary span', 'openTableDrawer']
  ])('preserves native rapid-tap activation on a %s', (_name, selector, openModal) => {
    const game = boot();
    if (openModal) { game.w[openModal](); }
    const target = game.w.document.querySelector(selector);
    expect(target).not.toBeNull();
    let documentTouches = 0;
    // Model a second touch inside the suite's 350 ms double-tap zoom window.
    // Canceling it at document would also suppress its native button click.
    game.w.document.addEventListener('touchend', event => {
      documentTouches++;
      event.preventDefault();
    }, { passive: false });
    const event = new game.w.Event('touchend', { bubbles: true, cancelable: true });
    expect(target.dispatchEvent(event)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
    expect(documentTouches).toBe(0);

    // Ordinary table touches still reach the global guard; the exception is
    // limited to controls, including their nested artwork and label spans.
    const backgroundTouch = new game.w.Event('touchend', { bubbles: true, cancelable: true });
    game.w.document.querySelector('.arena').dispatchEvent(backgroundTouch);
    expect(documentTouches).toBe(1);
    expect(backgroundTouch.defaultPrevented).toBe(true);
  });

  it('keeps keyboard card focus through selection and supports arrows, Home and End', () => {
    const game = boot();
    const hand = game.w.document.getElementById('playerHand');
    const cards = [...hand.querySelectorAll('.card-btn')];
    const press = (code) => {
      const event = new game.w.KeyboardEvent('keydown', { key: code, code, bubbles: true, cancelable: true });
      game.w.document.activeElement.dispatchEvent(event);
      return event;
    };
    cards[0].focus();
    expect(press('ArrowRight').defaultPrevented).toBe(true);
    expect(game.w.document.activeElement).toBe(cards[1]);
    expect(press('End').defaultPrevented).toBe(true);
    expect(game.w.document.activeElement).toBe(cards.at(-1));
    press('Home');
    press('ArrowRight');
    press('ArrowRight');
    const selected = game.w.document.activeElement;
    const before = game.state();
    expect(press('Enter').defaultPrevented).toBe(false);
    // JSDOM does not synthesize native keyboard activation; model its one click.
    selected.click();
    expect(game.state()).toEqual(before);
    expect(game.w.document.activeElement).toBe(selected);
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(selected.getAttribute('aria-label')).toMatch(/selected/i);
    expect(press('Enter').defaultPrevented).toBe(false);
    selected.click();
    expect(game.state().discard.at(-1).id).toBe(Number(selected.dataset.cardId));
    expect(game.state().players[0].hand).toHaveLength(6);
    expect(game.w.document.activeElement).toBe(cards[3]);
  });

  it('announces a bot play through the polite atomic live region', () => {
    const snapshot = validEightsSnapshot();
    snapshot.currentPlayer = 1;
    snapshot.selectedCardId = null;
    const isAction = card => ['8', 'J', 'Q'].includes(card.rank);
    snapshot.deck.push(...snapshot.players[1].hand.filter(isAction));
    snapshot.players[1].hand = snapshot.players[1].hand.filter(card => !isAction(card));
    const game = boot(snapshot);
    const timer = game.w.eval('aiTurnTimeoutId');
    game.timers.get(timer).callback();
    const status = game.w.document.getElementById('statusText');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-atomic')).toBe('true');
    expect(status.textContent).toMatch(/Casey played/);
    expect(game.state().discard).toHaveLength(2);
  });

  it('pauses the drawer, persists difficulty separately and resumes without snapshot changes', () => {
    const game = boot();
    const before = game.state();
    game.w.document.getElementById('tableDrawerBtn').focus();
    game.w.document.getElementById('tableDrawerBtn').click();
    expect(game.w.document.getElementById('tableDrawer').style.display).toBe('flex');
    expect(game.w.document.querySelector('.shell').inert).toBe(true);
    game.w.drawForHuman(); game.w.smartMove();
    expect(game.state()).toEqual(before);
    const selector = game.w.document.getElementById('aiDifficulty');
    selector.value = 'sharp';
    selector.dispatchEvent(new game.w.Event('change', { bubbles: true }));
    expect(game.w.localStorage.getItem('crapeights_difficulty_v1')).toBe('sharp');
    expect(game.stored()).toEqual(validEightsSnapshot());
    selector.dispatchEvent(new game.w.KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));
    expect(game.w.document.getElementById('tableDrawer').style.display).toBe('none');
    expect(game.w.document.activeElement.id).toBe('tableDrawerBtn');
    game.w.drawForHuman();
    expect(game.state().hasDrawnThisTurn).toBe(true);
  });

  it('keeps a pending automatic pass paused across focus return with the drawer open', () => {
    const game = boot();
    game.w.drawForHuman();
    game.w.openTableDrawer();
    const before = game.state();
    game.w.dispatchEvent(new game.w.Event('blur'));
    game.w.dispatchEvent(new game.w.Event('focus'));
    expect(game.state()).toEqual(before);
    expect(game.w.eval('humanAutoPassTimeoutId')).toBeNull();
    game.w.closeTableDrawer();
    expect(game.w.eval('humanAutoPassTimeoutId')).not.toBeNull();
  });

  it('lets Smart pass after an unplayable draw instead of cancelling and stalling', () => {
    const game = boot();
    game.w.eval("players[0].hand = [{id: 999, rank: '4', suit: 'D'}]; hasDrawnThisTurn = true; updateAll(); queueHumanAutoPass(460);");
    expect(game.w.eval('getPlayableCards(players[0].hand).length')).toBe(0);
    game.w.smartMove();
    expect(game.state().currentPlayer).not.toBe(0);
    expect(game.w.eval('humanAutoPassTimeoutId')).toBeNull();
  });

  it('reveals a receipt from the old finished shape without counting another round', () => {
    const snapshot = validEightsSnapshot();
    snapshot.roundActive = false;
    snapshot.deck.push(...snapshot.players[1].hand);
    snapshot.players[1].hand = [];
    snapshot.overlay = { title: 'Bot wins', summary: 'Round complete', matchFinished: false, tone: 'defeat', flavor: 'Dirty tricks.', kicker: 'Round Over' };
    const previousStats = { matchesPlayed: 4, matchesWon: 1, roundsPlayed: 17, roundsWon: 6, bestRoundPoints: 144 };
    const previousDisplayStats = { v: 1, roundsPlayed: 8, roundsWon: 3, matchesPlayed: 2, matchesWon: 1, pointsCollected: 250, bestRound: 100, winStreak: 1, bestStreak: 2 };
    const game = boot(snapshot, { crapeightsStats: previousStats, crapeights_stats_v1: previousDisplayStats });
    expect(game.w.document.querySelector('.ce-receipt-total').textContent).toContain('TOTAL FLUSHED');
    const expected = game.w.CrapeightsEffects.scoringReceipt(snapshot.players, 1).total;
    expect(game.w.document.querySelector('.ce-receipt-total strong').textContent).toBe(`+${expected}`);
    expect(game.w.localStorage.getItem('crapeightsStats')).toBe(JSON.stringify(previousStats));
    expect(game.w.localStorage.getItem('crapeights_stats_v1')).toBe(JSON.stringify(previousDisplayStats));
    expect(game.writes.filter(write => ['crapeightsStats', 'crapeights_stats_v1'].includes(write.key))).toEqual([]);
    expect(game.snapshot()).toEqual(snapshot);
    expect(game.stored()).toEqual(snapshot);
  });

  it('retains both stats key formats while recording a continued match win once', () => {
    const snapshot = validEightsSnapshot();
    snapshot.deck.push(...snapshot.players[0].hand.splice(1));
    snapshot.players[0].score = 199;
    const previousStats = { matchesPlayed: 4, matchesWon: 1, roundsPlayed: 17, roundsWon: 6, bestRoundPoints: 144 };
    const previousDisplayStats = { v: 1, roundsPlayed: 8, roundsWon: 3, matchesPlayed: 2, matchesWon: 1, pointsCollected: 250, bestRound: 100, winStreak: 1, bestStreak: 2 };
    const game = boot(snapshot, { crapeightsStats: previousStats, crapeights_stats_v1: previousDisplayStats });
    const points = game.w.CrapeightsEffects.scoringReceipt(snapshot.players, 0).total;
    game.w.document.getElementById('playBtn').click();
    const expectedLegacy = { matchesPlayed: 5, matchesWon: 2, roundsPlayed: 18, roundsWon: 7, bestRoundPoints: Math.max(144, points) };
    const expectedDisplay = { v: 1, roundsPlayed: 9, roundsWon: 4, matchesPlayed: 3, matchesWon: 2, pointsCollected: 250 + points, bestRound: Math.max(100, points), winStreak: 2, bestStreak: 2 };
    expect(JSON.parse(game.w.localStorage.getItem('crapeightsStats'))).toEqual(expectedLegacy);
    expect(JSON.parse(game.w.localStorage.getItem('crapeights_stats_v1'))).toEqual(expectedDisplay);
    expect(game.writes.filter(write => write.key === 'crapeightsStats')).toHaveLength(1);
    expect(game.writes.filter(write => write.key === 'crapeights_stats_v1')).toHaveLength(1);
    expect(game.snapshot().overlay.matchFinished).toBe(true);
    expect(game.state().roundActive).toBe(false);
    const summary = game.w.document.getElementById('roundSummary');
    const overlay = game.w.document.getElementById('roundOverlay');
    expect(overlay.getAttribute('aria-describedby')).toBe(summary.id);
    expect(summary.getAttribute('role')).toBe('status');
    expect(summary.getAttribute('aria-live')).toBe('polite');
    expect(summary.getAttribute('aria-atomic')).toBe('true');
    expect(summary.textContent).toContain(`You reached ${199 + points}. Match complete in round 2.`);
    expect(summary.closest('.shell')).toBeNull();
    expect(overlay.contains(game.w.document.activeElement)).toBe(true);
    const resumed = boot(game.stored(), { crapeightsStats: expectedLegacy, crapeights_stats_v1: expectedDisplay });
    expect(resumed.snapshot()).toEqual(game.stored());
    expect(resumed.writes.filter(write => ['crapeightsStats', 'crapeights_stats_v1'].includes(write.key))).toEqual([]);
  });

  it('keeps finished saves finished after focus events and repeated input', () => {
    const snapshot = validEightsSnapshot();
    snapshot.roundActive = false;
    snapshot.overlay = {
      title: 'You win the match!', summary: 'The crown is yours.', matchFinished: true,
      tone: 'match-win', flavor: 'A royal flush of sewer glory.', kicker: 'Sewer Crown'
    };
    const game = boot(snapshot);
    const before = game.state();
    game.w.dispatchEvent(new game.w.Event('focus'));
    game.w.document.dispatchEvent(new game.w.Event('visibilitychange'));
    game.w.drawForHuman();
    game.w.playSelectedCard();
    game.w.smartMove();
    expect(game.state()).toEqual(before);
    expect(game.w.eval('aiTurnTimeoutId')).toBeNull();
    expect(game.w.eval('lastOverlay.matchFinished')).toBe(true);
    expect(game.w.document.getElementById('roundOverlay').style.display).toBe('flex');
  });
});
