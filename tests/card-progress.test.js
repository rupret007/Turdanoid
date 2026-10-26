// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';
import { validEightsSnapshot, validRummySnapshot } from './continue-fixtures.js';

const root = resolve(import.meta.dirname, '..');
const pages = [];
const source = file => readFileSync(resolve(root, file), 'utf8');

// These are explicitly staged integration fixtures, not natural-session evidence.
// They execute the actual page settlement code, real Continue validator/runtime,
// real progress ledger and real sharing UI without a network or canvas backend.
function boot(game, stored = {}) {
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error.message));
  const html = source(`${game}.html`);
  const extras = [...html.matchAll(/<script src="(games\/(?:crapeights-[^"]+|turdrummy-[^"]+)\.js)"/g)].map(match => match[1]);
  let difficulty = 'normal';
  const listeners = [];
  const dom = new JSDOM(html, {
    url: `http://localhost/${game}.html`, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: console,
    beforeParse(w) {
      w.__TURDJACK_SKIP_KIT__ = true;
      w.__SUITE_SKIP_MODULES = true;
      w.setTimeout = () => 1; w.clearTimeout = () => {};
      w.setInterval = () => 1; w.clearInterval = () => {};
      w.requestAnimationFrame = () => 1; w.cancelAnimationFrame = () => {};
      w.confirm = () => true;
      w.matchMedia = query => ({ matches: query.includes('reduce'), addEventListener() {}, removeEventListener() {} });
      w.HTMLElement.prototype.scrollIntoView = () => {};
      w.HTMLCanvasElement.prototype.getContext = () => null;
      w.HTMLCanvasElement.prototype.toBlob = callback => callback(null);
      for (const [key, value] of Object.entries(stored)) { w.localStorage.setItem(key, value); }
      w.localStorage.setItem('turdsuite_muted', '1');
      w.eval(source('games/table-continue-core.js'));
      const core = w.TurdSuiteTableContinue;
      w.Suite = {
        table: {
          remember: (page, snapshot) => core.rememberContinue(w.localStorage, page, snapshot),
          load: page => core.loadContinue(w.localStorage, page),
          clear: page => core.clearContinue(w.localStorage, page)
        },
        guide: { hasSeen: () => true, mark() {} }, toast() {}, isMuted: () => true,
        difficulty: { get: () => difficulty, tuning: () => ({ speed: 1, lives: 0, spawn: 1 }),
          set(value) { difficulty = value; listeners.forEach(fn => fn(value)); }, onChange: fn => listeners.push(fn) }
      };
      for (const file of ['games/suite-progress-core.js', 'assets/suite-progress.js', 'assets/suite-share.js', ...extras]) { w.eval(source(file)); }
    }
  });
  pages.push({ dom, errors });
  const w = dom.window;
  return { w, errors, run: code => w.eval(code),
    json: expression => JSON.parse(w.eval(`JSON.stringify(${expression})`)),
    ledger: () => w.SuiteProgress.snapshot(),
    storage: () => Object.fromEntries(Array.from({ length: w.localStorage.length }, (_, i) => {
      const key = w.localStorage.key(i); return [key, w.localStorage.getItem(key)];
    })),
    saved: () => w.Suite.table.load(`${game}.html`),
    shareVisible: () => !w.document.querySelector('.suite-result-share').hidden
  };
}

afterEach(() => {
  for (const { dom, errors } of pages.splice(0)) { dom.window.close(); expect(errors).toEqual([]); }
});

function continuation(game, snapshot) {
  return { turdsuite_continue_v1: JSON.stringify({ v: 1, games: { [`${game}.html`]: { updatedAt: 1, snapshot } } }) };
}

function finishEightsFixture({ match = false } = {}) {
  const snap = validEightsSnapshot();
  snap.deck.push(...snap.players[0].hand.splice(1));
  for (const player of snap.players.slice(1)) { snap.deck.push(...player.hand.splice(1)); }
  snap.players.forEach(player => { player.score = 0; });
  snap.players[0].score = match ? 199 : 0;
  snap.currentPlayer = 0; snap.activeSuit = snap.players[0].hand[0].suit;
  snap.pendingDrawCards = 0; snap.pendingSkips = 0; snap.pendingWildCard = null;
  snap.selectedCardId = snap.players[0].hand[0].id;
  return snap;
}

