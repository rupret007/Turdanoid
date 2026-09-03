export const CONTINUE_KEY = 'turdsuite_continue_v1';
export const GUIDE_SEEN_KEY = 'turdsuite_guides_seen_v1';
export const CONTINUE_VERSION = 1;
export const CONTINUE_MAX_BYTES = 48 * 1024;

export const LIVE_HUB_GAMES = [
  'TurdAnoid.html',
  'turdtris.html',
  'turdjack.html',
  'crapeights.html',
  'turdrummy.html',
  'turdspades.html'
];

export const TABLE_CONTINUE_GAMES = ['crapeights.html', 'turdrummy.html', 'turdspades.html'];

const KIND_BY_PAGE = {
  'crapeights.html': 'crapeights',
  'turdrummy.html': 'turdrummy',
  'turdspades.html': 'turdspades'
};

const SPADE_SUITS = new Set(['C', 'D', 'H', 'S']);
const EIGHTS_RANKS = new Set(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
const SPADE_PHASES = new Set(['bidding', 'play', 'roundEnd', 'matchEnd']);
const RUMMY_PHASES = new Set(['draw', 'discard']);
const RUMMY_SEATS = new Set(['player', 'ai']);
const NAME_RE = /^[A-Za-z][A-Za-z .'-]{0,23}$/;

export function kindForPage(page) {
  return KIND_BY_PAGE[page] || '';
}

export function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasDangerousKey(value) {
  return (
    Object.prototype.hasOwnProperty.call(value, '__proto__') ||
    Object.prototype.hasOwnProperty.call(value, 'constructor') ||
    Object.prototype.hasOwnProperty.call(value, 'prototype')
  );
}

export function finiteInt(value, min, max) {
  if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value)) {
    return null;
  }
  if (value < min || value > max) {
    return null;
  }
  return value;
}

export function cleanString(value, max) {
  if (typeof value !== 'string') {
    return null;
  }
  if (value.length > max) {
    return null;
  }
  if (/[<>]/.test(value)) {
    return null;
  }
  return value;
}

function cleanCardId(value) {
  const id = cleanString(value, 40);
  if (id === null || !id) {
    return null;
  }
  return id;
}

function cleanSpadeCard(card) {
  if (!isPlainObject(card) || hasDangerousKey(card)) {
    return null;
  }
  const id = cleanCardId(card.id);
  const suit = cleanString(card.suit, 1);
  const rank = finiteInt(card.rank, 2, 14);
  if (!id || !SPADE_SUITS.has(suit) || rank === null) {
    return null;
  }
  return { id, suit, rank };
}

function cleanRummyCard(card) {
  if (!isPlainObject(card) || hasDangerousKey(card)) {
    return null;
  }
  const id = cleanCardId(card.id);
  const suit = cleanString(card.suit, 1);
  const rank = finiteInt(card.rank, 1, 13);
  if (!id || !SPADE_SUITS.has(suit) || rank === null) {
    return null;
  }
  return { id, suit, rank };
}

function cleanEightsCard(card) {
  if (!isPlainObject(card) || hasDangerousKey(card)) {
    return null;
  }
  const id = finiteInt(card.id, 1, 100000);
  const suit = cleanString(card.suit, 1);
  const rank = cleanString(card.rank, 2);
  if (id === null || !SPADE_SUITS.has(suit) || !EIGHTS_RANKS.has(rank)) {
    return null;
  }
  return { id, suit, rank };
}

function uniqueCardKeys(cards, keyFn) {
  const seen = new Set();
  for (const card of cards) {
    const key = keyFn(card);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
  }
  return true;
}

function cleanCardList(list, cleaner, max) {
  if (!Array.isArray(list) || list.length > max) {
    return null;
  }
  const cards = [];
  for (const item of list) {
    const card = cleaner(item);
    if (!card) {
      return null;
    }
    cards.push(card);
  }
  return cards;
}

