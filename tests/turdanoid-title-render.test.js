import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const html = readFileSync(join(process.cwd(), 'TurdAnoid.html'), 'utf8');

function boot() {
  const contexts = new Map();
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/TurdAnoid.html',
    beforeParse(window) {
      window.requestAnimationFrame = () => 0;
      window.HTMLCanvasElement.prototype.getContext = function () {
        if (!contexts.has(this)) {
          const calls = [];
          const gradient = { addColorStop() {} };
          const target = { calls };
          contexts.set(this, new Proxy(target, {
            get(object, key) {
              if (key in object) { return object[key]; }
              return (...args) => {
                calls.push([key, ...args]);
                if (String(key).includes('Gradient')) { return gradient; }
                if (key === 'measureText') { return { width: 100 }; }
                return null;
              };
            },
            set(object, key, value) { object[key] = value; return true; }
          }));
        }
        return contexts.get(this);
      };
    }
  });
  const canvas = dom.window.document.getElementById('game');
  return { dom, window: dom.window, canvas, ctx: contexts.get(canvas) };
}

describe('title poster rendering', () => {
  it('reuses the scenery at canvas resolution while the attract ball keeps moving', () => {
    const { dom, window, canvas, ctx } = boot();
    try {
      window.render();
      expect(ctx.calls.some(([name]) => name === 'createLinearGradient')).toBe(true);
      const firstBallX = window.eval('titleDemoBall.x');
      ctx.calls.length = 0;
      window.render();
      const blit = ctx.calls.find(([name]) => name === 'drawImage');
      expect(blit[1].width).toBe(canvas.width);
      expect(blit[1].height).toBe(canvas.height);
      expect(ctx.calls.some(([name]) => name.includes('Gradient'))).toBe(false);
      expect(window.eval('titleDemoBall.x')).toBeGreaterThan(firstBallX);
    } finally { dom.window.close(); }
  });

  it('repaints after resize and menu re-entry, and never caches active gameplay', () => {
    const { dom, window, ctx } = boot();
    const hasScenery = () => ctx.calls.some(([name]) => name === 'createLinearGradient');
    try {
      window.render();
      window.resize();
      ctx.calls.length = 0;
      window.render();
      expect(hasScenery()).toBe(true);

      window.__turdanoid.startGame();
      for (let frame = 0; frame < 2; frame++) {
        ctx.calls.length = 0;
        window.render();
        expect(hasScenery()).toBe(true);
        expect(window.__turdanoid.state).toBe('playing');
      }
      window.__turdanoid.quitToMenu();
      ctx.calls.length = 0;
      window.render();
      expect(hasScenery()).toBe(true);
      ctx.calls.length = 0;
      window.render();
      expect(hasScenery()).toBe(false);
    } finally { dom.window.close(); }
  });
});
