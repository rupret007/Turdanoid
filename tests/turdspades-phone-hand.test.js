import { describe, it, expect } from 'vitest';
import { layoutPhoneHand } from '../games/turdspades-phone-hand.js';

describe('TurdSpades phone hand geometry', () => {
  it('keeps every normal or lifted card within the hand at phone widths', () => {
    for (const width of [270, 280, 288, 300, 320, 340, 358, 366, 390]) {
      for (let count = 0; count <= 13; count++) {
        const layout = layoutPhoneHand({ count, width });
        expect(layout.positions).toHaveLength(count);
        expect(layout.height).toBeLessThanOrEqual(150);
        for (const card of layout.positions) {
          expect(card.x).toBeGreaterThanOrEqual(-0.000001);
          expect(card.x + layout.cardWidth).toBeLessThanOrEqual(width + 0.000001);
          expect(card.y - layout.selectedLift).toBeGreaterThanOrEqual(0);
          expect(card.y + layout.cardHeight).toBeLessThanOrEqual(layout.height);
        }
      }
    }
  });

  it('preserves readable horizontal indices and at least 44px tall exposed targets', () => {
    for (const width of [270, 288, 320, 358, 390]) {
      for (let count = 1; count <= 13; count++) {
        const layout = layoutPhoneHand({ count, width });
        expect(layout.cardHeight).toBeGreaterThanOrEqual(44);
        for (let row = 0; row < layout.rows; row++) {
          const cards = layout.positions.filter(card => card.row === row);
          for (let index = 1; index < cards.length; index++) {
            expect(cards[index].x - cards[index - 1].x).toBeGreaterThanOrEqual(30 - 0.000001);
          }
        }
        if (layout.rows === 2) {
          const rearBottom = Math.max(...layout.positions.filter(card => card.row === 0).map(card => card.y));
          const frontTop = Math.min(...layout.positions.filter(card => card.row === 1).map(card => card.y));
          expect(frontTop - layout.selectedLift - rearBottom).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });

  it('stages a full hand in centered staggered rows on both phone sizes', () => {
    for (const width of [270, 358, 390]) {
      const layout = layoutPhoneHand({ count: 13, width });
      const rear = layout.positions.filter(card => card.row === 0);
      const front = layout.positions.filter(card => card.row === 1);
      expect(rear).toHaveLength(7);
      expect(front).toHaveLength(6);
      expect(front[0].x).toBeGreaterThan(rear[0].x);
      for (const row of [rear, front]) {
        const outerCenter = (row[0].x + row.at(-1).x + layout.cardWidth) / 2;
        expect(outerCenter).toBeCloseTo(width / 2);
      }
    }
  });

  it('uses one row when remaining cards have enough exposed width', () => {
    expect(layoutPhoneHand({ count: 8, width: 270 }).rows).toBe(1);
    expect(layoutPhoneHand({ count: 9, width: 270 }).rows).toBe(2);
    expect(layoutPhoneHand({ count: 12, width: 390 }).rows).toBe(1);
    expect(layoutPhoneHand({ count: 13, width: 390 }).rows).toBe(2);
    const single = layoutPhoneHand({ count: 1, width: 320 });
    expect(single.positions[0].x + single.cardWidth / 2).toBe(160);
    expect(single.positions[0].y).toBe(single.selectedLift);
  });

  it('returns a stable empty hand and normalizes invalid counts and widths', () => {
    expect(layoutPhoneHand().positions).toEqual([]);
    expect(layoutPhoneHand().height).toBe(0);
    expect(layoutPhoneHand({ count: -1 }).positions).toEqual([]);
    expect(layoutPhoneHand({ count: NaN }).positions).toEqual([]);
    expect(layoutPhoneHand({ count: 100 }).positions).toHaveLength(13);
    expect(layoutPhoneHand({ count: 4.8 }).positions).toHaveLength(4);
    expect(layoutPhoneHand({ count: 1, width: NaN })).toEqual(layoutPhoneHand({ count: 1, width: 320 }));
  });
});
