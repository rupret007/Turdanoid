import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  STALEMATE_PLAYLIST,
  STALEMATE_TRACK_ONLY_BEEN_18_TITLE
} from '../assets/suite-music.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SCAN_ROOTS = ['assets', 'games', 'tests', 'scripts'];
const SCAN_EXTENSIONS = new Set(['.js', '.html', '.css', '.md', '.mjs', '.json']);

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'docs',
  'dist',
  'coverage',
  '.cache'
]);

function walkScanFiles(dirRel) {
  const abs = path.join(ROOT, dirRel);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dirRel, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) return [];
      return walkScanFiles(rel);
    }
    const ext = path.extname(entry.name);
    if (!SCAN_EXTENSIONS.has(ext)) return [];
    if (entry.name === 'package-lock.json') return [];
    return [rel];
  });
}

const rootHtml = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith('.html'))
  .map((f) => f);

const SELF = 'tests/stalemate-song-title.test.js';

const scanFiles = [...new Set([...rootHtml, ...SCAN_ROOTS.flatMap(walkScanFiles)])]
  .filter((f) => f !== SELF)
  .sort();

/** Wrong word order. */
const BEEN_ONLY_ORDER = /It['\u2019\u00b4`′]s\s+Been\s+Only\s+18/gi;
/** ASCII apostrophe in the full Jeff title (repo standard is U+2019). */
const STRAIGHT_APOSTROPHE_FULL_TITLE = new RegExp(
  `It${String.fromCharCode(39)}s\\s+Only\\s+Been\\s+18`,
  'g'
);
const IT_PREFIX_TITLE = /It['\u2019\u00b4`′]s\s+(?:Only\s+Been|Been\s+Only)\s+18/gi;

function isWithinCanonicalTitle(text, onlyBeenIndex) {
  const window = text.slice(Math.max(0, onlyBeenIndex - 12), onlyBeenIndex + 14);
  return /It(?:\\u2019|['\u2019])s Only Been 18/.test(window);
}

function findForbiddenVariants(text, fileRel) {
  const hits = [];
  const add = (label, regex) => {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(text)) !== null) {
      hits.push({ file: fileRel, label, match: m[0], index: m.index });
    }
  };
  add('been-only-word-order', BEEN_ONLY_ORDER);
  add('straight-apostrophe-title', STRAIGHT_APOSTROPHE_FULL_TITLE);

  const over18 = /\bOver\s+18\b/gi;
  over18.lastIndex = 0;
  let om;
  while ((om = over18.exec(text)) !== null) {
    const ctx = text.slice(Math.max(0, om.index - 40), om.index + 40).toLowerCase();
    if (ctx.includes('stalemate') || ctx.includes('only-been') || ctx.includes('track')) {
      hits.push({ file: fileRel, label: 'over-18-track-name', match: om[0], index: om.index });
    }
  }

  const quotedOnly = /['"`]Only\s+Been\s+18['"`]/g;
  quotedOnly.lastIndex = 0;
  let qm;
  while ((qm = quotedOnly.exec(text)) !== null) {
    if (!isWithinCanonicalTitle(text, qm.index + 1)) {
      hits.push({ file: fileRel, label: 'quoted-only-been-18', match: qm[0], index: qm.index });
    }
  }

  return hits;
}

function findNonCanonicalIt18Titles(text, fileRel) {
  const bad = [];
  IT_PREFIX_TITLE.lastIndex = 0;
  let m;
  while ((m = IT_PREFIX_TITLE.exec(text)) !== null) {
    if (m[0] !== STALEMATE_TRACK_ONLY_BEEN_18_TITLE) {
      bad.push({ file: fileRel, match: m[0], index: m.index });
    }
  }
  const loneOnly = /\bOnly\s+Been\s+18\b/g;
  loneOnly.lastIndex = 0;
  while ((m = loneOnly.exec(text)) !== null) {
    if (!isWithinCanonicalTitle(text, m.index)) {
      bad.push({ file: fileRel, match: m[0], index: m.index });
    }
  }
  return bad;
}

describe('Stalemate song title “It’s Only Been 18” (Jeff, exact)', () => {
  it('playlist entry uses the exported canonical title', () => {
    const track = STALEMATE_PLAYLIST.find((t) => t.path === 'stalemate/only-been-18.m4a');
    expect(track).toBeDefined();
    expect(track.title).toBe(STALEMATE_TRACK_ONLY_BEEN_18_TITLE);
    expect(STALEMATE_TRACK_ONLY_BEEN_18_TITLE).toBe('It\u2019s Only Been 18');
  });

  for (const fileRel of scanFiles) {
    it(`${fileRel} has no alternate spellings of the Jeff track title`, () => {
      const text = fs.readFileSync(path.join(ROOT, fileRel), 'utf8');
      const forbidden = findForbiddenVariants(text, fileRel);
      const nonCanonical = findNonCanonicalIt18Titles(text, fileRel);
      expect(forbidden, JSON.stringify(forbidden, null, 2)).toEqual([]);
      expect(nonCanonical, JSON.stringify(nonCanonical, null, 2)).toEqual([]);
    });
  }
});
