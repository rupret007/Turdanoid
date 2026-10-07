import { describe, expect, it } from 'vitest';
import { stackShoeForDealOrder, card } from '../games/turdjack-shoe-seed.js';

describe('turdjack-shoe-seed', () => {
  it('stacks deal order so first card is first pop', () => {
    const shoe = [];
    stackShoeForDealOrder(shoe, [card('A'), card('2'), card('K'), card('5')]);
    expect(shoe.pop().rank).toBe('A');
    expect(shoe.pop().rank).toBe('2');
    expect(shoe.pop().rank).toBe('K');
    expect(shoe.pop().rank).toBe('5');
  });
});
