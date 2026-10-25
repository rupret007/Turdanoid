// @vitest-environment node
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../assets/mobile-fit.js', import.meta.url), 'utf8');
const pages = [];
function boot() {
  const dom = new JSDOM(`<html data-mobile-game="crapeights"><body><div id="playerHand">${Array.from({ length: 7 }, (_, i) => `<button data-card-id="${i}" class="card-btn">${i}</button>`).join('')}</div></body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  pages.push(dom);
  const w = dom.window;
  Object.defineProperty(w.document, 'readyState', { value: 'complete' });
  Object.defineProperty(w, 'innerWidth', { value: 320 });
  const hand = w.document.getElementById('playerHand');
  Object.defineProperty(hand, 'clientWidth', { value: 292 });
  w.matchMedia = () => ({ matches: true, addEventListener() {} });
  w.ResizeObserver = class { observe() {} };
  w.requestAnimationFrame = () => 1;
  w.cancelAnimationFrame = () => {};
  w.eval(source);
  return { w, hand, cards: [...hand.children] };
}
afterEach(() => pages.splice(0).forEach(page => page.window.close()));

describe('card hand paging', () => {
  it('reveals an off-page keyboard destination before focus and can return to the first page', () => {
    const { w, hand, cards } = boot();
    expect(cards[6].hidden).toBe(true);
    hand.dispatchEvent(new w.CustomEvent('suite:hand-reveal', { detail: { card: cards[6] } }));
    expect(cards[6].hidden).toBe(false);
    expect(cards[0].hidden).toBe(true);
    cards[6].focus();
    expect(w.document.activeElement).toBe(cards[6]);
    hand.dispatchEvent(new w.CustomEvent('suite:hand-reveal', { detail: { card: cards[0] } }));
    expect(cards[0].hidden).toBe(false);
    expect(cards[6].hidden).toBe(true);
  });

  it('keeps off-page cards hidden immediately when the game rebuilds its card classes', () => {
    const { w, hand, cards } = boot();
    cards.forEach(card => { card.className = 'card-btn playable'; });
    hand.dispatchEvent(new w.CustomEvent('suite:hand-rendered'));
    expect(cards[6].classList.contains('mobile-card-hidden')).toBe(true);
    expect(cards[6].hidden).toBe(true);
    expect(cards[0].hidden).toBe(false);
  });
});
