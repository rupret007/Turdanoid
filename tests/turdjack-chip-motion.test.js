import { describe, expect, it } from 'vitest';
import {
  chipSettlementKind,
  shouldAnimateChipSettlement
} from '../games/turdjack-chip-motion.js';

describe('turdjack-chip-motion', () => {
  it('pays chips on wins', () => {
    expect(chipSettlementKind('Hand 1 19 beats dealer 17.')).toBe('pay');
    expect(chipSettlementKind('Hand 1 wins $200 (dealer bust 22).')).toBe('pay');
  });

  it('sweeps chips on losses', () => {
    expect(chipSettlementKind('Hand 1 18 loses to dealer 20.')).toBe('sweep');
    expect(chipSettlementKind('Dealer blackjack. You got flushed.')).toBe('sweep');
  });

  it('skips animation when reduced motion', () => {
    expect(shouldAnimateChipSettlement(true, 'pay')).toBe(false);
    expect(shouldAnimateChipSettlement(false, 'pay')).toBe(true);
  });
});
