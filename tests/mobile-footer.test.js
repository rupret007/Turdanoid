import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

it('reserves a music footer inserted after the first layout without a viewport resize', async () => {
  const dom = new JSDOM('<html data-mobile-game="turdomania"><body></body></html>', {
    runScripts: 'outside-only', pretendToBeVisual: true
  });
  const { window } = dom;
  const observers = [];
  const MutationObserver = window.MutationObserver;
  window.MutationObserver = class extends MutationObserver {
    constructor(callback) { super(callback); observers.push(this); }
  };
  window.matchMedia = () => ({ matches: true, addEventListener() {} });
  window.ResizeObserver = class { observe() {} };
  let resized = 0;
  window.addEventListener('resize', () => resized++);
  window.eval(readFileSync('assets/mobile-fit.js', 'utf8'));
  await new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
  const footer = window.document.createElement('div');
  footer.id = 'suite-music-status';
  footer.getBoundingClientRect = () => ({ height: 50 });
  window.document.body.append(footer);
  await Promise.resolve();
  await Promise.resolve();
  try {
    expect(window.document.documentElement.style.getPropertyValue('--mobile-footer')).toBe('50px');
    expect(resized).toBeGreaterThan(0);
  } finally {
    for (const observer of observers) { observer.disconnect(); }
    dom.window.close();
  }
});
