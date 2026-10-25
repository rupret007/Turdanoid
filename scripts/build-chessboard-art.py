# SPDX-License-Identifier: GPL-3.0-or-later
from pathlib import Path
import xml.etree.ElementTree as E
import subprocess, io, tarfile, gzip, sys, json

cg, art, out = map(Path, sys.argv[1:4])
svg = 'http://www.w3.org/2000/svg'
E.register_namespace('', svg)
E.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
(out / 'pieces').mkdir(parents=True, exist_ok=True)
for color in ['w', 'b']:
    first, second, stroke = ('#fffdf0', '#c3d7da', '#1c2b3b') if color == 'w' else ('#536780', '#172333', '#080f19')
    for kind in 'pnbrqk':
        root = E.fromstring((art / 'spatial' / (kind + '.svg')).read_bytes())
        root.attrib = {'viewBox': '0 0 933.333 933.333', 'width': '933.333', 'height': '933.333', 'shape-rendering': 'geometricPrecision'}
        for parent in list(root.iter()):
            for child in list(parent):
                if not child.tag.startswith('{' + svg + '}') or child.get('id') == 'shadow': parent.remove(child)
            for key in list(parent.attrib):
                if key.startswith('{') and not key.startswith('{http://www.w3.org/1999/xlink}'): del parent.attrib[key]
            identifier = parent.get('id')
            if identifier == 'stroke-color': parent.text = '.stroke-color {stroke:' + stroke + ';}'
            elif identifier == 'fill-color': parent.text = '.fill-color {fill:' + first + ';}'
            elif identifier == 'stroke-medium': parent.text = '.stroke-medium {stroke-width:18;}'
            elif identifier == 'stroke-boundary': parent.text = '.stroke-boundary {stroke-width:28;}'
            elif identifier == 'fillGradient':
                for stop, value in zip(parent, [first, second]): stop.set('style', 'stop-color:' + value + ';stop-opacity:1')
        E.indent(root)
        (out / 'pieces' / f'spatial-{color}{kind}.svg').write_bytes(E.tostring(root, encoding='utf-8', xml_declaration=True))

if '--art-only' in sys.argv[4:]: sys.exit(0)

# Matching upstream source, reproducible build instructions and original artwork.
# No repository metadata, unrelated assets or credentials enter this public tar.
entries = {}
upstream = subprocess.check_output(['git', '-C', str(cg), 'archive', 'HEAD', 'src', 'assets', 'LICENSE', 'README.md', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json'])
with tarfile.open(fileobj=io.BytesIO(upstream)) as tar:
    for member in tar:
        if member.isfile(): entries['upstream/' + member.name] = tar.extractfile(member).read()
for kind in 'pnbrqk': entries[f'artwork/spatial/{kind}.svg'] = (art / 'spatial' / f'{kind}.svg').read_bytes()
entries['artwork/LICENSE'] = (art / 'LICENSE').read_bytes()
entries['artwork/README.md'] = (art / 'README.md').read_bytes()
entries['ARCADE-BUILD.txt'] = b'''Chessground10.5.0 b4f605018e1043640c917e82a74b214cb58e4a05, GPL-3.0-or-later.
Spatial artwork by Maurizio Monge d8705d8bc9879fef44208de19e2a20c937409e1f, MIT.
The upstream TypeScript and base CSS are unmodified. Built with Node22.22.3 and rolldown1.2.15.
From this extracted directory: npm install --ignore-scripts; node build.mjs
This rebuilds chessground.js. Compare with the served chessground.js and board-vendor-lock.json.
For the configured pieces run: python3 build-chessboard-art.py upstream artwork OUTPUT_DIR --art-only
The readable integrating files are served beside the binary: games/chess-board.js, games/chess-ui.js, games/chess-pieces.js, assets/chess/chess-board.css and chess.html.
No compiler rebuild claim is made for the separately pinned Stockfish engine.
'''
entries['package.json'] = (json.dumps({'private': True, 'type': 'module', 'dependencies': {'rolldown': '1.2.15'}}, indent=2) + '\n').encode()
entries['build.mjs'] = b'''import {rolldown} from 'rolldown';
const b=await rolldown({input:'upstream/src/chessground.ts'});
await b.write({file:'chessground.js',format:'esm',minify:true,banner:'// Chessground 10.5.0, lichess.org contributors. GPL-3.0-or-later. Commit b4f605018e1043640c917e82a74b214cb58e4a05.\\n// Matching source: chessground-10.5.0-source.tar.gz; license: Chessground-LICENSE.txt.'});await b.close();
'''
entries['build-chessboard-art.py'] = Path(__file__).read_bytes()
buffer = io.BytesIO()
with tarfile.open(fileobj=buffer, mode='w') as tar:
    for name, data in sorted(entries.items()):
        entry = tarfile.TarInfo(name); entry.size = len(data); entry.mode = 0o644; entry.mtime = 0
        tar.addfile(entry, io.BytesIO(data))
with (out / 'chessground-10.5.0-source.tar.gz').open('wb') as file:
    with gzip.GzipFile(filename='', mode='wb', fileobj=file, mtime=0) as compressed: compressed.write(buffer.getvalue())
