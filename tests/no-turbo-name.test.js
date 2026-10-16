import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = fs.readdirSync(ROOT).filter((f) => /\.(html|md)$/.test(f)).concat(['games/turdanoid_logic.js']);

describe('game names drop "Turbo"', () => {
  for (const f of files) {
    it(`${f} never says Turbo`, () => {
      expect(fs.readFileSync(path.join(ROOT, f), 'utf8')).not.toMatch(/turbo/i);
    });
  }
  it('Turdanoid page title and hub card use the plain name', () => {
    expect(fs.readFileSync(path.join(ROOT, 'TurdAnoid.html'), 'utf8')).toContain('<title>Turdanoid — Bricks. Busted.</title>');
    expect(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')).toContain('<h2>Turdanoid</h2>');
  });
});
