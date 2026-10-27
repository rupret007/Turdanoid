import { describe, it, expect } from 'vitest';

import { validateSpadesSnapshot, rememberContinue, loadContinue } from '../games/table-continue.js';
import {
  createSpadesTableState,
  mergeSpadesContinueSnapshot,
  serializeSpadesTableState
} from '../games/turdspades-snapshot.js';
import { validSpadesSnapshot } from './continue-fixtures.js';

describe('turdspades continue (b3821b4 shape)', () => {
  it('loads the legacy fixture through validate + merge with no data loss', () => {
    const raw = validSpadesSnapshot();
    expect(raw.playedThisRound).toBeUndefined();

    const validated = validateSpadesSnapshot(raw);
    expect(validated).not.toBeNull();
    expect(validated.round).toBe(2);
    expect(validated.phase).toBe('play');
    expect(validated.hands[0].length).toBe(12);

    const state = createSpadesTableState();
    expect(mergeSpadesContinueSnapshot(state, validated)).toBe(true);

    expect(state.round).toBe(validated.round);
    expect(state.scores).toEqual(validated.scores);
    expect(state.bags).toEqual(validated.bags);
    expect(state.bids).toEqual(validated.bids);
    expect(state.tricks).toEqual(validated.tricks);
    expect(state.spadesBroken).toBe(true);
    expect(state.selected).toBe(validated.selected);
    expect(state.trick).toHaveLength(3);
    expect(state.trick[0].card.id).toBe(validated.trick[0].card.id);
    expect(state.playedThisRound).toEqual([]);

    const outbound = serializeSpadesTableState(state);
    expect(outbound.kind).toBe('turdspades');
    expect(outbound.v).toBe(1);
    expect(outbound.round).toBe(validated.round);
    expect(outbound.scores).toEqual(validated.scores);
    expect(outbound.hands[0].length).toBe(12);
    expect(outbound.msg).toBe(validated.msg);
    expect(outbound.playedThisRound).toEqual([]);
  });

  it('round-trips optional playedThisRound without dropping cards', () => {
    const raw = validSpadesSnapshot();
    raw.playedThisRound = [raw.trick[0].card];
    const validated = validateSpadesSnapshot(raw);
    expect(validated).not.toBeNull();
    expect(validated.playedThisRound).toEqual(raw.playedThisRound);

    const state = createSpadesTableState();
    mergeSpadesContinueSnapshot(state, validated);
    expect(state.playedThisRound).toEqual(raw.playedThisRound);

    const outbound = serializeSpadesTableState(state);
    expect(outbound.playedThisRound).toEqual(raw.playedThisRound);
  });

  it('keeps public history through the real continue store validation path', () => {
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
    const raw = validSpadesSnapshot();
    const completed = raw.hands[0].pop();
    raw.playedThisRound = [completed, ...raw.trick.map(entry => entry.card)];
    raw.trick = [];
    raw.tricks[3] += 1;
    raw.leader = 3;
    raw.currentPlayer = 3;
    expect(rememberContinue(storage, 'turdspades.html', raw)).toBe(true);
    const restored = loadContinue(storage, 'turdspades.html');
    expect(restored.playedThisRound).toEqual(raw.playedThisRound);
    const state = createSpadesTableState();
    expect(mergeSpadesContinueSnapshot(state, restored)).toBe(true);
    expect(state.playedThisRound).toEqual(raw.playedThisRound);
  });

  it.each(['duplicate', 'held', 'invalid', 'oversize'])('rejects %s public history', kind => {
    const raw = validSpadesSnapshot();
    const card = raw.trick[0].card;
    raw.playedThisRound = kind === 'duplicate' ? [card, card]
      : kind === 'held' ? [raw.hands[0][0]]
        : kind === 'oversize' ? Array(53).fill(card)
          : [{ ...card, rank: 99 }];
    expect(validateSpadesSnapshot(raw)).toBeNull();
  });
});
