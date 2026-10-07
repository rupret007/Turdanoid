import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { fanTransform, fanStyle, trickEntryPosition } from '../games/turdspades-layout.js';

const spadesHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'turdspades.html'),
  'utf8'
);

describe('turdspades-layout', () => {
  it('fans cards around center index', () => {
    const left = fanTransform(0, 5);
    const right = fanTransform(4, 5);
    expect(left.rotate).toBeLessThan(0);
    expect(right.rotate).toBeGreaterThan(0);
  });

  it('exports fan CSS variables', () => {
    expect(fanStyle(2, 5)).toContain('--fan-r');
  });

  it('maps trick seats to table positions', () => {
    expect(trickEntryPosition('North').top).toBe('8%');
    expect(trickEntryPosition('West').left).toBe('14%');
  });

  it('keeps trick-well seat centering on translate so pop-in cannot overlap seats', () => {
    expect(spadesHtml).toMatch(/\.trick-pile\.layout-seat \.entry\[data-seat="North"\]\{[^}]*translate:-50% 0/);
    expect(spadesHtml).toMatch(/\.trick-pile\.layout-seat \.entry\[data-seat="West"\]\{[^}]*translate:0 -50%/);
    expect(spadesHtml).not.toMatch(
      /\.trick-pile\.layout-seat \.entry\[data-seat="North"\]\{[^}]*transform:translateX/
    );
    expect(spadesHtml).toMatch(/\.entry\.winning \{[\s\S]*?transform: translateY\(-4px\) scale\(1\.04\)/);
    expect(spadesHtml).toMatch(/if \(width < 48\) return/);
  });
});
