// @vitest-environment node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const available = existsSync(chromium.executablePath());
let server, browser, origin;

beforeAll(async () => {
  if (!available) {return;}
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root.replace(/\/$/, '') + sep)) {response.writeHead(403).end(); return;}
    try {
      response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  if (server) {await new Promise(done => server.close(done));}
});

describe.skipIf(!available)('arcade native controls and legacy storage recovery', () => {
  it.each([[390,844], [844,390], [320,568], [1440,1000]])('Turdanoid: caught-ball launch stays clear of the paddle at %sx%s', async (width, height) => {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: true, reducedMotion: 'reduce' });
    try {
      await page.goto(`${origin}/TurdAnoid.html`);
      await page.locator('#btnStart').click();
      const initial = await page.evaluate(() => ({
        hint: document.getElementById('arcHint').hidden ? null : document.getElementById('arcHint').getBoundingClientRect().toJSON(),
        launch: document.getElementById('mobileLaunch').getBoundingClientRect().toJSON()
      }));
      if (initial.hint) {expect(initial.hint.bottom + 6).toBeLessThanOrEqual(initial.launch.top);}
      await page.locator('#mobileLaunch').tap();
      // Specific power-up/collision fixture; the release itself is a native tap.
      await page.evaluate(() => {
        const g = window.__turdanoid;
        g.qaActivatePower('catch');
        Object.assign(g.balls[0], { x: g.paddle.x, y: g.paddle.y - g.balls[0].r, vx: 0, vy: 2 });
        g.step(1000 / 60); g.render();
      });
      expect(await page.evaluate(() => window.__turdanoid.balls[0].stuck)).toBe(true);
      const geometry = await page.evaluate(() => {
        const g = window.__turdanoid, canvas = document.getElementById('game').getBoundingClientRect();
        const scale = canvas.height / g.H, b = g.balls[0];
        return { launch: document.getElementById('mobileLaunch').getBoundingClientRect().toJSON(),
          powers: document.getElementById('powers').getBoundingClientRect().toJSON(),
          hint: document.getElementById('arcHint').hidden ? null : document.getElementById('arcHint').getBoundingClientRect().toJSON(),
          ballTop: canvas.top + (b.y - b.r) * scale,
          paddleTop: canvas.top + g.paddle.y * scale };
      });
      expect(geometry.launch.height).toBeGreaterThanOrEqual(44);
      expect(geometry.launch.top).toBeGreaterThanOrEqual(0);
      expect(geometry.launch.bottom + 6).toBeLessThanOrEqual(geometry.ballTop);
      expect(geometry.launch.bottom + 6).toBeLessThanOrEqual(geometry.paddleTop);
      if (geometry.hint) {expect(geometry.hint.bottom + 6).toBeLessThanOrEqual(geometry.launch.top);}
      const overlap = geometry.powers.left < geometry.launch.right && geometry.powers.right > geometry.launch.left
        && geometry.powers.top < geometry.launch.bottom && geometry.powers.bottom > geometry.launch.top;
      expect(overlap).toBe(false);
      await page.locator('#mobileLaunch').tap();
      expect(await page.evaluate(() => window.__turdanoid.waitingLaunch)).toBe(false);
      expect(await page.evaluate(() => window.__turdanoid.balls[0].stuck)).toBe(false);
    } finally {await page.close();}
  });

  it.each(['interrupted', 'closed'])('Turdomania: a fresh gesture recovers after its effects context becomes %s without changing mute intent', async state => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    try {
      await page.addInitScript(() => {
        const NativeContext = window.AudioContext;
        window.__audioCreations = 0; window.__resumeCalls = 0;
        window.AudioContext = class extends NativeContext {
          constructor(...args) {super(...args); window.__audioCreations++;}
        };
      });
      await page.route('**/turdomania.html', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, body: (await response.text()).replace('<html ', '<html data-arcade-audio="studio" ') });
      });
      // The canonical Rad Dad importer selects the studio facade this way.
      // Source and Stalemate retain the classic facade and original playlist.
      await page.route('**/assets/turdsuite.js', async route => {
        const response = await route.fetch(), source = await response.text();
        const adapted = source.replace("const AUDIO_PROFILE = 'classic';", "const AUDIO_PROFILE = document.documentElement.dataset.arcadeAudio === 'studio' ? 'studio' : 'classic';");
        expect(adapted).not.toBe(source);
        await route.fulfill({ response, body: adapted });
      });
      await page.goto(`${origin}/turdomania.html`);
      await page.evaluate(() => window.Suite.audioReady());
      expect(await page.evaluate(() => window.Suite.getSoundState().profile)).toBe('studio');
      const pop = async () => {
        await page.waitForTimeout(250);
        const id = await page.evaluate(() => {
          const { state, Core } = window.__turdomania;
          for (let c = 0; c < state.cols; c++) {for (let r = 0; r < state.rows; r++) {
            if (Core.findGroup(state.board, c, r).length >= 3) {return document.querySelector(`.tile[data-col="${c}"][data-row="${r}"]`).id;}
          }}
        });
        expect(id).toBeTruthy(); await page.locator('#' + id).tap();
      };
      await pop(); await pop();
      expect(await page.evaluate(() => window.Suite.getSoundState().accepted)).toBeGreaterThan(0);
      await page.evaluate(async state => {
        const context = window.Suite.getSoundContext();
        if (state === 'closed') {await context.close(); return;}
        await context.suspend();
        const resume = context.resume.bind(context);
        Object.defineProperty(context, 'state', { configurable: true, get: () => 'interrupted' });
        context.resume = () => {window.__resumeCalls++; delete context.state; return resume();};
      }, state);
      await pop();
      await expect.poll(() => page.evaluate(state => state === 'closed' ? window.__audioCreations : window.__resumeCalls, state)).toBeGreaterThan(state === 'closed' ? 1 : 0);
      const before = await page.evaluate(() => window.Suite.getSoundState().accepted);
      await pop();
      expect(await page.evaluate(() => window.Suite.getSoundState().accepted)).toBeGreaterThan(before);
      await page.evaluate(() => window.Suite.setMuted(true));
      expect(await page.evaluate(() => window.Suite.getSoundContext())).toBeNull();
      expect(await page.evaluate(() => window.Suite.isMuted())).toBe(true);
    } finally {await page.close();}
  });

  it('Turdtris: native key repeat cannot hard-drop additional pieces or undo a pause', async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${origin}/turdtris.html`);
      await page.locator('#attractPlay').click();
      await page.keyboard.down('Space');
      expect(await page.evaluate(() => window.eval('runStats.pieces'))).toBe(1);
      await page.keyboard.down('Space');
      await page.keyboard.down('Space');
      expect(await page.evaluate(() => window.eval('runStats.pieces'))).toBe(1);
      await page.keyboard.up('Space');
      await page.keyboard.press('Space');
      expect(await page.evaluate(() => window.eval('runStats.pieces'))).toBe(2);
      await page.keyboard.down('p');
      await page.keyboard.down('p');
      expect(await page.evaluate(() => window.eval('paused'))).toBe(true);
      await page.keyboard.up('p');
      await page.keyboard.press('p');
      expect(await page.evaluate(() => window.eval('paused'))).toBe(false);
    } finally {await page.close();}
  });

  for (const key of ['Enter', 'Space']) {
    for (const target of ['btnHowTo', 'btnBoss']) {
      it(`Turdanoid: ${key} activates the focused ${target} button`, async () => {
        const page = await browser.newPage();
        try {
          await page.goto(`${origin}/TurdAnoid.html`);
          await page.locator(`#${target}`).waitFor({ state: 'visible' });
          await page.waitForFunction(id => !document.getElementById(id).disabled, target);
          await page.locator(`#${target}`).focus();
          await page.keyboard.press(key);
          const state = await page.evaluate(() => ({
            state: window.__turdanoid.state,
            mode: window.__turdanoid.gameMode,
            guide: document.getElementById('howScreen').classList.contains('show')
          }));
          expect(state).toEqual(target === 'btnBoss'
            ? { state: 'playing', mode: 'boss', guide: false }
            : { state: 'title', mode: 'classic', guide: true });
        } finally {await page.close();}
      });
    }

    it(`Neon: ${key} activates Mute without launching or pausing`, async () => {
      const page = await browser.newPage();
      try {
        await page.goto(`${origin}/neon-arkanoid.html`);
        await page.getByRole('button', { name: 'Close Guide', exact: true }).click();
        const before = await page.evaluate(() => ({
          awaiting: window.gameInstance.awaitingLaunch,
          paused: window.gameInstance.paused,
          muted: window.gameInstance.muted
        }));
        await page.locator('#muteBtn').focus();
        await page.keyboard.press(key);
        expect(await page.evaluate(() => ({
          awaiting: window.gameInstance.awaitingLaunch,
          paused: window.gameInstance.paused,
          muted: window.gameInstance.muted
        }))).toEqual({ ...before, muted: !before.muted });
      } finally {await page.close();}
    });
  }

  for (const denied of ['get', 'set']) {
    it(`Neon remains playable and can mute when storage ${denied} is denied`, async () => {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error' && /Failed to initialize game|Game loop error/.test(message.text())) {errors.push(message.text());}
      });
      try {
        await page.addInitScript(method => {
          if (method === 'get') {
            Object.defineProperty(window, 'localStorage', { configurable: true, get() {throw new window.DOMException('Storage denied', 'SecurityError');} });
          } else {
            window.Storage.prototype.setItem = () => {throw new window.DOMException('Storage full', 'QuotaExceededError');};
          }
        }, denied);
        await page.goto(`${origin}/neon-arkanoid.html`);
        await page.waitForFunction(() => !!window.gameInstance);
        await page.getByRole('button', { name: 'Close Guide', exact: true }).click();
        await page.locator('#muteBtn').click();
        expect(await page.locator('#muteBtn').textContent()).toBe('Unmute');
        await page.locator('#muteBtn').click();
        expect(await page.locator('#muteBtn').textContent()).toBe('Mute');
        await page.locator('#gameCanvas').click();
        expect(await page.evaluate(() => window.gameInstance.awaitingLaunch)).toBe(false);
        await page.keyboard.press('p');
        expect(await page.evaluate(() => window.gameInstance.paused)).toBe(true);
        await page.keyboard.press('p');
        expect(await page.evaluate(() => window.gameInstance.paused)).toBe(false);
        expect(errors).toEqual([]);
      } finally {await page.close();}
    });
  }

  for (const game of ['TurdAnoid', 'turdtris']) {
    for (const [width, hiddenFooter] of [[1280, false], [1024, false], [1280, true]]) {
      it(`${game}: desktop ${width}px keeps gameplay clear with ${hiddenFooter ? 'no' : 'the measured'} footer`, async () => {
        const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        try {
          await page.goto(`${origin}/${game}.html`);
          await page.waitForSelector('#suite-music-status');
          // Explicit absent-player fixture. Actual site imports are also reviewed.
          if (hiddenFooter) {await page.evaluate(() => document.getElementById('suite-music-status').remove());}
          await page.locator(game === 'TurdAnoid' ? '#btnStart' : '#attractPlay').click();
          await page.evaluate(() => document.fonts.ready);
          await page.waitForFunction(() => {
            const measured = document.getElementById('suite-music-status')?.getBoundingClientRect().height || 0;
            return parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--mobile-footer')) === measured;
          });
          const layout = await page.evaluate(() => {
            const rect = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON();
            const footer = rect('#suite-music-status');
            return {
              bottom: footer?.height ? footer.top : window.innerHeight,
              canvas: rect('#game'),
              launch: rect('#mobileLaunch'),
              lives: rect('.hud .right'),
              sound: rect('#btnSound'),
              pause: rect('#btnPause'),
              queue: [...document.querySelectorAll('.queue-slot')].map(el => el.getBoundingClientRect().toJSON()),
              railRect: rect('.cabinet-rail'),
              decoration: rect('.pb-boss'),
              topbar: rect('.topbar'),
              rail: document.querySelector('.cabinet-rail')?.getAttribute('tabindex')
            };
          });
          expect(layout.canvas.bottom).toBeLessThanOrEqual(layout.bottom);
          if (game === 'TurdAnoid') {
            expect(layout.launch.bottom).toBeLessThanOrEqual(layout.bottom);
            for (const button of [layout.sound, layout.pause]) {
              const overlaps = layout.lives.left < button.right && layout.lives.right > button.left
                && layout.lives.top < button.bottom && layout.lives.bottom > button.top;
              expect(overlaps).toBe(false);
            }
          } else {
            expect(layout.canvas.height / layout.canvas.width).toBeCloseTo(2, 2);
            expect(layout.queue).toHaveLength(5);
            for (const preview of layout.queue) {
              expect(preview.width).toBe(96);
              expect(preview.height).toBe(64);
            }
            expect(layout.rail).toBe('0');
            expect(layout.railRect.top).toBeGreaterThanOrEqual(layout.topbar.bottom);
            expect(layout.railRect.bottom).toBeLessThanOrEqual(layout.bottom);
            expect(layout.decoration.right).toBeLessThanOrEqual(layout.railRect.left);
          }
        } finally {await page.close();}
      });
    }
  }

  it('Turdtris lets a focused stats rail scroll without soft-dropping a piece', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 600 }, reducedMotion: 'reduce' });
    try {
      await page.goto(`${origin}/turdtris.html`);
      await page.locator('#attractPlay').click();
      await page.locator('.cabinet-rail').focus();
      const score = await page.locator('#score').textContent();
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(() => document.querySelector('.cabinet-rail').scrollTop > 0);
      expect(await page.locator('#score').textContent()).toBe(score);
    } finally {await page.close();}
  });

  it('Neon keeps its complete title clear of Run Menu on a 320px phone', async () => {
    const page = await browser.newPage({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
    try {
      await page.goto(`${origin}/neon-arkanoid.html`);
      await page.getByRole('button', { name: 'Close Guide', exact: true }).tap();
      const header = await page.evaluate(() => {
        const title = document.querySelector('.title-wrap h1');
        const menu = document.querySelector('.mobile-menu');
        return { text: title.textContent, title: title.getBoundingClientRect().toJSON(), menu: menu.getBoundingClientRect().toJSON(), scroll: title.scrollWidth, width: title.clientWidth };
      });
      expect(header.text).toBe('Neon Arkanoid');
      expect(header.title.right).toBeLessThanOrEqual(header.menu.left);
      expect(header.scroll).toBeLessThanOrEqual(header.width);
      await page.locator('.mobile-menu summary').tap();
      expect(await page.locator('.mobile-menu details').getAttribute('open')).not.toBeNull();
    } finally {await page.close();}
  });

  for (const key of ['Enter', 'Space']) {
    it(`Neon phone dock accepts ${key} and releases a keyboard direction`, async () => {
      const page = await browser.newPage({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
      try {
        await page.clock.install();
        await page.goto(`${origin}/neon-arkanoid.html`);
        await page.getByRole('button', { name: 'Close Guide', exact: true }).tap();
        const before = await page.evaluate(() => window.gameInstance.paddle.x);
        await page.locator('[data-action=left]').focus();
        await page.keyboard.press(key);
        const moved = await page.evaluate(() => ({ x: window.gameInstance.paddle.x, left: window.gameInstance.controls.left, right: window.gameInstance.controls.right }));
        expect(moved.x).toBeLessThan(before);
        expect(moved.left || moved.right).toBe(false);
        await page.clock.runFor(100);
        expect(await page.evaluate(() => window.gameInstance.paddle.x)).toBe(moved.x);
        await page.locator('[data-action=launch]').focus();
        await page.keyboard.press(key);
        expect(await page.evaluate(() => window.gameInstance.awaitingLaunch)).toBe(false);
        await page.locator('.mobile-menu summary').tap();
        await page.locator('.mobile-menu-actions [data-mute-btn]').focus();
        await page.keyboard.press(key);
        expect(await page.evaluate(() => window.gameInstance.muted)).toBe(true);
        expect(await page.evaluate(() => window.gameInstance.paused)).toBe(false);
        await page.locator('.mobile-menu-actions button[onclick="togglePause()"]', { exact: true }).focus();
        await page.keyboard.press(key);
        expect(await page.evaluate(() => window.gameInstance.paused)).toBe(true);
        await page.keyboard.press(key);
        expect(await page.evaluate(() => window.gameInstance.paused)).toBe(false);
      } finally {await page.close();}
    });

    it(`Turdtris results keep ${key} sharing, Hub and replay actions native`, async () => {
      const page = await browser.newPage();
      try {
        await page.addInitScript(() => {
          window.__nativeShareCalls = 0;
          Object.defineProperty(window.navigator, 'share', { configurable: true, value: async () => {
            window.__nativeShareCalls++;
            throw new window.DOMException('Cancelled by test', 'AbortError');
          } });
        });
        await page.clock.install();
        await page.goto(`${origin}/turdtris.html`);
        await page.locator('#attractPlay').click();
        for (let piece = 0; piece < 30 && !await page.evaluate(() => window.eval('gameOver')); piece++) {
          await page.keyboard.press('Space');
          await page.clock.runFor(17);
        }
        expect(await page.evaluate(() => window.eval('gameOver'))).toBe(true);
        const score = await page.locator('#score').textContent();
        await page.getByRole('button', { name: 'Share score', exact: true }).focus();
        await page.keyboard.press(key);
        // Sharing invokes the provider synchronously inside the gesture. The
        // controlled clock is paused, so a rAF-based poll would never run.
        expect(await page.evaluate(() => window.__nativeShareCalls)).toBe(1);
        expect(await page.evaluate(() => window.eval('gameOver'))).toBe(true);
        expect(await page.locator('#score').textContent()).toBe(score);
        await page.locator('.suite-back-pill').focus();
        await page.keyboard.press('Space');
        expect(await page.evaluate(() => window.eval('gameOver'))).toBe(true);
        await page.keyboard.press('Enter');
        await page.waitForURL(`${origin}/`);
        await page.goto(`${origin}/turdtris.html`);
        if (!await page.locator('#attractPlay').isVisible()) {
          await page.getByRole('button', { name: /How To Play/ }).click();
        }
        await page.locator('#attractPlay').click();
        for (let piece = 0; piece < 30 && !await page.evaluate(() => window.eval('gameOver')); piece++) {
          await page.keyboard.press('Space');
          await page.clock.runFor(17);
        }
        await page.locator('#gameOverOverlay button').filter({ hasText: /again/i }).first().focus();
        await page.keyboard.press(key);
        expect(await page.evaluate(() => window.eval('gameOver'))).toBe(false);
        expect(await page.locator('#score').textContent()).toBe('0');
      } finally {await page.close();}
    });
  }

  for (const game of ['turdtris', 'neon-arkanoid']) {
    it(`${game} restores desktop canvas sizing across repeated phone breakpoints`, async () => {
      const page = await browser.newPage({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
      try {
        await page.goto(`${origin}/${game}.html`);
        if (game === 'turdtris') {await page.locator('#attractPlay').click();}
        else {await page.getByRole('button', { name: 'Close Guide', exact: true }).click();}
        const selector = game === 'turdtris' ? '#game' : '#gameCanvas';
        const ratio = game === 'turdtris' ? 2 : 2 / 3;
        await page.waitForFunction(s => document.querySelector(s).style.getPropertyPriority('height') === 'important', selector);
        const initial = await page.locator(selector).boundingBox();
        for (let transition = 0; transition < 2; transition++) {
          await page.setViewportSize({ width: 1280, height: 900 });
          await page.waitForFunction(s => document.querySelector(s).style.getPropertyPriority('height') !== 'important', selector);
          const desktop = await page.locator(selector).boundingBox();
          expect(desktop.height / desktop.width).toBeCloseTo(ratio, 2);
          expect(desktop.width).toBeGreaterThan(initial.width * 2);
          if (game === 'neon-arkanoid') {
            expect(await page.locator('.canvas-wrap').evaluate(el => el.style.width)).toBe('');
          }
          await page.setViewportSize({ width: 320, height: 568 });
          await page.waitForFunction(s => document.querySelector(s).style.getPropertyPriority('height') === 'important', selector);
          const phone = await page.locator(selector).boundingBox();
          expect(phone.height / phone.width).toBeCloseTo(ratio, 2);
          expect(phone.width).toBeLessThanOrEqual(320);
        }
      } finally {await page.close();}
    });
  }

  it('Neon mouse-only narrow desktop dock launches once and releases pointer input', async () => {
    const page = await browser.newPage({ viewport: { width: 320, height: 568 }, hasTouch: false, isMobile: false });
    try {
      await page.clock.install();
      await page.goto(`${origin}/neon-arkanoid.html`);
      await page.getByRole('button', { name: 'Close Guide', exact: true }).click();
      expect(await page.evaluate(() => window.navigator.maxTouchPoints)).toBe(0);
      await page.locator('[data-action=launch]').click();
      expect(await page.evaluate(() => window.gameInstance.awaitingLaunch)).toBe(false);
      expect(await page.evaluate(() => window.gameInstance.paused)).toBe(false);
      await page.locator('[data-action=left]').hover();
      const before = await page.evaluate(() => window.gameInstance.paddle.x);
      await page.mouse.down();
      await page.clock.runFor(50);
      const held = await page.evaluate(() => ({ x: window.gameInstance.paddle.x, left: window.gameInstance.controls.left }));
      expect(held.left).toBe(true);
      expect(held.x).toBeLessThan(before);
      // More frames may pass while the native pointer remains down. Measure
      // stationary input from the actual release, not an earlier held frame.
      await page.clock.runFor(32);
      await page.mouse.up();
      const released = await page.evaluate(() => ({ x: window.gameInstance.paddle.x, ...window.gameInstance.controls }));
      expect(released.left || released.right || released.pointerActive).toBe(false);
      expect(released.x).toBeLessThan(held.x);
      await page.clock.runFor(50);
      expect(await page.evaluate(() => window.gameInstance.paddle.x)).toBe(released.x);
    } finally {await page.close();}
  });

  for (const width of [1024, 1280, 320]) {
    it(`Neon keeps colour and difficulty controls distinct and hittable at ${width}px`, async () => {
      const page = await browser.newPage({ viewport: { width, height: width === 320 ? 568 : 900 }, isMobile: width === 320, hasTouch: width === 320 });
      try {
        await page.goto(`${origin}/neon-arkanoid.html`);
        await page.getByRole('button', { name: 'Close Guide', exact: true }).click();
        await page.waitForSelector('#suite-arcade-a11y-toggle');
        if (width === 320) {await page.locator('.mobile-menu summary').tap();}
        const layout = await page.evaluate(() => {
          const color = document.getElementById('suite-arcade-a11y-toggle');
          const elements = [color, ...document.querySelectorAll('.suite-difficulty-btn')];
          return {
            inToolbar: document.querySelector('.title-row .actions').contains(color),
            controls: elements.map(el => {
              const rect = el.getBoundingClientRect();
              const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
              return { text: el.textContent, rect: rect.toJSON(), hit: el === hit || el.contains(hit) };
            })
          };
        });
        expect(layout.inToolbar).toBe(width !== 320);
        for (const control of layout.controls) {
          expect(control.hit, control.text).toBe(true);
          expect(control.rect.width).toBeGreaterThanOrEqual(44);
          expect(control.rect.height).toBeGreaterThanOrEqual(44);
          expect(control.rect.right).toBeLessThanOrEqual(width);
        }
        const [color, ...difficulty] = layout.controls;
        for (const other of difficulty) {
          expect(color.rect.left < other.rect.right && color.rect.right > other.rect.left
            && color.rect.top < other.rect.bottom && color.rect.bottom > other.rect.top).toBe(false);
        }
        await page.locator('.suite-difficulty-btn[data-level=hard]').click();
        expect(await page.locator('.suite-difficulty-btn[data-level=hard]').getAttribute('aria-pressed')).toBe('true');
        await page.locator('#suite-arcade-a11y-toggle').click();
        expect(await page.locator('#suite-arcade-a11y-toggle').getAttribute('aria-pressed')).toBe('true');
      } finally {await page.close();}
    });
  }
});
