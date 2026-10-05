import { describe, expect, it } from 'vitest';
import { fxParticleBudget } from '../games/turdjack-fx.js';

describe('turdjack-fx', () => {
  it('reduces particle budget when reduced motion is preferred', () => {
    expect(fxParticleBudget(true)).toBeLessThan(fxParticleBudget(false));
    expect(fxParticleBudget(true)).toBe(8);
  });
});
