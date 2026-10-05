import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import {
  capParticleCount,
  createSuiteFX,
  shakeIntensity
} from '../assets/suite-fx.js';

describe('suite-fx', () => {
  it('caps particles and softens shake when reduced motion', () => {
    expect(capParticleCount(100, true, 48)).toBeLessThanOrEqual(8);
    expect(capParticleCount(100, false, 48)).toBe(48);
    expect(shakeIntensity(10, true)).toBe(2);
    expect(shakeIntensity(10, false)).toBe(10);
  });

  it('skips flash when reduced motion is on', () => {
    const dom = new JSDOM('<body></body>');
    const fx = createSuiteFX(dom.window.document.body, { reducedMotion: true });
    fx.flash();
    expect(dom.window.document.querySelector('.suite-fx-flash')).toBeNull();
  });

  it('adds shake class with custom intensity', () => {
    const dom = new JSDOM('<body><div id="t"></div></body>');
    const target = dom.window.document.getElementById('t');
    const fx = createSuiteFX(dom.window.document.body, { reducedMotion: false });
    fx.screenShake(target, 8, 50);
    expect(target.classList.contains('suite-shake')).toBe(true);
  });
});
