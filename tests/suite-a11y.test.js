import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { createAnnouncer, injectSkipLink, LIVE_REGION_ID } from '../assets/suite-a11y.js';

describe('suite-a11y', () => {
  it('injects a skip link to the games main', () => {
    const dom = new JSDOM('<body><main id="hub-games"></main></body>');
    const doc = dom.window.document;
    const link = injectSkipLink(doc);
    expect(link?.getAttribute('href')).toBe('#hub-games');
    expect(doc.querySelector('.suite-skip-link')).not.toBeNull();
  });

  it('announces via a polite live region', () => {
    const dom = new JSDOM('<body></body>');
    const doc = dom.window.document;
    const announcer = createAnnouncer(doc);
    announcer.announce('Line clear');
    const region = doc.getElementById(LIVE_REGION_ID);
    expect(region?.textContent).toBe('Line clear');
    expect(region?.getAttribute('aria-live')).toBe('polite');
  });
});
