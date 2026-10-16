import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir) =>
  fs
    .readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
const files = fs
  .readdirSync(ROOT)
  .filter((f) => /\.(html|md)$/.test(f))
  .concat(walk('games').filter((f) => f.endsWith('.js')))
  .concat(walk('assets').filter((f) => /\.(js|css)$/.test(f)))
  .concat(walk('docs').filter((f) => /\.(md|html|txt)$/.test(f)));
// Player-facing pages: the display name is "Turdanoid" (file name TurdAnoid.html stays).
const pages = fs
  .readdirSync(ROOT)
  .filter((f) => /\.html$/.test(f))
  .concat(['README.md', 'RULES.md']);

describe('game names drop "Turbo"', () => {
  for (const f of files) {
    it(`${f} never says Turbo`, () => {
      expect(fs.readFileSync(path.join(ROOT, f), 'utf8')).not.toMatch(/turbo/i);
    });
  }
  for (const f of pages) {
    it(`${f} spells the game "Turdanoid" (only the file name keeps TurdAnoid)`, () => {
      expect(fs.readFileSync(path.join(ROOT, f), 'utf8')).not.toMatch(/TurdAnoid(?!\.html)/);
    });
  }
  it('Turdanoid page title and hub card use the plain name', () => {
    expect(fs.readFileSync(path.join(ROOT, 'TurdAnoid.html'), 'utf8')).toContain(
      '<title>Turdanoid — Bricks. Busted.</title>'
    );
    expect(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')).toContain('<h2>Turdanoid</h2>');
  });
});
