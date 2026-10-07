import { describe, expect, it } from 'vitest';
import '../games/crapeights-table.js';
const { cardLabel, handPoints, fanLayout, focusIndex, turnHint } = globalThis.CrapeightsTable;

describe('Crappy Eights table guidance', () => {
  it('announces action, suit, legality and selection without relying on color', () => {
    expect(cardLabel({ rank: '2', suit: 'H' }, true, true)).toBe('2 of Hearts, Draw two, playable, selected');
    expect(cardLabel({ rank: 'K', suit: 'C' }, false, false)).toBe('K of Clubs, does not match');
  });
  it('shows the existing scoring risk without changing point values', () => {
    expect(handPoints(['8', 'A', 'J', 'Q', 'K', '10', '2'].map(rank => ({ rank })))).toBe(93);
    expect(handPoints([])).toBe(0);
  });
  it('caps visible backs, centers the fan and leaves empty seats empty', () => {
    expect(fanLayout(0)).toEqual([]);
    expect(fanLayout(40)).toHaveLength(8);
    expect(fanLayout(3)).toEqual([{ x: -12, y: 2, angle: -7 }, { x: 0, y: 0, angle: 0 }, { x: 12, y: 2, angle: 7 }]);
  });
  it('wraps keyboard navigation and supports endpoints', () => {
    expect(focusIndex(0, 'ArrowLeft', 7)).toBe(6);
    expect(focusIndex(6, 'ArrowRight', 7)).toBe(0);
    expect(focusIndex(3, 'Home', 7)).toBe(0);
    expect(focusIndex(3, 'End', 7)).toBe(6);
    expect(focusIndex(0, 'End', 0)).toBe(-1);
  });
  it('distinguishes waiting, drawing and selection decisions', () => {
    const state = { active: true, human: true, suit: 'H', rank: '4', playableCount: 0 };
    expect(turnHint(state).title).toBe('Your move · draw a card');
    expect(turnHint({ ...state, drawn: true }).title).toBe('Play or pass');
    expect(turnHint({ ...state, selected: { rank: '8', suit: 'C' } }).detail).toContain('choose a suit');
    expect(turnHint({ ...state, human: false, name: 'Riley' }).title).toBe('Riley is thinking');
    expect(turnHint({ ...state, active: false }).title).toBe('Round complete');
  });
});
