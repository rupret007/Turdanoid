/* TurdRummy AI discard-memory helpers.
   Classic script: attaches TurdRummyAI on globalThis so turdrummy.html can
   use it from a plain <script> tag. games/turdrummy-ai.js re-exports this
   API for unit tests (see games/table-continue-core.js for the same split).

   The live page already tracks every card either side has discarded in
   state.discard (nothing extra to persist). This module turns that history
   into a "how risky is it to discard this card" signal: cards whose rank or
   suit-neighbors are already dead in the pile are less likely to complete
   an opponent's set or run, so they are safer to let go. */
(function attachTurdRummyAI(root) {
  'use strict';

  const SAFETY_WEIGHTS = {
    deadRank: 1.5,
    deadNeighbor: 0.5
  };

  /**
   * How safe `card` is to discard given the cards already seen in the
   * discard pile. Higher = safer (more of its rank/run neighborhood is
   * already dead, so an opponent is less likely holding a matching set
   * or run). Pure function: does not mutate `discardHistory`.
   * @param {Array<{suit: string, rank: number, id?: string}>} discardHistory
   * @param {{suit: string, rank: number, id?: string}} card
   */
  function computeDiscardSafety(discardHistory, card) {
    if (!card || !Array.isArray(discardHistory) || discardHistory.length === 0) {
      return 0;
    }
    let deadRankCount = 0;
    let deadNeighborCount = 0;
    for (const seen of discardHistory) {
      if (!seen || seen.id === card.id) {
        continue;
      }
      if (seen.rank === card.rank) {
        deadRankCount += 1;
        continue;
      }
      if (seen.suit === card.suit) {
        const gap = Math.abs(seen.rank - card.rank);
        if (gap === 1 || gap === 2) {
          deadNeighborCount += 1;
        }
      }
    }
    return deadRankCount * SAFETY_WEIGHTS.deadRank + deadNeighborCount * SAFETY_WEIGHTS.deadNeighbor;
  }

  root.TurdRummyAI = {
    SAFETY_WEIGHTS,
    computeDiscardSafety
  };
})(typeof window !== 'undefined' ? window : globalThis);
