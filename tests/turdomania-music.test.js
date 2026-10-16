import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

import { createSuiteMusic } from '../assets/suite-music.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const turdomaniaHtml = readFileSync(join(root, 'turdomania.html'), 'utf8');

class MockAudio {
  constructor() {
    this.loop = false;
    this.paused = true;
    this.src = '';
  }

  setAttribute() {}

  addEventListener() {}

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

describe('Turdomania suite music', () => {
  let dom;

  afterEach(() => {
    dom?.window?.close();
  });

  it('page arms Suite.music from the board on first gesture', () => {
    expect(turdomaniaHtml).toContain('armSuiteMusic');
    expect(turdomaniaHtml).toContain("boardEl.addEventListener('pointerdown', armSuiteMusic");
  });

  it('starts playlist audio after board pointerdown and stops when suite mute is on', async () => {
    const audio = new MockAudio();
    let muted = false;
    const player = createSuiteMusic({
      isSuiteMuted: () => muted,
      resolveSrc: (path) => `http://localhost/assets/${path}`,
      AudioCtor: function () {
        return audio;
      }
    });

    dom = new JSDOM(
      `<!DOCTYPE html><body>
        <div id="board" tabindex="0"></div>
        <script>
          const player = null;
          window.Suite = {
            music: () => Promise.resolve(window.__player)
          };
          window.__player = null;
          function armSuiteMusic() {
            window.Suite.music().then((p) => { if (p) p.armFromGesture(); });
          }
          const boardEl = document.getElementById('board');
          boardEl.addEventListener('pointerdown', armSuiteMusic, { once: true });
        </script>
      </body>`,
      { runScripts: 'dangerously', url: 'http://localhost/turdomania.html' }
    );
    dom.window.__player = player;

    dom.window.document.getElementById('board').dispatchEvent(
      new dom.window.Event('pointerdown', { bubbles: true })
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(player.armed).toBe(true);
    expect(audio.paused).toBe(false);
    expect(audio.src).toContain('manic.m4a');

    muted = true;
    player.sync();
    expect(audio.paused).toBe(true);
  });
});
