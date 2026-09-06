import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'turdrummy.html'), 'utf8');
const openPages = [];

// These are complete, disjoint ten-card hands from one physical deck. The
// live page, not the simplified standalone engine, analyzes and scores them.
const HIGH = {
  knocker: ['H3', 'H4', 'H5', 'C9', 'D9', 'S9', 'C10', 'D10', 'H10', 'D1'],
  defender: ['H6', 'H7', 'C1', 'C2', 'C3', 'S4', 'S5', 'S6', 'S7', 'S8'],
  laidOff: ['H6', 'H7'],
  before: 13,
  after: 0
};
const LOW = {
  ...HIGH,
  defender: ['H1', 'H2', 'C1', 'C2', 'C3', 'S4', 'S5', 'S6', 'S7', 'S8'],
  laidOff: ['H1', 'H2'],
  before: 3
};
const BOTH = {
  knocker: ['H4', 'H5', 'H6', 'C9', 'D9', 'S9', 'C10', 'D10', 'S10', 'D1'],
  defender: ['H2', 'H3', 'H7', 'H8', 'C1', 'C2', 'C3', 'S4', 'S5', 'S6'],
  laidOff: ['H2', 'H3', 'H7', 'H8'],
  before: 20,
  after: 0
};
const COMPETING = {
  knocker: ['C6', 'D6', 'S6', 'H3', 'H4', 'H5', 'C9', 'D9', 'S9', 'D1'],
  defender: ['H6', 'H7', 'C1', 'C2', 'C3', 'S1', 'S2', 'S3', 'S4', 'S5'],
  laidOff: ['H6', 'H7'],
  before: 13,
  after: 0
};
const NO_WRAP = {
  knocker: ['H11', 'H12', 'H13', 'C9', 'D9', 'S9', 'C10', 'D10', 'S10', 'D1'],
  defender: LOW.defender,
  laidOff: [],
  before: 3,
  after: 3
};
const WRONG_SUIT = {
  ...HIGH,
  defender: ['C6', 'C7', 'C1', 'C2', 'C3', 'D4', 'D5', 'D6', 'D7', 'D8'],
  laidOff: [],
  after: 13
};
const NO_ATTACH = {
  ...HIGH,
  defender: ['D12', 'S13', 'C1', 'C2', 'C3', 'S4', 'S5', 'S6', 'S7', 'S8'],
  laidOff: [],
  before: 20,
  after: 20
};
const GIN = {
  ...HIGH,
  knocker: ['H3', 'H4', 'H5', 'C9', 'D9', 'H9', 'S9', 'C10', 'D10', 'S10']
};

function cards(ids) {
  return ids.map((id) => {
    const match = /^([CDHS])(1[0-3]|[1-9])$/.exec(id);
    if (!match) {
      throw new Error(`Invalid fixture card ${id}`);
    }
    return { id, suit: match[1], rank: Number(match[2]) };
  });
}

function fixtureHands(fixture) {
  expect(fixture.knocker).toHaveLength(10);
  expect(fixture.defender).toHaveLength(10);
  expect(new Set([...fixture.knocker, ...fixture.defender]).size).toBe(20);
  return { knocker: cards(fixture.knocker), defender: cards(fixture.defender) };
}

function boot() {
  let nextTimer = 1;
  const timers = new Map();
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'http://localhost/turdrummy.html',
    // No resources option: external scripts, fonts and assets are not loaded.
    // No timer callbacks run unless a test explicitly calls a live game action.
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
    }
  });
  openPages.push(dom);
  const w = dom.window;
  expect(typeof w.applyLayoff).toBe('function');
  return {
    w,
    value(expression) {
      return JSON.parse(w.eval(`JSON.stringify(${expression})`));
    }
  };
}

afterEach(() => {
  openPages.splice(0).forEach((dom) => dom.window.close());
});

function checkLayoff(page, fixture, reversed = false) {
  page.w.__fixtureHands = fixtureHands(fixture);
  const result = page.value(`(() => {
    const hands = __fixtureHands;
    const knocker = analyzeHand(hands.knocker);
    const defender = analyzeHand(hands.defender);
    const melds = ${reversed ? 'knocker.melds.slice().reverse()' : 'knocker.melds'};
    const inputBefore = JSON.stringify([hands, melds]);
    const result = applyLayoff(hands.defender, melds);
    function replayReceipt(index, table) {
      if (index === result.laidOffCards.length) return true;
      const card = result.laidOffCards[index];
      return table.some((meld, destination) => {
        if (!canCardAttachToMeld(card, meld)) return false;
        const nextTable = cloneMelds(table);
        attachCardToMeld(card, nextTable[destination]);
        return replayReceipt(index + 1, nextTable);
      });
    }
    return {
      before: defender.deadwoodScore,
      score: result.deadwoodScore,
      laidOff: result.laidOffCards.map(card => card.id).sort(),
      deadwood: result.deadwoodCards.map(card => card.id).sort(),
      originalDeadwood: defender.deadwoodCards.map(card => card.id).sort(),
      receiptScore: result.deadwoodCards.reduce((total, card) => total + cardDeadwoodValue(card), 0),
      legalReceipt: replayReceipt(0, melds),
      unchanged: JSON.stringify([hands, melds]) === inputBefore
    };
  })()`);
  expect(result.before).toBe(fixture.before);
  expect(result.score).toBe(fixture.after);
  expect(result.laidOff).toEqual(fixture.laidOff.slice().sort());
  expect(result.score).toBe(result.receiptScore);
  expect([...result.deadwood, ...result.laidOff].sort()).toEqual(result.originalDeadwood);
  expect(result.legalReceipt).toBe(true);
  expect(result.unchanged).toBe(true);
  return result;
}

