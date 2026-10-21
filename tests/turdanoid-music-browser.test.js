// @vitest-environment node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hasBrowser = Boolean(process.env.PLAYWRIGHT_CHANNEL) || existsSync(chromium.executablePath());
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
let server;
let browser;
let baseUrl;

beforeAll(async () => {
  if (!hasBrowser) { return; }
  server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, `.${pathname}`);
    if (!file.startsWith(`${root}${sep}`)) { res.writeHead(403).end(); return; }
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium', headless: true });
});

afterAll(async () => {
  await browser?.close();
  if (server?.listening) { await new Promise((done) => server.close(done)); }
});

describe.skipIf(!hasBrowser)('Turdanoid playlist lifecycle', () => {
  it('keeps one track through game pause and replay, and pauses it while the tab is hidden', async () => {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await page.addInitScript(() => {
        window.__musicAudio = [];
        window.__tabHidden = false;
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__tabHidden });
        // Exercise the real shared player and page wiring without audio decoding.
        window.Audio = class extends window.EventTarget {
          constructor() {
            super();
            this.paused = true;
            this.currentTime = 0;
            this.sourceLoads = 0;
            window.__musicAudio.push(this);
          }
          set src(value) { this._src = value; this.currentTime = 0; this.sourceLoads++; }
          get src() { return this._src; }
          setAttribute() {}
          play() {
            this.paused = false;
            this.dispatchEvent(new window.Event('play'));
            return Promise.resolve();
          }
          pause() { this.paused = true; this.dispatchEvent(new window.Event('pause')); }
        };
      });
      await page.goto(`${baseUrl}/TurdAnoid.html`);
      await page.locator('#btnStart').click();
      await page.waitForFunction(() => window.__musicAudio.length === 1 && !window.__musicAudio[0].paused);
      const original = await page.evaluate(async () => {
        const player = await window.Suite.music();
        window.__originalMusicPlayer = player;
        player.audioElement.currentTime = 12.5;
        return { src: player.audioElement.src, loads: player.audioElement.sourceLoads, index: player.trackIndex };
      });
      const snapshot = () => page.evaluate(async () => {
        const player = await window.Suite.music();
        return {
          instances: window.__musicAudio.length,
          samePlayer: player === window.__originalMusicPlayer,
          src: player.audioElement.src,
          loads: player.audioElement.sourceLoads,
          index: player.trackIndex,
          time: player.audioElement.currentTime,
          playing: player.isPlaying()
        };
      });
      const unchanged = { instances: 1, samePlayer: true, ...original, time: 12.5, playing: true };
      await page.locator('#btnPause').click();
      expect(await page.evaluate(() => window.__turdanoid.state)).toBe('paused');
      expect(await snapshot()).toEqual(unchanged);
      await page.locator('#btnResume').click();
      expect(await page.evaluate(() => window.__turdanoid.state)).toBe('playing');
      expect(await snapshot()).toEqual(unchanged);
      await page.evaluate(() => { window.__turdanoid.gameOver(false); });
      await page.locator('#btnRestart').click();
      expect(await snapshot()).toEqual(unchanged);
      await page.evaluate(() => { window.__tabHidden = true; document.dispatchEvent(new window.Event('visibilitychange')); });
      await page.waitForFunction(() => window.__musicAudio[0].paused);
      expect(await snapshot()).toEqual({ ...unchanged, playing: false });
      await page.evaluate(() => { window.__tabHidden = false; document.dispatchEvent(new window.Event('visibilitychange')); });
      await page.waitForFunction(() => !window.__musicAudio[0].paused);
      expect(await snapshot()).toEqual(unchanged);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  });
});