function ginFixture() {
  const snap = validRummySnapshot();
  const all = ['C', 'D', 'H', 'S'].flatMap((suit, s) => Array.from({ length: 13 }, (_, i) => ({ suit, rank: i + 1, id: `${suit}${i + 1}-${s * 13 + i}` })));
  const wanted = new Set(['C1', 'C2', 'C3', 'D4', 'D5', 'D6', 'H7', 'H8', 'H9', 'H10', 'S13']);
  snap.playerHand = all.filter(card => wanted.has(card.suit + card.rank));
  const rest = all.filter(card => !wanted.has(card.suit + card.rank));
  snap.aiHand = rest.splice(0, 10); snap.discard = rest.splice(0, 1); snap.stock = rest;
  snap.playerScore = 80; snap.aiScore = 0; snap.round = 1; snap.turn = 'player'; snap.phase = 'discard';
  snap.roundOver = false; snap.matchOver = false;
  snap.selectedCardId = 'S13-51'; snap.drawnCardId = 'S13-51'; snap.drawnCardSource = 'stock';
  return snap;
}

describe('card completed-result progress integrations', () => {
  it('records a natural Crapjack deal once, then a new deal uses a different identity', async () => {
    const game = boot('turdjack');
    game.run(`hideWelcomeGuide(); currentBet = 25; createShoe(4);
      const opening = [['A','S'],['9','C'],['K','H'],['7','D']].map(([rank,suit]) => shoe.splice(shoe.findIndex(c => c.rank === rank && c.suit === suit),1)[0]);
      shoe.push(...opening.reverse());`);
    expect(game.shareVisible()).toBe(false);
    await game.run('startRound()');
    const first = game.ledger().history.turdjack;
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ kind: 'hand', outcome: 'win', natural: true, net: 38, hands: 1, wager: 25 });
    expect(game.ledger().earned['jack-natural']).toBeDefined();
    expect(game.shareVisible()).toBe(true);
    game.run('publishCardProgress(); publishCardProgress();');
    expect(game.ledger().history.turdjack).toHaveLength(1);
    game.run(`createShoe(4); {
      const next=[['10','S'],['9','C'],['7','H'],['8','D']].map(([rank,suit])=>shoe.splice(shoe.findIndex(c=>c.rank===rank&&c.suit===suit),1)[0]); shoe.push(...next.reverse()); }`);
    await game.run('startRound()');
    expect(game.json('progressMeta.id')).not.toBe(first[0].id);
    if (game.json('roundActive')) {
      expect(game.shareVisible()).toBe(false);
      game.run('playerStand()');
    }
    expect(game.ledger().history.turdjack).toHaveLength(2);
    await game.run('askJackConfirm=async()=>true;resetBankroll()');
    expect(game.json('stats.hands')).toBe(0);
    expect(game.ledger().history.turdjack).toHaveLength(2);
    expect(game.shareVisible()).toBe(false);
  });

  it('preserves the Crapjack in-flight identity through the real Continue store and caps deal history at10', async () => {
    let game = boot('turdjack');
    game.run(`hideWelcomeGuide(); currentBet=25; createShoe(4);
      const opening=[['10','S'],['9','C'],['7','H'],['8','D']].map(([rank,suit])=>shoe.splice(shoe.findIndex(c=>c.rank===rank&&c.suit===suit),1)[0]);shoe.push(...opening.reverse());`);
    await game.run('startRound()');
    const id = game.saved().progressMeta.id;
    expect(game.ledger().history.turdjack).toBeUndefined();
    game = boot('turdjack', game.storage());
    expect(game.json('progressMeta.id')).toBe(id);
    game.run('playerStand()');
    expect(game.ledger().history.turdjack[0]).toMatchObject({ id, net: 0, outcome: 'draw' });
    for (let i = 0; i < 11; i++) {
      await game.run(`{ currentBet=25; createShoe(4);
        const opening=[['10','S'],['9','C'],['7','H'],['8','D']].map(([rank,suit])=>shoe.splice(shoe.findIndex(c=>c.rank===rank&&c.suit===suit),1)[0]);
        shoe.push(...opening.reverse()); } startRound()`);
      if (game.json('roundActive')) { game.run('playerStand()'); }
    }
    expect(game.ledger().history.turdjack).toHaveLength(10);
  });

  it('keeps a split deal as one mixed settlement and counts an insurance premium in net and wager', async () => {
    const split = boot('turdjack');
    split.run(`hideWelcomeGuide();currentBet=25;createShoe(4);
      const opening=[['10','S'],['9','C'],['10','H'],['10','D'],['8','C'],['A','S']].map(([rank,suit])=>shoe.splice(shoe.findIndex(c=>c.rank===rank&&c.suit===suit),1)[0]);shoe.push(...opening.reverse());`);
    await split.run('startRound()');
    split.run('playerSplit();playerStand();playerStand()');
    expect(split.ledger().history.turdjack).toHaveLength(1);
    expect(split.ledger().history.turdjack[0]).toMatchObject({ kind: 'hand', hands: 2, wins: 1, losses: 1, net: 0, wager: 50, outcome: 'draw', natural: false });
    expect(split.ledger().earned['jack-win']).toBeUndefined();
    const splitReload = boot('turdjack', split.storage());
    expect(splitReload.ledger().history.turdjack).toHaveLength(1);
    expect(splitReload.ledger().earned['jack-win']).toBeUndefined();

    const insured = boot('turdjack');
    insured.run(`hideWelcomeGuide();askJackConfirm=async()=>true;currentBet=25;createShoe(4);
      const opening=[['10','S'],['A','C'],['7','H'],['K','D']].map(([rank,suit])=>shoe.splice(shoe.findIndex(c=>c.rank===rank&&c.suit===suit),1)[0]);shoe.push(...opening.reverse());`);
    await insured.run('startRound()');
    expect(insured.ledger().history.turdjack[0]).toMatchObject({ net: -1, wager: 37, outcome: 'loss', natural: false });
    expect(insured.ledger().earned['jack-win']).toBeUndefined();
  });

  it('credits a real Eights round without a match history/share result', () => {
    const game = boot('crapeights', continuation('crapeights', finishEightsFixture()));
    const id = game.saved().progressMeta.roundId;
    game.run('playCardById(0,players[0].hand[0].id,"C")');
    expect(game.ledger().earned['eights-round']).toMatchObject({ eventId: id });
    expect(game.ledger().history.crapeights).toBeUndefined();
    expect(game.shareVisible()).toBe(false);
    const resumed = boot('crapeights', game.storage());
    expect(resumed.saved().progressMeta.roundId).toBe(id);
    expect(resumed.ledger().history.crapeights).toBeUndefined();
  });

  it('records a full Eights match once across reload and retains it after New Match', () => {
    let game = boot('crapeights', continuation('crapeights', finishEightsFixture({ match: true })));
    const matchId = game.saved().progressMeta.id;
    game.run('playCardById(0,players[0].hand[0].id,"C")');
    expect(game.ledger().history.crapeights).toHaveLength(1);
    expect(game.ledger().history.crapeights[0]).toMatchObject({ id: matchId, kind: 'match', target: 200, matchWon: true });
    expect(game.shareVisible()).toBe(true);
    game = boot('crapeights', game.storage());
    expect(game.ledger().history.crapeights).toHaveLength(1);
    game.run('startFreshMatch()');
    expect(game.saved().progressMeta.id).not.toBe(matchId);
    expect(game.ledger().history.crapeights).toHaveLength(1);
    expect(game.shareVisible()).toBe(false);
  });

  it('credits human Gin and a full Rummy match, with stable reload and independent Rematch history', () => {
    let game = boot('turdrummy', continuation('turdrummy', ginFixture()));
    game.run('closeGuide(); playerKnockOrGin(true)');
    expect(game.ledger().earned['rummy-gin']).toBeDefined();
    expect(game.ledger().history.turdrummy).toHaveLength(1);
    const result = game.ledger().history.turdrummy[0];
    expect(result).toMatchObject({ kind: 'match', target: 100, outcome: 'win', matchWon: true });
    game = boot('turdrummy', game.storage());
    expect(game.ledger().history.turdrummy).toHaveLength(1);
    expect(game.shareVisible()).toBe(true);
    game.run('resetMatch(); startFirstRoundIfNeeded()');
    expect(game.saved().progressMeta.id).not.toBe(result.id);
    expect(game.ledger().history.turdrummy).toHaveLength(1);
    expect(game.shareVisible()).toBe(false);
  });

  it('credits the made You+North contract even when the other team earns more round points', () => {
    const game = boot('turdspades');
    game.run(`state.playedThisRound=state.hands.flat();state.hands=[[],[],[],[]];state.trick=[];
      state.bids=[2,3,4,4];state.tricks=[4,4,2,3];scoreRound('fixture final trick');render();`);
    expect(game.json('progressMeta.pending[0]')).toMatchObject({ kind: 'round', history: false, team: 'you-north', bid: 6, tricks: 6, roundWon: false });
    expect(game.ledger().earned['spades-contract']).toBeDefined();
    expect(game.ledger().history.turdspades).toBeUndefined();
    expect(game.shareVisible()).toBe(false);
    const id = game.saved().progressMeta.roundId;
    const resumed = boot('turdspades', game.storage());
    expect(resumed.saved().progressMeta.roundId).toBe(id);
    expect(resumed.ledger().history.turdspades).toBeUndefined();
  });

  it('records a full Spades match with signed scores, then preserves its history on New Match', () => {
    const game = boot('turdspades');
    game.run(`state.playedThisRound=state.hands.flat();state.hands=[[],[],[],[]];state.trick=[];
      state.scores=[200,-100];state.bids=[2,3,4,4];state.tricks=[4,4,2,3];scoreRound('fixture final trick');render();`);
    const result = game.ledger().history.turdspades[0];
    expect(result).toMatchObject({ kind: 'match', target: 250, playerScore: 260, opponentScore: -30, outcome: 'win' });
    expect(game.shareVisible()).toBe(true);
    const resumed = boot('turdspades', game.storage());
    expect(resumed.ledger().history.turdspades).toHaveLength(1);
    resumed.run('startMatch()');
    expect(resumed.saved().progressMeta.id).not.toBe(result.id);
    expect(resumed.ledger().history.turdspades).toHaveLength(1);
  });

  it('does not fabricate history from a completed legacy Eights snapshot', () => {
    const snap = finishEightsFixture({ match: true });
    snap.deck.push(...snap.players[0].hand); snap.players[0].hand = []; snap.players[0].score = 220;
    snap.roundActive = false;
    snap.overlay = { title: 'Match over', summary: 'Completed legacy match.', matchFinished: true, tone: 'match-win', flavor: 'Saved table.', kicker: 'Crown' };
    const game = boot('crapeights', continuation('crapeights', snap));
    expect(game.ledger().history.crapeights).toBeUndefined();
    expect(game.saved().progressMeta).toBeUndefined();
    expect(game.shareVisible()).toBe(false);
  });

  it.each(['crapeights', 'turdrummy', 'turdspades'])('keeps %s mixed after strength returns to its starting value, including Continue', gameName => {
    const game = gameName === 'crapeights'
      ? boot(gameName, continuation(gameName, finishEightsFixture({ match: true })))
      : gameName === 'turdrummy' ? boot(gameName, continuation(gameName, ginFixture())) : boot(gameName);
    // This fixture represents a new-feature match that started on Normal.
    game.run('progressMeta.difficulty="normal";Suite.difficulty.set("normal")');
    expect(game.json('progressMeta.difficulty')).toBe('normal');
    game.run('Suite.difficulty.set("hard");Suite.difficulty.set("normal")');
    expect(game.json('progressMeta.difficulty')).toBe('mixed');
    expect(game.saved().progressMeta.difficulty).toBe('mixed');
    const resumed = boot(gameName, game.storage());
    expect(resumed.json('progressMeta.difficulty')).toBe('mixed');
    if (gameName === 'crapeights') { resumed.run('playCardById(0,players[0].hand[0].id,"C")'); }
    else if (gameName === 'turdrummy') { resumed.run('closeGuide();playerKnockOrGin(true)'); }
    else { resumed.run(`state.playedThisRound=state.hands.flat();state.hands=[[],[],[],[]];state.trick=[];
      state.scores=[200,0];state.bids=[2,3,4,4];state.tricks=[4,4,2,3];scoreRound('fixture final trick');render();`); }
    expect(resumed.ledger().history[gameName][0].difficulty).toBe('mixed');
  });

  it.each(['turdrummy', 'turdspades'])('does not fabricate %s history when an old completed snapshot has no result identity', gameName => {
    const finished = gameName === 'turdrummy'
      ? boot(gameName, continuation(gameName, ginFixture())) : boot(gameName);
    if (gameName === 'turdrummy') { finished.run('closeGuide();playerKnockOrGin(true)'); }
    else {
      finished.run(`state.playedThisRound=state.hands.flat();state.hands=[[],[],[],[]];state.trick=[];
        state.scores=[200,0];state.bids=[2,3,4,4];state.tricks=[4,4,2,3];scoreRound('fixture final trick');render();`);
    }
    const stored = finished.storage();
    const saved = JSON.parse(stored.turdsuite_continue_v1);
    delete saved.games[`${gameName}.html`].snapshot.progressMeta;
    stored.turdsuite_continue_v1 = JSON.stringify(saved);
    delete stored.arcade_progress_v1;
    const legacy = boot(gameName, stored);
    expect(legacy.ledger().history[gameName]).toBeUndefined();
    expect(legacy.saved().progressMeta).toBeUndefined();
    expect(legacy.shareVisible()).toBe(false);
  });
});