describe('the live TurdRummy layoff search', () => {
  it.each([
    ['higher-end dependent cards', HIGH],
    ['lower-end cards down to Ace', LOW],
    ['both ends of the same run', BOTH]
  ])('lays off every legal chain of %s regardless of input order', (_label, fixture) => {
    const page = boot();
    checkLayoff(page, fixture);
    checkLayoff(page, { ...fixture, defender: fixture.defender.slice().reverse() });
  });

  it('chooses the run over a competing rank set when that unlocks another card', () => {
    const page = boot();
    checkLayoff(page, COMPETING);
    checkLayoff(page, COMPETING, true);
    checkLayoff(page, { ...COMPETING, defender: COMPETING.defender.slice().reverse() }, true);
  });

  it.each([
    ['Ace cannot wrap after King', NO_WRAP],
    ['a run cannot accept another suit', WRONG_SUIT],
    ['unrelated cards remain real deadwood', NO_ATTACH]
  ])('preserves the legal boundary: %s', (_label, fixture) => {
    checkLayoff(boot(), fixture);
  });

  it('keeps real deadwood when there are no opposing melds and handles empty deadwood', () => {
    const page = boot();
    page.w.__fixtureHands = fixtureHands(HIGH);
    const result = page.value(`(() => {
      const hand = __fixtureHands.defender;
      const before = JSON.stringify(hand);
      const noMelds = applyLayoff(hand, []);
      const empty = applyLayoff([], analyzeHand(__fixtureHands.knocker).melds);
      return {
        noMelds,
        empty,
        unchanged: JSON.stringify(hand) === before
      };
    })()`);
    expect(result.noMelds.deadwoodScore).toBe(13);
    expect(result.noMelds.deadwoodCards.map((card) => card.id).sort()).toEqual(['H6', 'H7']);
    expect(result.noMelds.laidOffCards).toEqual([]);
    expect(result.empty).toEqual({ deadwoodScore: 0, deadwoodCards: [], laidOffCards: [] });
    expect(result.unchanged).toBe(true);
  });

  it('does not invent layoffs from a defender whose entire hand is already melded', () => {
    const page = boot();
    const fixture = {
      ...HIGH,
      defender: ['C1', 'C2', 'C3', 'S4', 'S5', 'S6', 'S7', 'C11', 'D11', 'H11'],
      laidOff: [],
      before: 0,
      after: 0
    };
    checkLayoff(page, fixture);
  });
});

function prepareRound(page, fixture, humanKnocker = true) {
  page.w.__fixtureHands = fixtureHands(fixture);
  page.w.__humanKnocker = humanKnocker;
  page.w.eval(`(() => {
    closeGuide();
    clearAiTurnTimeout();
    state.round = 1;
    state.turn = __humanKnocker ? 'player' : 'ai';
    state.phase = __humanKnocker ? 'discard' : 'draw';
    state.roundOver = false;
    state.matchOver = false;
    state.initialized = true;
    state.playerScore = 0;
    state.aiScore = 0;
    state.lastAiAction = '';
    state.roundSummary = '';
    state.stats = {
      roundsPlayed: 0, playerRoundWins: 0, aiRoundWins: 0,
      playerGins: 0, aiGins: 0, undercuts: 0
    };
    const extraDiscard = { id: 'C13', suit: 'C', rank: 13 };
    state.playerHand = (__humanKnocker ? __fixtureHands.knocker : __fixtureHands.defender).slice();
    state.aiHand = (__humanKnocker ? __fixtureHands.defender : __fixtureHands.knocker).slice();
    if (__humanKnocker) state.playerHand.push(extraDiscard);
    const used = new Set([...state.playerHand, ...state.aiHand].map(card => card.id));
    // Use short, deterministic fixture identities consistently in every pile;
    // the page's physical suit/rank deck and all gameplay functions stay real.
    state.stock = createDeck().map(card => ({ ...card, id: card.suit + String(card.rank) }))
      .filter(card => !used.has(card.id));
    // The exposed King cannot improve these melds; the AI draws the other
    // harmless King from stock and chooses its own discard through aiTurn().
    const upIndex = state.stock.findIndex(card => card.id === 'S13');
    state.discard = [state.stock.splice(upIndex, 1)[0]];
    if (!__humanKnocker) {
      const drawnIndex = state.stock.findIndex(card => card.id === extraDiscard.id);
      state.stock.push(state.stock.splice(drawnIndex, 1)[0]);
    }
    state.selectedCardId = __humanKnocker ? extraDiscard.id : null;
    state.drawnCardId = __humanKnocker ? extraDiscard.id : null;
    state.drawnCardSource = __humanKnocker ? 'stock' : null;
    renderAll();
  })()`);
  expect(page.value('state.playerHand.length')).toBe(humanKnocker ? 11 : 10);
  expect(page.value('state.aiHand.length')).toBe(10);
  assertPhysicalDeck(page);
}

