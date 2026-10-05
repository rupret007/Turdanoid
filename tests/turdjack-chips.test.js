import { describe, expect, it } from 'vitest';
import { breakBetIntoChipClasses, buildChipStackHtml } from '../games/turdjack-chips.js';

describe('turdjack-chips', () => {
  it('breaks common bet amounts into chip classes', () => {
    expect(breakBetIntoChipClasses(0)).toEqual([]);
    expect(breakBetIntoChipClasses(35)).toEqual(['c25', 'c10']);
    expect(breakBetIntoChipClasses(100)).toEqual(['c100']);
  });

  it('caps stack visualization length', () => {
    expect(breakBetIntoChipClasses(5000, 5).length).toBe(5);
  });

  it('builds chip stack html', () => {
    expect(buildChipStackHtml(0)).toBe('');
    expect(buildChipStackHtml(10)).toContain('chip-stack');
    expect(buildChipStackHtml(10)).toContain('c10');
  });
});
