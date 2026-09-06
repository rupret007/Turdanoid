import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const openPages = [];
const tables = [
  {
    page: 'turdspades.html',
    start: 'closeGuide(); el.lockBid.click();',
    paused: 'focusSuspendedPlay',
    snapshot: 'JSON.stringify([state.hands, state.trick, state.scores, state.currentPlayer])',
    openGuide: 'openGuide()',
    closeGuide: 'closeGuide()',
    reset: 'startMatch()',
    finish:
      'state.hands = [[], [], [], []]; state.tricks = [4, 3, 3, 3]; scoreRound("Final trick"); render();'
  },
  {
    page: 'turdrummy.html',
    start: 'closeGuide(); startFirstRoundIfNeeded();',
    paused: 'focusPausedAiTurn',
    snapshot:
      'JSON.stringify([state.playerHand, state.aiHand, state.stock, state.discard, state.playerScore, state.aiScore, state.turn])',
    openGuide: 'openGuide()',
    closeGuide: 'closeGuide()',
    reset: 'resetMatch()',
    finish: 'resolveStockStall("Stock exhausted. Round ends in a draw.")'
  },
  {
    page: 'crapeights.html',
    start: 'hideWelcomeGuide(); roundNumber = 2; startRound();',
    paused: 'focusSuspendedRound',
    snapshot: 'JSON.stringify([players, deck, discard, currentPlayer])',
    openGuide: 'showWelcomeGuide()',
    closeGuide: 'hideWelcomeGuide()',
    reset: 'startFreshMatch()',
    finish: 'endRound(0)'
  }
];

function boot(table) {
  const timers = new Map();
  let nextTimer = 1;
  let hidden = false;
  const dom = new JSDOM(readFileSync(join(root, table.page), 'utf8'), {
    runScripts: 'dangerously',
    url: `http://localhost/${table.page}`,
    beforeParse(window) {
      Object.defineProperty(window.document, 'hidden', { get: () => hidden });
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
    }
  });
  openPages.push(dom);
  const w = dom.window;
  w.eval(table.start);
  return {
    w,
    timers,
    setHidden(value) {
      hidden = value;
    },
    event(name) {
      (name === 'visibilitychange' ? w.document : w).dispatchEvent(new w.Event(name));
    },
    timer() {
      return w.eval('aiTurnTimeoutId');
    },
    paused() {
      return w.eval(table.paused);
    },
    snapshot() {
      return w.eval(table.snapshot);
    },
    run(id) {
      const timer = timers.get(id);
      expect(timer).toBeDefined();
      timers.delete(id);
      timer.callback();
    }
  };
}

afterEach(() => {
  openPages.splice(0).forEach((dom) => dom.window.close());
});

describe.each(tables)('$page return to the live table', (table) => {
  it('resumes the waiting bot on window focus without a tab visibility change', () => {
    const game = boot(table);
    const originalTimer = game.timer();
    expect(originalTimer).not.toBeNull();
    const before = game.snapshot();
    game.event('blur');
    expect(game.paused()).toBe(true);
    expect(game.timer()).toBeNull();
    expect(game.timers.has(originalTimer)).toBe(false);
    expect(game.snapshot()).toBe(before);

    game.event('focus');
    expect(game.paused()).toBe(false);
    expect(game.timer()).not.toBeNull();
    game.run(game.timer());
    expect(game.snapshot()).not.toBe(before);
  });

  it('keeps the same pending turn when focus and visible events both arrive', () => {
    const game = boot(table);
    game.event('blur');
    game.event('focus');
    const resumedTimer = game.timer();
    expect(resumedTimer).not.toBeNull();
    game.event('visibilitychange');
    game.event('focus');
    expect(game.timer()).toBe(resumedTimer);
    expect(game.timers.has(resumedTimer)).toBe(true);
  });

  it('does not resume on focus while the document is still hidden', () => {
    const game = boot(table);
    game.setHidden(true);
    game.event('visibilitychange');
    game.event('focus');
    expect(game.paused()).toBe(true);
    expect(game.timer()).toBeNull();
    game.setHidden(false);
    game.event('visibilitychange');
    expect(game.paused()).toBe(false);
    expect(game.timer()).not.toBeNull();
  });

  it('keeps the guide open and waits until it closes before moving', () => {
    const game = boot(table);
    const before = game.snapshot();
    game.event('blur');
    game.w.eval(table.openGuide);
    game.event('focus');
    expect(game.timer()).toBeNull();
    expect(game.snapshot()).toBe(before);
    game.w.eval(table.closeGuide);
    expect(game.timer()).not.toBeNull();
    game.run(game.timer());
    expect(game.snapshot()).not.toBe(before);
  });

  it('does not start a turn when the guide closes in a hidden document', () => {
    const game = boot(table);
    game.w.eval(table.openGuide);
    game.setHidden(true);
    game.event('visibilitychange');
    game.w.eval(table.closeGuide);
    expect(game.timer()).toBeNull();
    expect(game.paused()).toBe(true);
    game.setHidden(false);
    game.event('focus');
    expect(game.timer()).not.toBeNull();
  });

  it('leaves a fresh match alone when a late focus event follows reset', () => {
    const game = boot(table);
    game.event('blur');
    game.w.eval(table.reset);
    const fresh = game.snapshot();
    expect(game.paused()).toBe(false);
    expect(game.timer()).toBeNull();
    game.event('focus');
    game.event('visibilitychange');
    expect(game.timer()).toBeNull();
    expect(game.snapshot()).toBe(fresh);
  });

  it('does not revive a completed round on late focus or visible events', () => {
    const game = boot(table);
    game.event('blur');
    game.w.eval(table.finish);
    const finished = game.snapshot();
    expect(game.timer()).toBeNull();
    game.event('focus');
    game.event('visibilitychange');
    expect(game.timer()).toBeNull();
    expect(game.snapshot()).toBe(finished);
  });

  it('holds a callback if the page becomes hidden before its visibility event', () => {
    const game = boot(table);
    const before = game.snapshot();
    const pending = game.timer();
    game.setHidden(true);
    game.run(pending);
    expect(game.snapshot()).toBe(before);
    expect(game.paused()).toBe(true);
    expect(game.timer()).toBeNull();
    game.setHidden(false);
    game.event('focus');
    expect(game.timer()).not.toBeNull();
    game.run(game.timer());
    expect(game.snapshot()).not.toBe(before);
  });
});