export function validateSpadesSnapshot(snapshot) {
  if (!isPlainObject(snapshot) || hasDangerousKey(snapshot)) {
    return null;
  }
  if (snapshot.kind !== 'turdspades' || snapshot.v !== CONTINUE_VERSION) {
    return null;
  }
  const phase = cleanString(snapshot.phase, 16);
  if (!SPADE_PHASES.has(phase)) {
    return null;
  }
  const round = finiteInt(snapshot.round, 1, 200);
  const dealer = finiteInt(snapshot.dealer, 0, 3);
  const leader = finiteInt(snapshot.leader, 0, 3);
  const currentPlayer = finiteInt(snapshot.currentPlayer, 0, 3);
  const bidTurn = finiteInt(snapshot.bidTurn, 0, 3);
  const bidChoice = finiteInt(snapshot.bidChoice, 0, 13);
  if (
    round === null ||
    dealer === null ||
    leader === null ||
    currentPlayer === null ||
    bidTurn === null ||
    bidChoice === null
  ) {
    return null;
  }
  if (!Array.isArray(snapshot.scores) || snapshot.scores.length !== 2) {
    return null;
  }
  if (!Array.isArray(snapshot.bags) || snapshot.bags.length !== 2) {
    return null;
  }
  const scores = snapshot.scores.map((score) => finiteInt(score, -5000, 5000));
  const bags = snapshot.bags.map((bag) => finiteInt(bag, 0, 30));
  if (scores.includes(null) || bags.includes(null)) {
    return null;
  }
  if (!Array.isArray(snapshot.bids) || snapshot.bids.length !== 4) {
    return null;
  }
  const bids = snapshot.bids.map((bid) => {
    if (bid === null) {
      return null;
    }
    return finiteInt(bid, 0, 13);
  });
  if (bids.some((bid, index) => snapshot.bids[index] !== null && bid === null)) {
    return null;
  }
  if (!Array.isArray(snapshot.tricks) || snapshot.tricks.length !== 4) {
    return null;
  }
  const tricks = snapshot.tricks.map((trick) => finiteInt(trick, 0, 13));
  if (tricks.includes(null)) {
    return null;
  }
  if (!Array.isArray(snapshot.hands) || snapshot.hands.length !== 4) {
    return null;
  }
  const hands = snapshot.hands.map((hand) => cleanCardList(hand, cleanSpadeCard, 13));
  if (hands.includes(null)) {
    return null;
  }
  if (!Array.isArray(snapshot.trick) || snapshot.trick.length > 4) {
    return null;
  }
  const trick = [];
  for (const entry of snapshot.trick) {
    if (!isPlainObject(entry) || hasDangerousKey(entry)) {
      return null;
    }
    const player = finiteInt(entry.player, 0, 3);
    const card = cleanSpadeCard(entry.card);
    if (player === null || !card) {
      return null;
    }
    trick.push({ player, card });
  }
  const allCards = hands.flat().concat(trick.map((entry) => entry.card));
  if (allCards.length > 52) {
    return null;
  }
  if (!uniqueCardKeys(allCards, (card) => `${card.suit}:${card.rank}`)) {
    return null;
  }
  if (!uniqueCardKeys(allCards, (card) => card.id)) {
    return null;
  }
  const selected = snapshot.selected === null ? null : cleanCardId(snapshot.selected);
  if (snapshot.selected !== null && !selected) {
    return null;
  }
  const sortMode = cleanString(snapshot.sortMode, 8);
  if (sortMode !== 'suit' && sortMode !== 'rank') {
    return null;
  }
  const msg = cleanString(snapshot.msg, 500);
  const summary = cleanString(snapshot.summary, 800);
  const lastRoundTone = cleanString(snapshot.lastRoundTone, 16);
  if (msg === null || summary === null) {
    return null;
  }
  if (!['neutral', 'victory', 'defeat', 'draw'].includes(lastRoundTone)) {
    return null;
  }
  const spadesBroken = snapshot.spadesBroken === true;
  return {
    kind: 'turdspades',
    v: CONTINUE_VERSION,
    round,
    dealer,
    leader,
    currentPlayer,
    bidTurn,
    phase,
    scores,
    bags,
    bids,
    tricks,
    hands,
    trick,
    spadesBroken,
    selected,
    bidChoice,
    sortMode,
    msg,
    summary,
    lastRoundTone
  };
}

