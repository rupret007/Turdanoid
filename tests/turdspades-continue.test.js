import { describe, it, expect } from 'vitest';

import { validateSpadesSnapshot } from '../games/table-continue.js';
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
    expect(state.trick).toHaveLength(1);
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
    raw.playedThisRound = [{ id: 'H2-0', suit: 'H', rank: 2 }];
    const validated = validateSpadesSnapshot(raw);
    expect(validated).not.toBeNull();

    const state = createSpadesTableState();
    mergeSpadesContinueSnapshot(state, { ...validated, playedThisRound: raw.playedThisRound });
    expect(state.playedThisRound).toEqual(raw.playedThisRound);

    const outbound = serializeSpadesTableState(state);
    expect(outbound.playedThisRound).toEqual(raw.playedThisRound);
  });
});
