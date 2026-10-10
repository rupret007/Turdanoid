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