export function validateRummySnapshot(snapshot) {
  if (!isPlainObject(snapshot) || hasDangerousKey(snapshot)) {
    return null;
  }
  if (snapshot.kind !== 'turdrummy' || snapshot.v !== CONTINUE_VERSION) {
    return null;
  }
  const phase = cleanString(snapshot.phase, 16);
  const turn = cleanString(snapshot.turn, 8);
  const dealer = cleanString(snapshot.dealer, 8);
  if (!RUMMY_PHASES.has(phase) || !RUMMY_SEATS.has(turn) || !RUMMY_SEATS.has(dealer)) {
    return null;
  }
  const round = finiteInt(snapshot.round, 0, 200);
  const playerScore = finiteInt(snapshot.playerScore, 0, 5000);
  const aiScore = finiteInt(snapshot.aiScore, 0, 5000);
  if (round === null || playerScore === null || aiScore === null) {
    return null;
  }
  const stock = cleanCardList(snapshot.stock, cleanRummyCard, 52);
  const discard = cleanCardList(snapshot.discard, cleanRummyCard, 52);
  const playerHand = cleanCardList(snapshot.playerHand, cleanRummyCard, 12);
  const aiHand = cleanCardList(snapshot.aiHand, cleanRummyCard, 12);
  if (!stock || !discard || !playerHand || !aiHand) {
    return null;
  }
  const allCards = stock.concat(discard, playerHand, aiHand);
  if (allCards.length > 52) {
    return null;
  }
  if (!uniqueCardKeys(allCards, (card) => `${card.suit}:${card.rank}`)) {
    return null;
  }
  if (!uniqueCardKeys(allCards, (card) => card.id)) {
    return null;
  }
  if (snapshot.initialized && allCards.length !== 52) {
    return null;
  }
  const selectedCardId =
    snapshot.selectedCardId === null ? null : cleanCardId(snapshot.selectedCardId);
  const drawnCardId = snapshot.drawnCardId === null ? null : cleanCardId(snapshot.drawnCardId);
  if (snapshot.selectedCardId !== null && !selectedCardId) {
    return null;
  }
  if (snapshot.drawnCardId !== null && !drawnCardId) {
    return null;
  }
  const drawnCardSource =
    snapshot.drawnCardSource === null ? null : cleanString(snapshot.drawnCardSource, 16);
  if (
    snapshot.drawnCardSource !== null &&
    drawnCardSource !== 'stock' &&
    drawnCardSource !== 'discard'
  ) {
    return null;
  }
  const playerSortMode = cleanString(snapshot.playerSortMode, 8);
  if (playerSortMode !== 'suit' && playerSortMode !== 'rank') {
    return null;
  }
  const message = cleanString(snapshot.message, 500);
  const roundSummary = cleanString(snapshot.roundSummary, 800);
  const lastAiAction = cleanString(snapshot.lastAiAction, 240);
  if (message === null || roundSummary === null || lastAiAction === null) {
    return null;
  }
  if (typeof snapshot.roundOver !== 'boolean' || typeof snapshot.matchOver !== 'boolean') {
    return null;
  }
  if (typeof snapshot.initialized !== 'boolean' || !snapshot.initialized) {
    return null;
  }
  return {
    kind: 'turdrummy',
    v: CONTINUE_VERSION,
    round,
    dealer,
    turn,
    phase,
    playerScore,
    aiScore,
    stock,
    discard,
    playerHand,
    aiHand,
    selectedCardId,
    drawnCardId,
    drawnCardSource,
    playerSortMode,
    message,
    roundSummary,
    lastAiAction,
    roundOver: snapshot.roundOver,
    matchOver: snapshot.matchOver,
    initialized: true
  };
}

