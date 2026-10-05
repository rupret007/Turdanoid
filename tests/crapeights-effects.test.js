import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../games/crapeights-effects.js';

const Effects = globalThis.CrapeightsEffects;
const controllers = [];

function documentHarness() {
  const animations = [];
  function element() {
    return {
      style: {}, dataset: {}, children: [], isConnected: true,
      setAttribute: vi.fn(),
      querySelector: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({ left: 30, top: 50, width: 90, height: 110 })),
      appendChild(child) { this.children.push(child); child.parent = this; },
      append(...children) { children.forEach(child => this.appendChild(child)); },
      replaceChildren() { this.children.forEach(child => { child.isConnected = false; }); this.children = []; },
      remove() {
        this.isConnected = false;
        if (this.parent) { this.parent.children = this.parent.children.filter(child => child !== this); }
      },
      animate: vi.fn(() => {
        const animation = { cancel: vi.fn() };
        animations.push(animation);
        return animation;
      })
    };
  }
  const doc = { body: element(), createElement: vi.fn(element) };
  const seats = Array.from({ length: 4 }, () => {
    const target = element();
    target.querySelector.mockReturnValue(element());
    return target;
  });
  const presentation = { flyCard: vi.fn(), celebrate: vi.fn(), clearEffects: vi.fn() };
  const announce = vi.fn();
  vi.stubGlobal('document', doc);
  return { doc, seats, animations, presentation, announce, element };
}

function controller(harness, options = {}) {
  const result = Effects.createController({ seat: index => harness.seats[index], fan: index => harness.seats[index], deck: harness.seats[0], pile: harness.seats[0], arena: harness.seats[0], presentation: harness.presentation, announce: harness.announce, ...options });
  controllers.push(result);
  return result;
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  controllers.splice(0).forEach(instance => instance.destroy());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Crappy Eights action and scoring decisions', () => {
  it('directs penalties to the victim, personal celebrations to their player, and caps card flights', () => {
    expect(Effects.actionPlan({ type: 'drawtwo', playerIndex: 3, targetIndex: 0, count: 6 })).toMatchObject({ target: 0, label: '+6 CARDS', flightCount: 2 });
    expect(Effects.actionPlan({ type: 'skip', playerIndex: 1, targetIndex: 2 })).toMatchObject({ target: 2, label: 'SKIP' });
    expect(Effects.actionPlan({ type: 'oneleft', playerIndex: 1, targetIndex: 2 })).toMatchObject({ target: 1, label: 'ONE LEFT!' });
    expect(Effects.actionPlan({ type: 'reverse', direction: -1 }).label).toBe('↺ REVERSE');
    expect(Effects.actionPlan({ type: 'wild', suit: 'H' }).label).toBe('♥ WILD SUIT');
  });

  it('preserves textual information while disabling every large reduced-motion effect', () => {
    expect(Effects.motionPolicy(true)).toMatchObject({ flightCount: 0, reactionDuration: 0, orbitDuration: 0, receiptStep: 0 });
    const plan = Effects.actionPlan({ type: 'drawtwo', targetIndex: 2 }, true);
    expect(plan).toMatchObject({ animate: false, label: '+2 CARDS', flightCount: 0 });
    expect(plan.speech.length).toBeGreaterThan(5);
    for (const type of ['idle', 'thinking', 'skip', 'drawtwo', 'win', 'oneleft']) {
      expect(Effects.speechFor(type, 1)).not.toBe(Effects.speechFor(type, 2));
      expect(Effects.speechFor(type, 0)).toBe(Effects.speechFor(type, 3));
    }
  });

  it('receipts every remaining card using the existing scoring rules without changing hands', () => {
    const players = [{ name: 'You', hand: [] }, { name: 'Pip', hand: ['8', 'A', 'J', 'Q', 'K', '10', '2'].map(rank => ({ rank, suit: 'S' })) }, { name: 'Flo', hand: [{ rank: '9', suit: 'H' }] }];
    const before = JSON.stringify(players);
    const receipt = Effects.scoringReceipt(players, 0);
    expect(receipt.total).toBe(102);
    expect(receipt.rows.map(row => row.points)).toEqual([93, 9]);
    expect(receipt.rows[0].cards).toHaveLength(7);
    expect(receipt.rows[0].cards[0].points).toBe(50);
    expect(JSON.stringify(players)).toBe(before);
    expect(Effects.scoringReceipt([], 0)).toEqual({ rows: [], total: 0 });
    expect(Effects.scoringReceipt([{ name: 'Winner', hand: [{ rank: '8' }] }], 0).total).toBe(0);
  });
});

