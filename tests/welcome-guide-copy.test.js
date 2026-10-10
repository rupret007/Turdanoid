import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pages = [
  ['turdjack.html', '#welcomeGuide', '#closeGuideBtn', '#quickGuideBtn'],
  ['turdspades.html', '#guide', '#closeGuide', '#quickStart'],
  ['turdtris.html', '#welcomeGuide', '[onclick="hideWelcomeGuide()"]', '[onclick="quickStartRun()"]'],
  ['crapeights.html', '#welcomeGuide', '#closeGuideBtn', '#quickStartBtn']
];

describe.each(pages)('%s welcome guide copy', (file, guideSelector, closeSelector, quickSelector) => {
  function expectButtonLabel(selector, label) {
    const html = readFileSync(join(root, file), 'utf8');
    const dom = new JSDOM(html);
    try {
      const button = dom.window.document.querySelector(`${guideSelector} ${selector}`);
      expect(button?.tagName).toBe('BUTTON');
      expect(button.textContent.trim()).toBe(label);
      // Native button text supplies the accessible name; do not mask it with stale copy.
      expect(button.getAttribute('aria-label') ?? label).toBe(label);
      expect(button.hasAttribute('aria-labelledby')).toBe(false);
    } finally {
      dom.window.close();
    }
  }

  it('labels the dismiss action Close Guide', () => {
    expectButtonLabel(closeSelector, 'Close Guide');
  });

  it('keeps the Quick Start label', () => {
    expectButtonLabel(quickSelector, 'Quick Start');
  });
});

const closeGuideLocator = "getByRole('button', { name: 'Close Guide' })";
const staleReviewLocator = "getByRole('button', { name: 'Review Then Start' })";

describe('Turdtris automation matches Close Guide', () => {
  it('browser-smoke Turdtris checks click Close Guide before gameplay assertions', () => {
    const source = readFileSync(join(root, 'browser-smoke.js'), 'utf8');
    for (const name of ['turdtris-mobile', 'turdtris-held-input-pause', 'turdtris-restart-churn']) {
      const start = source.indexOf(`'${name}'`);
      expect(start, `${name} check is present`).toBeGreaterThanOrEqual(0);
      const next = source.indexOf('await runCheck', start + 1);
      const block = source.slice(start, next === -1 ? undefined : next);
      expect(block).toContain(closeGuideLocator);
      expect(block).not.toContain(staleReviewLocator);
    }
    expect(source).not.toContain(staleReviewLocator);
  });

  it('turdtris autoplay clicks Close Guide', () => {
    const source = readFileSync(join(root, 'scripts/turdtris-autoplay.mjs'), 'utf8');
    expect(source).toContain(closeGuideLocator);
    expect(source).not.toContain(staleReviewLocator);
  });

  it('suite overlap Turdtris prep clicks Close Guide when visible', () => {
    const source = readFileSync(join(root, 'scripts/suite-overlap-check.mjs'), 'utf8');
    expect(source).toContain(closeGuideLocator);
    expect(source).not.toContain(staleReviewLocator);
  });
});
