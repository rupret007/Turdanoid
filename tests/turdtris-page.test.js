/**
 * Load the real turdtris.html page script in jsdom and prove the leftover
 * after #18: hold/pause stay on the dock, a hitch cannot dump gravity,
 * and Space replays after game over.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it } from 'vitest';

const html = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'turdtris.html'),
  'utf8'
);

function makeCtxStub() {
  const gradient = { addColorStop() {} };
  const target = {};
  return new Proxy(target, {
    get(t, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => gradient;
      }
      if (prop in t) {
        return t[prop];
      }
      return () => {};
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    }
  });
}

function bootPage(storedBest) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/turdtris.html',
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = () => makeCtxStub();
      window.requestAnimationFrame = () => 1;
      window.cancelAnimationFrame = () => {};
      if (storedBest !== undefined) {
        window.localStorage.setItem('turdtrisHighScore', String(storedBest));
      }
    }
  });
  const w = dom.window;
  w.hideWelcomeGuide();
  return w;
}

describe('Turdtris page leftover after the mobile dock', () => {
  let w;

  beforeEach(() => {
    w = bootPage('120');
  });

  it('keeps hold, soft drop, and pause on the live dock', () => {
    const dock = w.document.getElementById('mobileControls');
    const actions = [...dock.querySelectorAll('[data-action]')].map((btn) =>
      btn.getAttribute('data-action')
    );
    expect(actions).toEqual(['left', 'rotate', 'right', 'drop', 'down', 'hold', 'pause']);
    expect(dock.querySelector('details, .mobile-extra')).toBeNull();
    expect(w.document.body.innerHTML).not.toContain('More Controls');
  });

  it('rejects a malformed stored best instead of painting NaN', () => {
    w.localStorage.setItem('turdtrisHighScore', '<script>1e999</script>');
    expect(w.readStoredHighScore()).toBe(0);
    w.localStorage.setItem('turdtrisHighScore', '480');
    expect(w.readStoredHighScore()).toBe(480);
  });

  it('clamps a multi-second hitch so gravity cannot slam the piece', () => {
    expect(w.clampFrameDelta(5000)).toBe(33);
    expect(w.clampFrameDelta(-12)).toBe(0);
    const startRow = w.eval('tetromino.row');
    w.eval('lastFrameTime = 1000; loop(6000)');
    expect(w.eval('tetromino.row')).toBe(startRow);
    expect(w.eval('dropAccumulator')).toBeLessThanOrEqual(33);
  });

  it('shows a new-best receipt and Space starts the next run', () => {
    w.eval('score = 260; runBestAtStart = 120; showGameOver(false)');
    expect(w.eval('gameOver')).toBe(true);
    expect(w.document.getElementById('endBestLabel').textContent).toBe('New best');
    expect(w.document.getElementById('endBest').textContent).toBe('260');
    expect(w.document.getElementById('gameOverOverlay').style.display).toBe('grid');

    w.document.dispatchEvent(
      new w.KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true })
    );
    expect(w.eval('gameOver')).toBe(false);
    expect(w.eval('score')).toBe(0);
    expect(w.document.getElementById('gameOverOverlay').style.display).toBe('none');
  });
});
