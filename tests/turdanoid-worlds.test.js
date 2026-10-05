import { describe, it, expect } from 'vitest';
import { worldForLevel, worldIndexForLevel, levelIntroLine, WORLDS } from '../games/turdanoid-worlds.js';

describe('Turdanoid worlds', () => {
  it('groups 30 levels into 5 worlds of 6', () => {
    expect(WORLDS.length).toBe(5);
    expect(worldIndexForLevel(1)).toBe(0);
    expect(worldIndexForLevel(6)).toBe(0);
    expect(worldIndexForLevel(7)).toBe(1);
    expect(worldIndexForLevel(30)).toBe(4);
  });

  it('builds intro line with world name', () => {
    const line = levelIntroLine(8, 'Tunnel');
    expect(line).toContain('Sewer Pipes');
    expect(line).toContain('Level 8');
    expect(line).toContain('Tunnel');
    expect(worldForLevel(19).name).toBe('Candy Clog');
  });
});
