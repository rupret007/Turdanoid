/**
 * Load the real turdtris.html page script in jsdom and prove the leftover
 * after #19: Hold/Next stay on the thumb dock, used Hold cannot swap,
 * hitch gravity still clamps, and Space still replays after game over.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

  afterEach(() => w.close());

  function key(code) {
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { code, cancelable: true }));
  }

  function press(action) {
    w.document.querySelector(`[data-action="${action}"]`).dispatchEvent(
      new w.Event('pointerdown', { bubbles: true, cancelable: true })
    );
  }

  it('resumes at normal gravity after pausing with keyboard soft drop held', () => {
    key('ArrowDown');
    expect(w.eval('softDrop')).toBe(true);
    key('KeyP');
    const row = w.eval('tetromino.row');
    key('KeyP');
    w.eval('dropAccumulator = 0; lastFrameTime = 1000; loop(1033); loop(1066)');
    expect(w.eval('tetromino.row')).toBe(row);
    expect(w.eval('softDrop')).toBe(false);
    key('ArrowDown');
    expect(w.eval('tetromino.row')).toBe(row + 1);
  });

  it.each(['pause', 'guide', 'blur'])('clears a held phone control on %s', (boundary) => {
    press('down');
    expect(w.eval('holdInterval')).not.toBeNull();
    if (boundary === 'pause') { key('KeyP'); }
    if (boundary === 'guide') { w.showWelcomeGuide(); }
    if (boundary === 'blur') { w.dispatchEvent(new w.Event('blur')); }
    expect(w.eval('paused')).toBe(true);
    expect(w.eval('holdInterval')).toBeNull();
    expect(w.eval('softDrop')).toBe(false);
  });

  it('does not queue phone movement behind pause, but the dock can still resume', () => {
    key('KeyP');
    press('down');
    expect(w.eval('softDrop')).toBe(false);
    expect(w.eval('holdInterval')).toBeNull();
    press('left');
    expect(w.eval('holdInterval')).toBeNull();
    press('pause');
    expect(w.eval('paused')).toBe(false);
    const col = w.eval('tetromino.col');
    press('left');
    expect(w.eval('tetromino.col')).toBe(col - 1);
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

  it('keeps Hold and Next previews on the thumb dock', () => {
    const dock = w.document.getElementById('mobileControls');
    expect(dock.querySelector('#mobileHold')).not.toBeNull();
    expect(dock.querySelector('#mobileNext')).not.toBeNull();
    expect(dock.querySelector('#mobileHoldBox')).not.toBeNull();
    expect(w.document.getElementById('mobileHold').getAttribute('aria-label')).toBe('Held piece');
    expect(w.document.getElementById('mobileNext').getAttribute('aria-label')).toBe('Next piece');
  });

  it('dims Hold after use and refuses a second swap on the same piece', () => {
    const first = w.eval('tetromino.name');
    w.holdCurrentPiece();
    const afterHold = {
      holdName: w.eval('holdName'),
      current: w.eval('tetromino.name'),
      canHold: w.eval('canHold')
    };
    expect(afterHold.holdName).toBe(first);
    expect(afterHold.canHold).toBe(false);

    const holdBtn = w.document.querySelector('#mobileControls [data-action="hold"]');
    expect(holdBtn.classList.contains('is-used')).toBe(true);
    expect(holdBtn.getAttribute('aria-disabled')).toBe('true');
    expect(w.document.getElementById('mobileHoldBox').classList.contains('is-used')).toBe(true);

    const lockedCurrent = afterHold.current;
    w.holdCurrentPiece();
    expect(w.eval('holdName')).toBe(first);
    expect(w.eval('tetromino.name')).toBe(lockedCurrent);
    expect(w.eval('canHold')).toBe(false);
    expect(w.eval('statusText')).toBe('Hold already used this piece.');
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
