import { describe, it, expect } from 'vitest';
import { groupHandForDisplay, fanLayout, fanTransform } from '../games/turdrummy-meld.js';

const card = (suit, rank) => ({ suit, rank, id: `${suit}${rank}` });

describe('groupHandForDisplay', () => {
  it('turns each meld into its own group, then one deadwood group', () => {
    const analysis = {
      melds: [
        { type: 'set', cards: [card('C', 5), card('D', 5), card('H', 5)] },
        { type: 'run', cards: [card('S', 2), card('S', 3), card('S', 4)] }
      ],
      deadwoodCards: [card('C', 13)]
    };
    const groups = groupHandForDisplay(analysis);
    expect(groups.map((g) => g.kind)).toEqual(['set', 'run', 'deadwood']);
    expect(groups.map((g) => g.label)).toEqual(['Set', 'Run', 'Deadwood']);
    expect(groups[0].cards).toHaveLength(3);
    expect(groups[2].cards.map((c) => c.id)).toEqual(['C13']);
  });

  it('omits the deadwood group when every card is melded (gin shape)', () => {
    const analysis = {
      melds: [{ type: 'set', cards: [card('C', 9), card('D', 9), card('S', 9)] }],
      deadwoodCards: []
    };
    expect(groupHandForDisplay(analysis).map((g) => g.kind)).toEqual(['set']);
  });

  it('copies card arrays so the caller can reorder safely', () => {
    const meld = { type: 'run', cards: [card('H', 6), card('H', 7), card('H', 8)] };
    const groups = groupHandForDisplay({ melds: [meld], deadwoodCards: [] });
    groups[0].cards.pop();
    expect(meld.cards).toHaveLength(3);
  });

  it('tolerates a missing or empty analysis', () => {
    expect(groupHandForDisplay(null)).toEqual([]);
    expect(groupHandForDisplay({ melds: [{ type: 'set', cards: [] }], deadwoodCards: [] })).toEqual([]);
  });
});

describe('fanLayout', () => {
  it('fits a 10-card hand at 390px with a visible strip per card', () => {
    const layout = fanLayout({ cardWidth: 46, count: 10, groupCount: 3, availableWidth: 330, groupGap: 6 });
    expect(layout.width).toBeLessThanOrEqual(330 + 0.001);
    expect(layout.step).toBeGreaterThanOrEqual(46 * 0.3);
    expect(layout.step).toBeLessThanOrEqual(46 * 0.6);
  });

  it('never lets the fan run wider than the available space when crowded', () => {
    const layout = fanLayout({ cardWidth: 44, count: 11, groupCount: 4, availableWidth: 250, groupGap: 6 });
    expect(layout.width).toBeLessThanOrEqual(250 + 0.001);
  });

  it('caps overlap so a fan on a wide table is a fan, not a stack', () => {
    const layout = fanLayout({ cardWidth: 60, count: 3, groupCount: 1, availableWidth: 1000, groupGap: 8 });
    expect(layout.step).toBe(60 * 0.6);
  });

  it('handles one card and an empty hand without dividing by zero', () => {
    expect(fanLayout({ cardWidth: 50, count: 1, groupCount: 1, availableWidth: 300 }).step).toBe(50);
    expect(fanLayout({ cardWidth: 50, count: 0, groupCount: 0, availableWidth: 300 }).width).toBe(50);
  });
});

describe('fanTransform', () => {
  it('keeps the middle card level and tilts the ends symmetrically', () => {
    const left = fanTransform(0, 5);
    const mid = fanTransform(2, 5);
    const right = fanTransform(4, 5);
    expect(mid).toEqual({ rotate: 0, lift: 0 });
    expect(left.rotate).toBe(-right.rotate);
    expect(left.rotate).toBeLessThan(0);
    expect(left.lift).toBeGreaterThan(0);
  });

  it('clamps out-of-range indexes instead of tilting past the arc', () => {
    expect(fanTransform(99, 4)).toEqual(fanTransform(3, 4));
    expect(fanTransform(-3, 4)).toEqual(fanTransform(0, 4));
  });

  it('treats a single card as level', () => {
    expect(fanTransform(0, 1)).toEqual({ rotate: 0, lift: 0 });
  });
});