export function validateEightsSnapshot(snapshot) {
  if (!isPlainObject(snapshot) || hasDangerousKey(snapshot)) {
    return null;
  }
  if (snapshot.kind !== 'crapeights' || snapshot.v !== CONTINUE_VERSION) {
    return null;
  }
  if (!Array.isArray(snapshot.players) || snapshot.players.length !== 4) {
    return null;
  }
  const players = [];
  for (let i = 0; i < snapshot.players.length; i += 1) {
    const player = snapshot.players[i];
    if (!isPlainObject(player) || hasDangerousKey(player)) {
      return null;
    }
    const name = cleanString(player.name, 24);
    if (!name || !NAME_RE.test(name)) {
      return null;
    }
    if (i === 0 && (player.human !== true || name !== 'You')) {
      return null;
    }
    if (i > 0 && player.human !== false) {
      return null;
    }
    const score = finiteInt(player.score, 0, 5000);
    const hand = cleanCardList(player.hand, cleanEightsCard, 52);
    if (score === null || !hand) {
      return null;
    }
    players.push({ name, human: i === 0, hand, score });
  }
  const deck = cleanCardList(snapshot.deck, cleanEightsCard, 52);
  const discard = cleanCardList(snapshot.discard, cleanEightsCard, 52);
  if (!deck || !discard) {
    return null;
  }
  const allCards = players.flatMap((player) => player.hand).concat(deck, discard);
  if (allCards.length > 52 || allCards.length < 1) {
    return null;
  }
  if (!uniqueCardKeys(allCards, (card) => `${card.suit}:${card.rank}`)) {
    return null;
  }
  if (!uniqueCardKeys(allCards, (card) => String(card.id))) {
    return null;
  }
  const roundNumber = finiteInt(snapshot.roundNumber, 1, 200);
  const currentPlayer = finiteInt(snapshot.currentPlayer, 0, 3);
  const direction = snapshot.direction === -1 ? -1 : snapshot.direction === 1 ? 1 : null;
  const activeSuit = cleanString(snapshot.activeSuit, 1);
  const pendingDrawCards = finiteInt(snapshot.pendingDrawCards, 0, 40);
  const pendingSkips = finiteInt(snapshot.pendingSkips, 0, 12);
  const nextCardId = finiteInt(snapshot.nextCardId, 1, 100000);
  if (
    roundNumber === null ||
    currentPlayer === null ||
    direction === null ||
    !SPADE_SUITS.has(activeSuit) ||
    pendingDrawCards === null ||
    pendingSkips === null ||
    nextCardId === null
  ) {
    return null;
  }
  if (typeof snapshot.roundActive !== 'boolean' || typeof snapshot.hasDrawnThisTurn !== 'boolean') {
    return null;
  }
  const selectedCardId =
    snapshot.selectedCardId === null ? null : finiteInt(snapshot.selectedCardId, 1, 100000);
  if (snapshot.selectedCardId !== null && selectedCardId === null) {
    return null;
  }
  let pendingWildCard = null;
  if (snapshot.pendingWildCard !== null && snapshot.pendingWildCard !== undefined) {
    pendingWildCard = cleanEightsCard(snapshot.pendingWildCard);
    if (!pendingWildCard) {
      return null;
    }
  }
  if (!Array.isArray(snapshot.historyLog) || snapshot.historyLog.length > 16) {
    return null;
  }
  const historyLog = [];
  for (const line of snapshot.historyLog) {
    const clean = cleanString(line, 180);
    if (clean === null) {
      return null;
    }
    historyLog.push(clean);
  }
  let overlay = null;
  if (snapshot.overlay) {
    if (!isPlainObject(snapshot.overlay) || hasDangerousKey(snapshot.overlay)) {
      return null;
    }
    const title = cleanString(snapshot.overlay.title, 80);
    const summary = cleanString(snapshot.overlay.summary, 240);
    const tone = cleanString(snapshot.overlay.tone, 20);
    const flavor = cleanString(snapshot.overlay.flavor, 200);
    const kicker = cleanString(snapshot.overlay.kicker, 40);
    if (!title || !summary || !tone || flavor === null || kicker === null) {
      return null;
    }
    if (typeof snapshot.overlay.matchFinished !== 'boolean') {
      return null;
    }
    overlay = {
      title,
      summary,
      matchFinished: snapshot.overlay.matchFinished,
      tone,
      flavor,
      kicker
    };
  }
  return {
    kind: 'crapeights',
    v: CONTINUE_VERSION,
    players,
    deck,
    discard,
    roundNumber,
    currentPlayer,
    direction,
    activeSuit,
    pendingDrawCards,
    pendingSkips,
    roundActive: snapshot.roundActive,
    hasDrawnThisTurn: snapshot.hasDrawnThisTurn,
    selectedCardId,
    pendingWildCard,
    historyLog,
    nextCardId,
    overlay
  };
}

