import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { wireHubCoverIdleMotion, wireHubAttractHeader } from '../assets/suite-hub-attract.js';

describe('suite-hub-attract', () => {
  it('marks covers for idle motion', () => {
    const dom = new JSDOM(`
      <a class="game-card" href="x.html"><div class="cover"></div></a>
    `);
    const doc = dom.window.document;
    wireHubCoverIdleMotion(doc);
    const cover = doc.querySelector('.cover');
    expect(cover.classList.contains('cover-motion-on') || cover.classList.contains('cover-motion-off')).toBe(true);
  });

  it('enables attract header when motion allowed', () => {
    const dom = new JSDOM('<header class="masthead"><h1><span class="logo">x</span></h1></header>');
    const doc = dom.window.document;
    wireHubAttractHeader(doc);
    expect(doc.querySelector('.masthead').classList.contains('hub-attract-on')).toBe(true);
  });
});