function assertPhysicalDeck(page) {
  const ids = page.value('[...state.playerHand, ...state.aiHand, ...state.stock, ...state.discard].map(card => card.id)');
  const physical = page.value('[...state.playerHand, ...state.aiHand, ...state.stock, ...state.discard].map(card => card.suit + card.rank)');
  expect(ids).toHaveLength(52);
  expect(new Set(ids).size).toBe(52);
  expect(new Set(physical).size).toBe(52);
}

function roundReceipt(page) {
  return page.value(`({
    player: state.playerScore, ai: state.aiScore, over: state.roundOver,
    summary: state.roundSummary, stats: state.stats,
    playerDisplay: el.playerScoreValue.textContent,
    aiDisplay: el.aiScoreValue.textContent,
    message: el.messageBox.textContent,
    discard: state.discard[state.discard.length - 1].id,
    playerHandCount: state.playerHand.length, aiHandCount: state.aiHand.length
  })`);
}

describe('live TurdRummy round scoring after layoffs', () => {
  it('the human Knock button awards the defending AI its real undercut, not a false loss', () => {
    const page = boot();
    prepareRound(page, HIGH);
    const button = page.w.document.getElementById('knockBtn');
    expect(button.disabled).toBe(false);
    button.click();
    const receipt = roundReceipt(page);
    expect(receipt.player).toBe(0);
    expect(receipt.ai).toBe(26);
    expect(receipt.playerDisplay).toBe('0');
    expect(receipt.aiDisplay).toBe('26');
    expect(receipt.over).toBe(true);
    expect(receipt.summary).toContain('Undercut! AI gain +26.');
    expect(receipt.message).toContain('defender deadwood: 0');
    expect(receipt.summary).toContain('6♥');
    expect(receipt.summary).toContain('7♥');
    expect(receipt.stats.undercuts).toBe(1);
    expect(receipt.stats.aiRoundWins).toBe(1);
    expect(receipt.stats.playerRoundWins).toBe(0);
    expect(receipt.stats.roundsPlayed).toBe(1);
    expect(receipt.discard).toBe('C13');
    expect(receipt.playerHandCount).toBe(10);
    expect(receipt.aiHandCount).toBe(10);
    assertPhysicalDeck(page);
  });

  it('an actual AI draw/discard/knock awards the human defender the same correct undercut', () => {
    const page = boot();
    prepareRound(page, HIGH, false);
    page.w.aiTurn();
    const receipt = roundReceipt(page);
    expect(receipt.player).toBe(26);
    expect(receipt.ai).toBe(0);
    expect(receipt.playerDisplay).toBe('26');
    expect(receipt.aiDisplay).toBe('0');
    expect(receipt.over).toBe(true);
    expect(receipt.summary).toContain('Undercut! You gain +26.');
    expect(receipt.summary).toContain('defender deadwood: 0');
    expect(receipt.stats.undercuts).toBe(1);
    expect(receipt.stats.playerRoundWins).toBe(1);
    expect(receipt.stats.aiRoundWins).toBe(0);
    expect(receipt.stats.roundsPlayed).toBe(1);
    expect(receipt.discard).toBe('C13');
    expect(receipt.playerHandCount).toBe(10);
    expect(receipt.aiHandCount).toBe(10);
    assertPhysicalDeck(page);
  });

  it.each([true, false])('Gin does not allow defender layoffs (human knocker: %s)', (humanKnocker) => {
    const page = boot();
    prepareRound(page, GIN, humanKnocker);
    if (humanKnocker) {
      const button = page.w.document.getElementById('ginBtn');
      expect(button.disabled).toBe(false);
      button.click();
    } else {
      page.w.aiTurn();
    }
    const receipt = roundReceipt(page);
    expect(receipt.player).toBe(humanKnocker ? 38 : 0);
    expect(receipt.ai).toBe(humanKnocker ? 0 : 38);
    expect(receipt.over).toBe(true);
    expect(receipt.summary).toContain('called GIN! +38.');
    expect(receipt.summary).toContain('defender deadwood: 13');
    expect(receipt.summary).not.toContain('Layoff:');
    expect(receipt.stats.undercuts).toBe(0);
    expect(receipt.stats.playerGins).toBe(humanKnocker ? 1 : 0);
    expect(receipt.stats.aiGins).toBe(humanKnocker ? 0 : 1);
    expect(receipt.stats.roundsPlayed).toBe(1);
    assertPhysicalDeck(page);
  });
});
