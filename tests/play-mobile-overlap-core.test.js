import { describe, expect, it } from 'vitest';

import { measurePlayOverlap, rectInViewport, visibleBox } from '../games/play-mobile-overlap-core.js';

function boxesIntersect(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

describe('play-mobile-overlap-core', () => {
  it('ignores pointer-events:none layers when collecting floaters', () => {
    const doc = {
      defaultView: { innerWidth: 320, innerHeight: 568 },
      elementFromPoint: () => null,
      querySelectorAll: (sel) => {
        if (sel === '#suite-music-toggle') {
          return [];
        }
        if (sel === 'body *') {
          return [
            {
              id: 'suite-bg',
              className: 'suite-bg',
              tagName: 'DIV',
              getBoundingClientRect: () => ({
                left: 0,
                top: 0,
                right: 320,
                bottom: 568,
                width: 320,
                height: 568
              })
            }
          ];
        }
        return [];
      }
    };
    globalThis.getComputedStyle = () => ({
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      pointerEvents: 'none',
      position: 'fixed'
    });
    const issues = measurePlayOverlap(doc, ['#smartBtn']);
    expect(issues).toEqual([]);
  });

  it('detects bbox overlap between floaters and controls', () => {
    expect(
      boxesIntersect({ left: 0, top: 0, right: 50, bottom: 50 }, { left: 40, top: 40, right: 90, bottom: 90 })
    ).toBe(true);
    expect(rectInViewport({ left: 10, top: 10, right: 40, bottom: 40 }, 320, 568)).toBe(true);
    expect(rectInViewport({ left: 10, top: 600, right: 40, bottom: 640 }, 320, 568)).toBe(false);
  });

  it('visibleBox rejects hidden nodes', () => {
    globalThis.getComputedStyle = () => ({
      display: 'none',
      visibility: 'visible',
      opacity: '1',
      pointerEvents: 'auto'
    });
    const el = {
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 44, bottom: 44, width: 44, height: 44 })
    };
    expect(visibleBox(el)).toBeNull();
  });
});
