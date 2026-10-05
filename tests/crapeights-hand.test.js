import { describe, expect, it } from 'vitest';
import '../games/crapeights-hand.js';
const { layout } = globalThis.CrapeightsHand;

describe('fitted Crappy Eights fan', () => {
  it.each([276, 342, 900])('keeps every rotated card inside a %spx hand with exposed tap lanes', width => {
    for (let count = 1; count <= 52; count++) {
      const fan = layout(count, width);
      expect(fan.cards).toHaveLength(count);
      expect(fan.cardWidth).toBeGreaterThanOrEqual(78);
      fan.cards.forEach((card, index) => {
        const radians = Math.abs(card.angle) * Math.PI / 180;
        const rotatedWidth = fan.cardWidth * Math.cos(radians) + fan.cardHeight * Math.sin(radians);
        expect(card.x - (rotatedWidth - fan.cardWidth) / 2).toBeGreaterThanOrEqual(0);
        expect(card.x + fan.cardWidth + (rotatedWidth - fan.cardWidth) / 2).toBeLessThanOrEqual(width);
        const previous = fan.cards[index - 1];
        if (previous?.row === card.row) { expect(card.x - previous.x).toBeGreaterThanOrEqual(48); }
        expect(card.y + fan.cardHeight).toBeLessThan(fan.height);
      });
    }
  });
  it('centers and arcs each row and adds rows instead of shrinking targets', () => {
    const fan = layout(7, 342);
    expect(fan.rows).toBe(2);
    expect(fan.cards[0].angle).toBe(-fan.cards[3].angle);
    expect(fan.cards[0].y).toBe(fan.cards[3].y);
    expect(layout(7, 900).rows).toBe(1);
    expect(layout(0, 342).cards).toEqual([]);
  });
});
