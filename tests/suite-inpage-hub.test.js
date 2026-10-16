import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import {
  DUPLICATE_INPAGE_HUB_INNER_SELECTORS,
  NARROW_BACK_PILL_MAX_WIDTH
} from '../assets/suite-back-pill.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readRepo(path) {
  return readFileSync(join(root, path), 'utf8');
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function mediaBlocks(css, query) {
  const needle = `@media ${query}`;
  const blocks = [];
  let from = 0;
  while (from < css.length) {
    const start = css.indexOf(needle, from);
    if (start === -1) {
      break;
    }
    const open = css.indexOf('{', start);
    let depth = 0;
    let end = open;
    for (; end < css.length; end += 1) {
      if (css[end] === '{') {
        depth += 1;
      } else if (css[end] === '}') {
        depth -= 1;
        if (depth === 0) {
          blocks.push(css.slice(open + 1, end));
          break;
        }
      }
    }
    from = end + 1;
  }
  return blocks;
}

function cssRules(block) {
  return [...block.matchAll(/([^{}]+)\{([^}]+)\}/g)].map((match) => ({
    selectors: match[1].split(',').map((sel) => sel.trim()).filter(Boolean),
    body: match[2]
  }));
}

function duplicateHubHideRule(css) {
  const blocks = mediaBlocks(css, `(max-width: ${NARROW_BACK_PILL_MAX_WIDTH}px)`);
  for (const block of blocks) {
    const hide = cssRules(block).find((rule) =>
      /display\s*:\s*none\s*!important/.test(rule.body) &&
      rule.selectors.some((sel) => sel.includes('body:has(.suite-back-pill)'))
    );
    if (hide) {
      return hide;
    }
  }
  return null;
}

function innerSelector(full) {
  return full.replace(/^body:has\(\.suite-back-pill\)\s*/, '');
}

function inpageHubExits(document) {
  return [...document.querySelectorAll('a, button')].filter((el) => {
    if (el.classList.contains('suite-back-pill')) {
      return false;
    }
    const href = el.getAttribute('href');
    const onclick = el.getAttribute('onclick') || '';
    const goesHome = href === './' || onclick.includes("location.href='./'");
    if (!goesHome) {
      return false;
    }
    const name = `${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`
      .replace(/\s+/g, ' ')
      .trim();
    return /hub/i.test(name);
  });
}

const GAME_PAGES = [
  'TurdAnoid.html',
  'crapeights.html',
  'turdtris.html',
  'turdjack.html',
  'turdspades.html',
  'turdrummy.html'
];

describe('duplicate in-page Hub exits hide beside the suite back pill', () => {
  const css = stripComments(readRepo('assets/turdsuite.css'));
  const suiteJs = readRepo('assets/turdsuite.js');
  const shared = readRepo('docs/1000x/shared.md');
  const hide = duplicateHubHideRule(css);

  it('hides Game Hub, Back to Hub, overlay, and chrome Hub at ≤520px when the pill is present', () => {
    expect(NARROW_BACK_PILL_MAX_WIDTH).toBe(520);
    expect(hide, 'narrow hide rule exists').not.toBeNull();
    const inners = hide.selectors.map(innerSelector);
    for (const wanted of DUPLICATE_INPAGE_HUB_INNER_SELECTORS) {
      expect(inners, `CSS hide includes ${wanted}`).toContain(wanted);
    }
    expect(hide.selectors.every((sel) => sel.startsWith('body:has(.suite-back-pill)'))).toBe(true);
  });

  it('keeps that hide rule inside the phone media query so desktop 1280×800 may keep a named Hub', () => {
    expect(hide).not.toBeNull();
    const phoneBlocks = mediaBlocks(css, `(max-width: ${NARROW_BACK_PILL_MAX_WIDTH}px)`);
    expect(phoneBlocks.some((block) => block.includes('#btnHub') && block.includes('a.dialog-hub'))).toBe(true);
    const phoneJoined = phoneBlocks.join('\n');
    const withoutPhone = [css];
    for (const block of phoneBlocks) {
      withoutPhone[0] = withoutPhone[0].replace(block, '');
    }
    expect(withoutPhone[0]).not.toMatch(/body:has\(\.suite-back-pill\)\s+#btnHub/);
    expect(withoutPhone[0]).not.toMatch(/body:has\(\.suite-back-pill\)\s+a\.dialog-hub/);
    expect(phoneJoined).toMatch(/#btnHub/);
  });

  it.each(GAME_PAGES)('%s in-page Hub exits match the shared hide selectors', (file) => {
    const dom = new JSDOM(readRepo(file));
    try {
      const exits = inpageHubExits(dom.window.document);
      expect(exits.length, `${file} has in-page Hub exits`).toBeGreaterThan(0);
      const inners = hide.selectors.map(innerSelector);
      for (const el of exits) {
        const matched = inners.some((sel) => el.matches(sel));
        expect(matched, `${file} ${el.outerHTML.slice(0, 160)} matches hide selectors`).toBe(true);
      }
    } finally {
      dom.window.close();
    }
  });

  it('covers the audited first-screen Game Hub and overlay Back to Hub copy', () => {
    const anoid = new JSDOM(readRepo('TurdAnoid.html'));
    const eights = new JSDOM(readRepo('crapeights.html'));
    try {
      const gameHub = anoid.window.document.getElementById('btnHub');
      expect(gameHub?.textContent.trim()).toBe('Game Hub');
      expect(gameHub.matches('#btnHub')).toBe(true);
      expect(hide.selectors.map(innerSelector)).toContain('#btnHub');

      const overlayHubs = [...eights.window.document.querySelectorAll('a.dialog-hub')];
      expect(overlayHubs.length).toBeGreaterThan(0);
      expect(overlayHubs.every((el) => el.textContent.trim() === 'Back to Hub')).toBe(true);
      expect(hide.selectors.map(innerSelector)).toContain('a.dialog-hub');
      expect(hide.selectors.map(innerSelector)).toContain('.overlay a[href="./"]:not(.suite-back-pill)');
    } finally {
      anoid.window.close();
      eights.window.close();
    }
  });

  it('keeps the suite back pill as the home control', () => {
    expect(suiteJs).toMatch(/a\.href\s*=\s*['"]\.\/['"]/);
    expect(suiteJs).toContain('a.setAttribute(\'aria-label\', \'Back to game hub\')');
    expect(suiteJs).toContain('a.className = \'suite-back-pill\'');
  });

  it('keeps docs/1000x/shared.md honest with the pages', () => {
    expect(shared).toMatch(/Game Hub/);
    expect(shared).toMatch(/Back to Hub/);
    expect(shared).toMatch(/overlay/);
    expect(shared).toMatch(/≤520px|max-width:\s*520|≤520/);
    expect(shared).toMatch(/1280×800|desktop/i);
    expect(shared).toMatch(/href="\.\/"/);
    expect(shared).toMatch(/Physical overlap \*\*NOT RUN\*\*/);
    const placement = shared.slice(shared.indexOf('## Back pill placement'));
    expect(placement).toMatch(/dialog-hub|#btnHub/);
    expect(placement).not.toMatch(/leftover/);
  });
});