function bootEightsAutoPass() {
  const game = boot(tables[2]);
  game.w.eval(`
    startFreshMatch();
    const blockedIndex = deck.findIndex(card => !isPlayable(card));
    if (blockedIndex < 0) throw new Error('Fixture needs an unplayable stock card');
    deck.push(deck.splice(blockedIndex, 1)[0]);
    drawForHuman();
  `);
  expect(game.w.eval('hasDrawnThisTurn')).toBe(true);
  expect(game.w.eval('humanAutoPassTimeoutId')).not.toBeNull();
  return game;
}

describe('Crappy Eights return after an unplayable draw', () => {
  it('replaces the away status with the actual human action after returning', () => {
    const game = boot(tables[2]);
    game.w.startFreshMatch();
    game.event('blur');
    expect(game.w.document.getElementById('statusText').textContent).toContain('paused');
    game.event('focus');
    expect(game.w.document.getElementById('statusText').textContent).toBe(
      'Your turn. Play a matching card or draw.'
    );
    expect(game.timer()).toBeNull();
    expect(game.w.eval('humanAutoPassTimeoutId')).toBeNull();
  });

  it('resumes the same pending pass once on visible focus', () => {
    const game = bootEightsAutoPass();
    const before = game.snapshot();
    game.event('blur');
    expect(game.w.eval('humanAutoPassTimeoutId')).toBeNull();
    game.event('focus');
    const timer = game.w.eval('humanAutoPassTimeoutId');
    expect(timer).not.toBeNull();
    game.event('visibilitychange');
    game.event('focus');
    expect(game.w.eval('humanAutoPassTimeoutId')).toBe(timer);
    expect(game.snapshot()).toBe(before);
    game.run(timer);
    expect(game.w.eval('currentPlayer')).not.toBe(0);
  });

  it('keeps the pending pass through guide open, focus, and guide close', () => {
    const game = bootEightsAutoPass();
    game.event('blur');
    game.w.showWelcomeGuide();
    game.event('focus');
    expect(game.w.eval('humanAutoPassTimeoutId')).toBeNull();
    expect(game.w.eval('resumeHumanAutoPassAfterFocus')).toBe(true);
    game.w.hideWelcomeGuide();
    const timer = game.w.eval('humanAutoPassTimeoutId');
    expect(timer).not.toBeNull();
    game.run(timer);
    expect(game.w.eval('currentPlayer')).not.toBe(0);
  });

  it('holds a pass callback that discovers the page is hidden', () => {
    const game = bootEightsAutoPass();
    const before = game.snapshot();
    game.setHidden(true);
    game.run(game.w.eval('humanAutoPassTimeoutId'));
    expect(game.snapshot()).toBe(before);
    expect(game.w.eval('resumeHumanAutoPassAfterFocus')).toBe(true);
    game.setHidden(false);
    game.event('focus');
    game.run(game.w.eval('humanAutoPassTimeoutId'));
    expect(game.w.eval('currentPlayer')).not.toBe(0);
  });

  it('keeps a pending pass when the guide closes before the hidden page returns', () => {
    const game = bootEightsAutoPass();
    const before = game.snapshot();
    game.event('blur');
    game.w.showWelcomeGuide();
    game.setHidden(true);
    game.event('focus');
    game.w.hideWelcomeGuide();
    expect(game.w.eval('humanAutoPassTimeoutId')).toBeNull();
    expect(game.w.eval('resumeHumanAutoPassAfterFocus')).toBe(true);
    expect(game.snapshot()).toBe(before);
    game.setHidden(false);
    game.event('focus');
    game.run(game.w.eval('humanAutoPassTimeoutId'));
    expect(game.w.eval('currentPlayer')).not.toBe(0);
  });

  it('does not pass the fresh match when reset happens while away', () => {
    const game = bootEightsAutoPass();
    game.event('blur');
    game.w.startFreshMatch();
    const fresh = game.snapshot();
    game.event('focus');
    game.event('visibilitychange');
    expect(game.w.eval('humanAutoPassTimeoutId')).toBeNull();
    expect(game.w.eval('resumeHumanAutoPassAfterFocus')).toBe(false);
    expect(game.snapshot()).toBe(fresh);
  });
});