describe('Crappy Eights optional display statistics', () => {
  it('starts clean with absent, malformed or blocked storage', () => {
    for (const text of [null, '{bad', 'null', '[]', '"wrong"']) {
      expect(Effects.readStats({ getItem: () => text })).toEqual(Effects.sanitizeStats(null));
    }
    expect(Effects.readStats({ getItem() { throw new Error('blocked'); } }).roundsPlayed).toBe(0);
    expect(Effects.saveStats({}, { setItem() { throw new Error('full'); } })).toBe(false);
  });

  it('sanitizes corrupt counts and writes only the new optional storage key', () => {
    const storage = { getItem: vi.fn(() => JSON.stringify({ roundsPlayed: 3, roundsWon: 8, winStreak: 7, bestStreak: 2, pointsCollected: -1, bestRound: '50', matchesPlayed: 1.5 })), setItem: vi.fn() };
    const stats = Effects.readStats(storage);
    expect(stats).toMatchObject({ v: 1, roundsPlayed: 3, roundsWon: 3, winStreak: 3, bestStreak: 3, pointsCollected: 0, bestRound: 0, matchesPlayed: 0 });
    expect(Effects.saveStats(stats, storage)).toBe(true);
    expect(storage.getItem).toHaveBeenCalledWith('crapeights_stats_v1');
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem.mock.calls[0][0]).toBe('crapeights_stats_v1');
  });

  it('counts finished rounds, human points and streaks without mutating prior stats', () => {
    const initial = Effects.sanitizeStats(null);
    const first = Effects.recordRound(initial, { humanWon: true, points: 92 });
    const second = Effects.recordRound(first, { humanWon: true, points: 108, matchFinished: true });
    const loss = Effects.recordRound(second, { humanWon: false, points: 180, matchFinished: true });
    expect(initial.roundsPlayed).toBe(0);
    expect(first).toMatchObject({ roundsPlayed: 1, roundsWon: 1, pointsCollected: 92, winStreak: 1, matchesPlayed: 0 });
    expect(second).toMatchObject({ roundsPlayed: 2, roundsWon: 2, pointsCollected: 200, bestRound: 108, winStreak: 2, matchesPlayed: 1, matchesWon: 1 });
    expect(loss).toMatchObject({ roundsPlayed: 3, roundsWon: 2, pointsCollected: 200, bestRound: 108, winStreak: 0, bestStreak: 2, matchesPlayed: 2, matchesWon: 1 });
    expect(Effects.recordRound(loss, { humanWon: true, points: -20 }).pointsCollected).toBe(200);
  });
});

