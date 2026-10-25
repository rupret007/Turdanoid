// SPDX-License-Identifier: GPL-3.0-or-later
// Run from this repository: node scripts/build-chessboard-vendor.mjs CG_CHECKOUT ART_CHECKOUT
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { rolldown } from 'rolldown';

const [cg, art] = process.argv.slice(2).map(p => resolve(p));
const cgCommit = 'b4f605018e1043640c917e82a74b214cb58e4a05';
const artCommit = 'd8705d8bc9879fef44208de19e2a20c937409e1f';
for (const [path, pin] of [[cg, cgCommit], [art, artCommit]]) {
  if (execFileSync('git', ['-C', path, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== pin) { throw Error('Unexpected vendor commit'); }
  if (execFileSync('git', ['-C', path, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim()) { throw Error('Modified vendor source'); }
}
const out = resolve('assets/chess');
await mkdir(out, { recursive: true });
const bundle = await rolldown({ input: resolve(cg, 'src/chessground.ts') });
await bundle.write({ file: resolve(out, 'chessground.js'), format: 'esm', minify: true,
  banner: `// Chessground 10.5.0, lichess.org contributors. GPL-3.0-or-later. Commit ${cgCommit}.\n// Matching source: chessground-10.5.0-source.tar.gz; license: Chessground-LICENSE.txt.` });
await bundle.close();
await copyFile(resolve(cg, 'assets/chessground.base.css'), resolve(out, 'chessground.base.css'));
await copyFile(resolve(cg, 'LICENSE'), resolve(out, 'Chessground-LICENSE.txt'));
await copyFile(resolve(art, 'LICENSE'), resolve(out, 'Spatial-LICENSE.txt'));
execFileSync('python3', ['scripts/build-chessboard-art.py', cg, art, out]);
const names = ['chessground.js', 'chessground.base.css', 'Chessground-LICENSE.txt', 'Spatial-LICENSE.txt', 'chessground-10.5.0-source.tar.gz',
  ...['w', 'b'].flatMap(color => [...'pnbrqk'].map(type => `pieces/spatial-${color}${type}.svg`))];
const files = {};
for (const name of names) { const bytes = await readFile(resolve(out, name)); files[name] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }; }
await writeFile(resolve(out, 'board-vendor-lock.json'), JSON.stringify({
  chessground: { version: '10.5.0', repository: 'https://github.com/lichess-org/chessground', commit: cgCommit, license: 'GPL-3.0-or-later', bundler: 'rolldown 1.2.15' },
  artwork: { theme: 'Spatial', author: 'Maurizio Monge', repository: 'https://github.com/maurimo/chess-art', commit: artCommit, license: 'MIT', modifications: 'Configured ivory/navy gradients and stroke widths; removed baked shadow and editor metadata; CSS supplies a restrained shadow.' },
  board: { author: 'Rad Dad arcade contributors', license: 'GPL-3.0-or-later', texture: 'CSS colors and gradients; no third-party texture' }, files
}, null, 2) + '\n');
console.log(`Built Chessground10.5.0 and12 Spatial pieces at exact pins; ${names.length} verified files.`);
