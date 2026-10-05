import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';
import { validEightsSnapshot } from './continue-fixtures.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const openPages = [];
const sources = ['table-continue-core', 'crapeights-ai', 'crapeights-presentation', 'crapeights-table']
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

function boot(snapshot = validEightsSnapshot()) {
  const timers = new Map();
  const errors = [];
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
    state: () => JSON.parse(w.eval('JSON.stringify({players,deck,discard,currentPlayer,roundNumber,direction,activeSuit,hasDrawnThisTurn,pendingWildCard,roundActive})')),
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
    expect(game.state()).toMatchObject({
      players: old.players, deck: old.deck, discard: old.discard,
      currentPlayer: old.currentPlayer, roundNumber: old.roundNumber,
      direction: old.direction, activeSuit: old.activeSuit
    });
    expect(game.stored()).toEqual(old);
    expect(game.w.document.querySelectorAll('#playerHand .card-btn')).toHaveLength(7);
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
    expect(game.w.document.getElementById('suitChooser').style.display).toBe('flex');
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
