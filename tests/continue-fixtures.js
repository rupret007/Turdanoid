export function spadeDeck() {
  const cards = [];
  let id = 0;
  for (const suit of ['C', 'D', 'H', 'S']) {
    for (let rank = 2; rank <= 14; rank += 1) {
      cards.push({ id: `${suit}${rank}-${id}`, suit, rank });
      id += 1;
    }
  }
  return cards;
}

export function rummyDeck() {
  const cards = [];
  let id = 0;
  for (const suit of ['C', 'D', 'H', 'S']) {
    for (let rank = 1; rank <= 13; rank += 1) {
      cards.push({ id: `${suit}${rank}-${id}`, suit, rank });
      id += 1;
    }
  }
  return cards;
}

export function eightsDeck() {
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const cards = [];
  let id = 1;
  for (const suit of ['C', 'D', 'H', 'S']) {
    for (const rank of ranks) {
      cards.push({ id, suit, rank });
      id += 1;
    }
  }
  return cards;
}

export function jackDeck(decks = 4) {
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const cards = [];
  for (let d = 0; d < decks; d += 1) {
    for (const suit of ['C', 'D', 'H', 'S']) {
      for (const rank of ranks) {
        cards.push({ rank, suit });
      }
    }
  }
  return cards;
}

export function validSpadesSnapshot() {
  const deck = spadeDeck();
  return {
    kind: 'turdspades',
    v: 1,
    round: 2,
    dealer: 0,
    leader: 1,
    currentPlayer: 0,
    bidTurn: 0,
    phase: 'play',
    scores: [40, 12],
    bags: [3, 1],
    bids: [4, 3, 4, 3],
    tricks: [1, 0, 0, 0],
    hands: [deck.slice(0, 12), deck.slice(12, 25), deck.slice(25, 38), deck.slice(38, 51)],
    trick: [{ player: 1, card: deck[51] }],
    spadesBroken: true,
    selected: deck[0].id,
    bidChoice: 4,
    sortMode: 'suit',
    msg: 'Your play.',
    summary: 'Race to 250.',
    lastRoundTone: 'neutral'
  };
}

export function validRummySnapshot() {
  const deck = rummyDeck();
  return {
    kind: 'turdrummy',
    v: 1,
    round: 3,
    dealer: 'player',
    turn: 'player',
    phase: 'draw',
    playerScore: 45,
    aiScore: 20,
    playerHand: deck.slice(0, 10),
    aiHand: deck.slice(10, 20),
    discard: deck.slice(20, 21),
    stock: deck.slice(21),
    selectedCardId: null,
    drawnCardId: null,
    drawnCardSource: null,
    playerSortMode: 'suit',
    message: 'Your draw.',
    roundSummary: '',
    lastAiAction: '',
    roundOver: false,
    matchOver: false,
    initialized: true
  };
}

export function validEightsSnapshot() {
  const deck = eightsDeck();
  return {
    kind: 'crapeights',
    v: 1,
    players: [
      { name: 'You', human: true, score: 40, hand: deck.slice(0, 7) },
      { name: 'Casey', human: false, score: 12, hand: deck.slice(7, 14) },
      { name: 'Jordan', human: false, score: 0, hand: deck.slice(14, 21) },
      { name: 'Riley', human: false, score: 8, hand: deck.slice(21, 28) }
    ],
    deck: deck.slice(29),
    discard: deck.slice(28, 29),
    roundNumber: 2,
    currentPlayer: 0,
    direction: 1,
    activeSuit: 'C',
    pendingDrawCards: 0,
    pendingSkips: 0,
    roundActive: true,
    hasDrawnThisTurn: false,
    selectedCardId: deck[0].id,
    pendingWildCard: null,
    historyLog: ['10:01 Round 2 started.'],
    nextCardId: 53,
    overlay: null
  };
}

export function validJackSnapshot() {
  const cards = jackDeck(4);
  return {
    kind: 'turdjack',
    v: 1,
    bankroll: 980,
    currentBet: 20,
    splitBet: 0,
    lastBet: 20,
    playerHand: cards.slice(0, 2),
    dealerHand: cards.slice(2, 4),
    splitHand: [],
    shoe: cards.slice(4),
    discard: [],
    runningCount: 1,
    shoeGeneration: 1,
    dealerHoleHidden: true,
    dealerHoleShoeGeneration: 1,
    dealerHoleCountResolved: false,
    firstDecisionOpen: true,
    splitRound: false,
    activeHandIndex: 0,
    cutCardsRemaining: 40,
    shoeDecks: 4,
    roundActive: true,
    rules: {
      dealerHitsSoft17: false,
      blackjackPayout: 1.5,
      decks: 4,
      allowDoubleAfterSplit: true,
      allowSurrender: true,
      allowInsurance: true,
      allowHitSplitAces: false
    },
    stats: {
      hands: 3,
      wins: 1,
      losses: 1,
      pushes: 0,
      surrenders: 0,
      blackjacks: 0,
      insuranceBets: 0,
      insuranceWins: 0,
      decisions: 4,
      correctDecisions: 3,
      bestDecisionStreak: 2
    },
    status: 'Round live. Your play.',
    decisionStreak: 1,
    hotStreak: 0,
    coldStreak: 0
  };
}