export function validateSnapshot(page, snapshot) {
  if (!TABLE_CONTINUE_GAMES.includes(page)) {
    return null;
  }
  if (!isPlainObject(snapshot) || snapshot.kind !== kindForPage(page)) {
    return null;
  }
  if (page === 'turdspades.html') {
    return validateSpadesSnapshot(snapshot);
  }
  if (page === 'turdrummy.html') {
    return validateRummySnapshot(snapshot);
  }
  return validateEightsSnapshot(snapshot);
}

function emptyStore() {
  return { v: CONTINUE_VERSION, games: {} };
}

export function parseContinueStore(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > CONTINUE_MAX_BYTES) {
    return emptyStore();
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyStore();
  }
  if (!isPlainObject(parsed) || hasDangerousKey(parsed) || parsed.v !== CONTINUE_VERSION) {
    return emptyStore();
  }
  if (!isPlainObject(parsed.games) || hasDangerousKey(parsed.games)) {
    return emptyStore();
  }
  const games = {};
  for (const page of TABLE_CONTINUE_GAMES) {
    const entry = parsed.games[page];
    if (!isPlainObject(entry) || hasDangerousKey(entry) || !isPlainObject(entry.snapshot)) {
      continue;
    }
    const snapshot = validateSnapshot(page, entry.snapshot);
    if (!snapshot) {
      continue;
    }
    games[page] = {
      updatedAt: finiteInt(entry.updatedAt, 0, Number.MAX_SAFE_INTEGER) || 0,
      snapshot
    };
  }
  return { v: CONTINUE_VERSION, games };
}

function readStore(storage) {
  let raw = '';
  try {
    raw = storage.getItem(CONTINUE_KEY) || '';
  } catch {
    return emptyStore();
  }
  return parseContinueStore(raw);
}

function writeStore(storage, store) {
  const payload = JSON.stringify(store);
  if (payload.length > CONTINUE_MAX_BYTES) {
    return false;
  }
  try {
    storage.setItem(CONTINUE_KEY, payload);
    return true;
  } catch {
    return false;
  }
}

export function rememberContinue(storage, page, snapshot) {
  const clean = validateSnapshot(page, snapshot);
  if (!clean) {
    return false;
  }
  const store = readStore(storage);
  store.games[page] = { updatedAt: Date.now(), snapshot: cloneJson(clean) };
  return writeStore(storage, store);
}

export function loadContinue(storage, page) {
  if (!TABLE_CONTINUE_GAMES.includes(page)) {
    return null;
  }
  const entry = readStore(storage).games[page];
  return entry ? cloneJson(entry.snapshot) : null;
}

export function clearContinue(storage, page) {
  if (!TABLE_CONTINUE_GAMES.includes(page)) {
    return false;
  }
  const store = readStore(storage);
  if (!store.games[page]) {
    return false;
  }
  delete store.games[page];
  return writeStore(storage, store);
}

export function listContinuePages(storage) {
  return Object.keys(readStore(storage).games);
}

export function hasContinue(storage, page) {
  return listContinuePages(storage).includes(page);
}

function readGuideStore(storage) {
  let raw = '';
  try {
    raw = storage.getItem(GUIDE_SEEN_KEY) || '';
  } catch {
    return {};
  }
  if (typeof raw !== 'string' || !raw || raw.length > 2000) {
    return {};
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!isPlainObject(parsed) || hasDangerousKey(parsed)) {
    return {};
  }
  const seen = {};
  for (const page of LIVE_HUB_GAMES) {
    if (parsed[page] === true) {
      seen[page] = true;
    }
  }
  return seen;
}

export function hasSeenGuide(storage, page) {
  if (!LIVE_HUB_GAMES.includes(page)) {
    return false;
  }
  return readGuideStore(storage)[page] === true;
}

export function markGuideSeen(storage, page) {
  if (!LIVE_HUB_GAMES.includes(page)) {
    return false;
  }
  const seen = readGuideStore(storage);
  seen[page] = true;
  try {
    storage.setItem(GUIDE_SEEN_KEY, JSON.stringify(seen));
    return true;
  } catch {
    return false;
  }
}