describe('Crappy Eights bounded reactions', () => {
  it('shows the victim speech and stamp with no flights, animations or confetti in reduced motion', () => {
    const harness = documentHarness();
    const effects = controller(harness, { reducedMotion: true });
    effects.action({ type: 'drawtwo', targetIndex: 2, name: 'Pip' });
    expect(harness.seats[2].children[0].textContent).toBe(Effects.speechFor('drawtwo', 2));
    expect(harness.announce).toHaveBeenCalledWith('Pip: +2 CARDS.');
    expect(harness.doc.body.children[0].children[0].textContent).toBe('+2 CARDS');
    effects.action({ type: 'win', playerIndex: 1, matchFinished: true });
    effects.action({ type: 'reverse', playerIndex: 1, direction: -1 });
    effects.action({ type: 'wild', playerIndex: 1, suit: 'H' });
    vi.runAllTimers();
    expect(harness.presentation.flyCard).not.toHaveBeenCalled();
    expect(harness.presentation.celebrate).not.toHaveBeenCalled();
    expect(harness.animations).toHaveLength(0);
    expect(harness.doc.body.children[0].children).toHaveLength(0);
    expect(harness.seats[2].children).toHaveLength(0);
  });

  it('flies two separate cards into the victim fan and cancels delayed effects when cleared', () => {
    const harness = documentHarness();
    const effects = controller(harness, { reducedMotion: false });
    effects.action({ type: 'drawtwo', targetIndex: 3 });
    vi.advanceTimersByTime(0);
    expect(harness.presentation.flyCard).toHaveBeenCalledTimes(1);
    expect(harness.presentation.flyCard).toHaveBeenCalledWith({ source: harness.seats[0], target: harness.seats[3] });
    vi.advanceTimersByTime(145);
    expect(harness.presentation.flyCard).toHaveBeenCalledTimes(2);
    effects.action({ type: 'drawtwo', targetIndex: 2 });
    effects.clear();
    vi.runAllTimers();
    expect(harness.presentation.flyCard).toHaveBeenCalledTimes(2);
    expect(harness.seats[3].children).toHaveLength(0);
    expect(harness.doc.body.children[0].children).toHaveLength(0);
  });

  it('bounds stamps and gives each seat only one speech bubble', () => {
    const harness = documentHarness();
    const effects = controller(harness);
    for (let i = 0; i < 30; i++) { effects.action({ type: 'skip', targetIndex: 1 }); }
    expect(harness.doc.body.children[0].children).toHaveLength(8);
    expect(harness.seats[1].children).toHaveLength(1);
    effects.destroy();
    vi.runAllTimers();
    expect(harness.doc.body.children).toHaveLength(0);
    expect(harness.seats[1].children).toHaveLength(0);
    expect(effects.action({ type: 'skip', targetIndex: 1 })).toBeNull();
  });

  it('clears stale thinking indicators while leaving a penalty reaction readable', () => {
    const harness = documentHarness();
    const effects = controller(harness);
    effects.setThinking(1);
    expect(harness.seats[1].dataset.thinking).toBe('true');
    expect(harness.seats[1].children[0].dataset.reaction).toBe('thinking');
    effects.setThinking(2);
    expect(harness.seats[1].dataset.thinking).toBeUndefined();
    expect(harness.seats[1].children).toHaveLength(0);
    effects.action({ type: 'drawtwo', targetIndex: 2 });
    effects.setThinking(3);
    expect(harness.seats[2].children[0].dataset.reaction).toBe('drawtwo');
    expect(harness.seats[2].dataset.thinking).toBeUndefined();
    effects.setThinking(-1);
    expect(harness.seats[3].dataset.thinking).toBeUndefined();
  });

  it('stops running motion immediately when the operating system preference changes', () => {
    const harness = documentHarness();
    const query = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', () => query);
    const effects = controller(harness);
    effects.action({ type: 'drawtwo', targetIndex: 2 });
    vi.advanceTimersByTime(0);
    const count = harness.presentation.flyCard.mock.calls.length;
    query.matches = true;
    query.addEventListener.mock.calls[0][1]({ matches: true });
    expect(harness.animations.every(animation => animation.cancel.mock.calls.length === 1)).toBe(true);
    expect(harness.doc.body.children[0].children).toHaveLength(0);
    expect(harness.seats[2].children[0].textContent).toBe(Effects.speechFor('drawtwo', 2));
    vi.advanceTimersByTime(150);
    expect(harness.presentation.flyCard).toHaveBeenCalledTimes(count);
  });

  it('reveals all leftover points without animation in reduced motion', () => {
    const harness = documentHarness();
    const effects = controller(harness, { reducedMotion: true });
    const container = harness.element();
    const receipt = Effects.scoringReceipt([{ hand: [] }, { name: 'Pip', hand: [{ rank: '8', suit: 'H' }, { rank: 'Q', suit: 'C' }] }], 0);
    effects.renderReceipt(container, receipt);
    expect(container.children[1].children[0].textContent).toBe('Pip · 60 pts');
    expect(container.children[1].children[1].children.map(node => node.textContent)).toEqual(['8♥', 'Q♣']);
    expect(container.children[2].children[1].textContent).toBe('+60');
    expect(harness.animations).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('finishes an in-progress receipt immediately when reduced motion is enabled', () => {
    const harness = documentHarness();
    const query = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', () => query);
    const effects = controller(harness);
    const container = harness.element();
    const receipt = Effects.scoringReceipt([{ hand: [] }, { name: 'Pip', hand: [{ rank: '8', suit: 'H' }, { rank: 'Q', suit: 'C' }, { rank: 'A', suit: 'S' }] }], 0);
    effects.renderReceipt(container, receipt);
    const counter = container.children[2].children[1];
    expect(counter.textContent).toBe('+0');
    vi.advanceTimersByTime(250);
    expect(counter.textContent).toBe('+50');
    expect(harness.presentation.flyCard).toHaveBeenCalledTimes(1);
    query.matches = true;
    query.addEventListener.mock.calls[0][1]({ matches: true });
    expect(counter.textContent).toBe('+61');
    expect(vi.getTimerCount()).toBe(0);
    expect(harness.animations.every(animation => animation.cancel.mock.calls.length === 1)).toBe(true);
    query.matches = false;
    vi.runAllTimers();
    expect(harness.presentation.flyCard).toHaveBeenCalledTimes(1);
    expect(counter.textContent).toBe('+61');
  });

  it('cancels stale receipt work when replaced or cleared', () => {
    const harness = documentHarness();
    const effects = controller(harness);
    const container = harness.element();
    const first = Effects.scoringReceipt([{ hand: [] }, { name: 'Pip', hand: [{ rank: '8', suit: 'H' }, { rank: 'Q', suit: 'C' }] }], 0);
    const second = Effects.scoringReceipt([{ hand: [] }, { name: 'Flo', hand: [{ rank: '2', suit: 'S' }] }], 0);
    effects.renderReceipt(container, first);
    effects.renderReceipt(container, second);
    vi.runAllTimers();
    expect(container.children[2].children[1].textContent).toBe('+2');
    expect(harness.presentation.flyCard).toHaveBeenCalledTimes(1);
    expect(harness.presentation.flyCard.mock.calls[0][0].card.rank).toBe('2');
    effects.renderReceipt(container, first);
    effects.clear();
    expect(container.children[2].children[1].textContent).toBe('+60');
    expect(vi.getTimerCount()).toBe(0);
    vi.runAllTimers();
    expect(harness.presentation.flyCard).toHaveBeenCalledTimes(1);
  });
});
