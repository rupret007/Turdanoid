// @vitest-environment node
// Native controls/RAF/rendering. /fixture/ replaces only createRun at this
// isolated test server with a labeled complete collision fixture, never a forced
// result callback. /studio/ applies Rad Dad's exact SDK audio-profile adaptation.
import { Buffer } from 'node:buffer';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const available = existsSync(chromium.executablePath());
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
let browser, server, base;

beforeAll(async () => {
  if (!available) {return;}
  server = createServer(async (request, response) => {
    const original = new URL(request.url, 'http://localhost').pathname;
    const pathname = original.replace(/^\/(?:fixture|studio)\//, '/');
    const file = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!file.startsWith(root + sep)) {response.writeHead(403).end(); return;}
    try {
      let bytes = await readFile(file);
      if (original.startsWith('/fixture/') && pathname === '/games/turdrush-core.js') {
        const source = bytes.toString();
        const declaration = 'export function createRun(seed = 1)';
        if (!source.includes(declaration)) {throw new Error('Update the explicit core fixture adapter.');}
        bytes = Buffer.from(source.replace(declaration, 'function fixtureActualCreateRun(seed = 1)') + `
export function createRun(seed = 1) {
  const state = fixtureActualCreateRun(seed);
  state.distance = 512; state.elapsed = 30; state.speed = 15; state.picks = 5;
  state.score = 5370; state.entities = [{ id: 9000, kind: 'barrier', lane: 1, at: 513 }];
  state._nextChunk = 1e9; return state;
}
`);
      }
      if (original.startsWith('/studio/') && pathname === '/assets/turdsuite.js') {
        const source = bytes.toString();
        const before = "const AUDIO_PROFILE = 'classic';";
        if (!source.includes(before)) {throw new Error('Update the production studio-profile adapter.');}
        bytes = Buffer.from(source.replace(before, "const AUDIO_PROFILE = document.documentElement.dataset.arcadeAudio === 'studio' ? 'studio' : 'classic';"));
      }
      if (original.startsWith('/studio/') && pathname === '/turdrush.html') {
        bytes = Buffer.from(bytes.toString().replace('<html ', '<html data-arcade-audio="studio" '));
      }
      response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(bytes);
    } catch {response.writeHead(404).end();}
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
  // CI has no physical GPU. SwiftShader supplies a real software WebGL2 context;
  // capability failure is separately tested without substituting a renderer.
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
});
afterAll(async () => {
  await browser?.close();
  if (server) {await new Promise(done => server.close(done));}
});

async function capture(page, name) {
  const directory = process.env.ARCADE_RUNNER_SCREENSHOTS;
  if (!directory) {return;}
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: resolve(directory, name + '.png'), fullPage: true });
}
async function withPage(name, options, run) {
  const viewport = options.viewport || { width: 1280, height: 900 };
  const page = await browser.newPage({ viewport, hasTouch: viewport.width < 1000, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.addInitScript(({ denied, unsupported }) => {
      if (denied) {
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new globalThis.DOMException('Denied', 'SecurityError'); } });
      } else {
        localStorage.setItem('turdsuite_muted', '1');
        localStorage.setItem('stalemate.music', 'off');
      }
      if (unsupported) {
        const nativeContext = globalThis.HTMLCanvasElement.prototype.getContext;
        globalThis.HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
          return kind === 'webgl2' ? null : Reflect.apply(nativeContext, this, [kind, ...args]);
        };
      }
    }, { denied: options.denied || false, unsupported: options.unsupported || false });
    await page.goto(base + (options.prefix || '') + '/turdrush.html');
    await page.waitForFunction(() => globalThis.__turdrush && globalThis.SuiteLoading?.state === 'ready');
    if (!options.unsupported) {
      expect(await page.evaluate(() => globalThis.__turdrush.diagnostics.available)).toBe(true);
      expect(await page.locator('#rush-start').isEnabled()).toBe(true);
    }
    await run(page);
    expect(errors).toEqual([]);
    await capture(page, name);
  } catch (error) {
    await capture(page, name + '-FIRST-FAILURE');
    throw error;
  } finally {await page.close();}
}
const state = page => page.evaluate(() => globalThis.__turdrush.state);
const progress = page => page.evaluate(() => globalThis.SuiteProgress.snapshot());
async function begin(page) {
  await page.locator('#rush-start').click();
  await page.waitForFunction(() => globalThis.__turdrush.state.phase === 'running' && globalThis.__turdrush.state.distance > 0);
}
async function frozen(page) {
  const before = await state(page);
  await page.waitForTimeout(180); // Verify that a paused/finished run stays frozen across actual RAF ticks.
  expect(await state(page)).toEqual(before);
}
async function resume(page) {
  const distance = (await state(page)).distance;
  await page.locator('#rush-resume').click();
  await page.waitForFunction(from => globalThis.__turdrush.state.phase === 'running' && globalThis.__turdrush.state.distance > from, distance);
}

describe.skipIf(!available)('native Turd Rush interface', () => {
  it('starts real WebGL rendering and accepts native buttons/keys without repeating held actions', async () => {
    await withPage('native-input', {}, async page => {
      expect((await state(page)).phase).toBe('ready');
      await begin(page);
      expect(await page.evaluate(() => globalThis.__turdrush.diagnostics.drawCalls)).toBeGreaterThan(0);
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(() => globalThis.__turdrush.state.player.x <= -2.39);
      await page.keyboard.down('ArrowRight');
      await page.waitForFunction(() => globalThis.__turdrush.state.player.lane === 1 && Math.abs(globalThis.__turdrush.state.player.x) < 0.01);
      await page.keyboard.down('ArrowRight'); // Browser sets repeat=true on a held second keydown.
      await page.waitForTimeout(180);
      expect((await state(page)).player.lane).toBe(1);
      await page.keyboard.up('ArrowRight');
      await page.locator('[data-rush-action="jump"]').click();
      await page.waitForFunction(() => globalThis.__turdrush.state.player.y > 0.5);
      await page.evaluate(() => {
        // Read-only observers bracket each native event's actual game handler.
        // Do not assume the720ms slide remains active across automation IPC.
        globalThis.__runnerSlideSamples = [];
        let current = null;
        document.addEventListener('pointerdown', event => {
          if (event.target.closest?.('[data-rush-action="slide"]')) {
            current = { before: globalThis.__turdrush.state.player.slide };
          }
        }, true);
        document.addEventListener('pointerdown', event => {
          if (current && event.target.closest?.('[data-rush-action="slide"]')) {
            current.after = globalThis.__turdrush.state.player.slide;
            globalThis.__runnerSlideSamples.push(current); current = null;
          }
        });
      });
      await page.locator('[data-rush-action="slide"]').dblclick({ delay: 20 });
      const samples = await page.evaluate(() => globalThis.__runnerSlideSamples);
      expect(samples).toHaveLength(2);
      expect(samples[0].before).toBe(0);
      expect(samples[0].after).toBe(0.72);
      expect(samples[1].before).toBeGreaterThan(0);
      expect(samples[1].after).toBe(samples[1].before);
      expect((await state(page)).phase).toBe('running');
      await page.locator('#rush-pause').click();
      await frozen(page);
    });
  });

  it('recognizes a real touch swipe once and drops a cancelled gesture', async () => {
    await withPage('native-touch', { viewport: { width: 390, height: 844 } }, async page => {
      await begin(page);
      const box = await page.locator('#rush-canvas').boundingBox();
      const client = await page.context().newCDPSession(page);
      const x = box.x + box.width * 0.6, y = box.y + box.height * 0.65;
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 65, y }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 95, y }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(() => globalThis.__turdrush.state.player.x <= -2.39);
      expect((await state(page)).player.lane).toBe(0);
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 5, y }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await page.waitForTimeout(180);
      expect((await state(page)).player.lane).toBe(0);
      await client.detach();
      await page.locator('#rush-pause').click();
    });
  });

  it('holds help and pause gates until deliberate Resume and does not replay held keyboard input', async () => {
    await withPage('native-pause-help', {}, async page => {
      await begin(page);
      await page.locator('#rush-help').click();
      expect(await page.locator('#rush-guide').evaluate(dialog => dialog.open)).toBe(true);
      expect((await state(page)).phase).toBe('paused');
      expect(await page.evaluate(() => globalThis.Suite.getSoundState().paused)).toBe(true);
      await page.keyboard.press('ArrowRight');
      await frozen(page);
      await page.locator('#rush-contrast').click();
      expect(await page.locator('#rush-contrast').getAttribute('aria-pressed')).toBe('true');
      expect(await page.evaluate(() => globalThis.__turdrush.diagnostics.highContrast)).toBe(true);
      expect(await page.evaluate(() => globalThis.Suite.isColorblindMode())).toBe(true);
      await frozen(page);
      await page.locator('#rush-close-help').click();
      expect((await state(page)).phase).toBe('paused');
      await frozen(page);
      await resume(page);
      expect((await state(page)).player.lane).toBe(1);
      await page.keyboard.down('p');
      await page.keyboard.down('p');
      expect((await state(page)).phase).toBe('paused');
      await page.keyboard.up('p');
      await frozen(page);
    });
  });

  it('requires explicit Resume after simulated backgrounding and actual viewport rotation', async () => {
    await withPage('native-interruption', { viewport: { width: 390, height: 844 } }, async page => {
      await begin(page);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new globalThis.Event('visibilitychange'));
      });
      expect((await state(page)).phase).toBe('paused');
      await frozen(page);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        document.dispatchEvent(new globalThis.Event('visibilitychange'));
        globalThis.dispatchEvent(new globalThis.Event('focus'));
      });
      await frozen(page);
      await resume(page);
      await page.setViewportSize({ width: 568, height: 320 });
      await page.waitForFunction(() => globalThis.__turdrush.state.phase === 'paused');
      await frozen(page);
      await resume(page);
      expect((await state(page)).phase).toBe('running');
      await page.locator('#rush-pause').click();
    });
  });

  it('uses the production studio-profile Audio dialog without advancing the run or auto-resuming', async () => {
    await withPage('native-studio-audio', { prefix: '/studio' }, async page => {
      await begin(page);
      expect(await page.evaluate(() => globalThis.Suite.isStudioAudio())).toBe(true);
      await page.getByRole('button', { name: 'Audio settings', exact: true }).click();
      expect(await page.locator('#suite-audio-settings').evaluate(dialog => dialog.open)).toBe(true);
      expect((await state(page)).phase).toBe('paused');
      await frozen(page);
      await page.locator('#suite-effects-level').focus();
      await page.keyboard.press('Home');
      for (let step = 0; step < 7; step++) {await page.keyboard.press('ArrowRight');}
      expect(await page.locator('#suite-effects-level').inputValue()).toBe('35');
      expect(await page.evaluate(() => globalThis.Suite.getEffectsVolume())).toBe(0.35);
      await page.locator('#suite-effects-close').click();
      expect((await state(page)).phase).toBe('paused');
      await frozen(page);
      await resume(page);
      expect(await page.evaluate(() => globalThis.Suite.getSoundState().paused)).toBe(false);
      await page.locator('#rush-pause').click();
    });
  });

  it('plays with denied storage and never needs persistence to bind native controls', async () => {
    await withPage('native-storage-denied', { denied: true, viewport: { width: 320, height: 568 } }, async page => {
      await begin(page);
      await page.locator('[data-rush-action="jump"]').click();
      await page.waitForFunction(() => globalThis.__turdrush.state.player.y > 0.2);
      await page.locator('#rush-pause').click();
      await frozen(page);
      await resume(page);
      expect((await state(page)).phase).toBe('running');
      await page.locator('#rush-pause').click();
    });
  });

  it('records one collision result per run and accepts one fresh run across native double-tap replay', async () => {
    await withPage('native-terminal-fixture', { prefix: '/fixture' }, async page => {
      expect((await progress(page)).history.turdrush).toBeUndefined();
      await page.locator('#rush-start').click();
      await page.locator('#rush-results').waitFor({ state: 'visible' });
      expect((await state(page)).reason).toBe('barrier');
      let record = await progress(page);
      expect(record.history.turdrush).toHaveLength(1);
      expect(record.history.turdrush[0]).toMatchObject({ distance: 512, picks: 5, kind: 'run', outcome: 'complete' });
      expect(record.earned['rush-distance']).toBeTruthy();
      const firstId = record.history.turdrush[0].id;
      await frozen(page);
      expect((await progress(page)).history.turdrush).toHaveLength(1);
      await page.getByRole('button', { name: 'Share score', exact: true }).click();
      await page.waitForFunction(() => /copied|Select and copy/i.test(document.querySelector('.suite-result-share-status').textContent));
      // A genuine native double tap may start one fresh run. It must not create
      // two starts/results; assertions above do not assume the550ms guard is
      // still active after asynchronous storage/share inspection.
      await page.locator('#rush-again').dblclick({ delay: 20 });
      await page.waitForFunction(() => globalThis.SuiteProgress.snapshot().history.turdrush.length === 2);
      record = await progress(page);
      expect(record.history.turdrush[1].id).not.toBe(firstId);
      const ids = record.history.turdrush.map(entry => entry.id);
      await frozen(page);
      await page.reload();
      await page.waitForFunction(() => globalThis.__turdrush && globalThis.SuiteLoading?.state === 'ready');
      expect((await state(page)).phase).toBe('ready');
      expect((await progress(page)).history.turdrush.map(entry => entry.id)).toEqual(ids);
    });
  });

  it('offers a usable renderer capability fallback while keeping unrelated saved data', async () => {
    await withPage('native-no-webgl', { unsupported: true }, async page => {
      expect(await page.evaluate(() => globalThis.__turdrush.diagnostics.available)).toBe(false);
      expect(await page.locator('#rush-unavailable').isVisible()).toBe(true);
      expect(await page.locator('#rush-unavailable-text').innerText()).toContain('records are safe');
      expect(await page.locator('#rush-reload').isEnabled()).toBe(true);
      expect(await page.locator('#rush-start').isDisabled()).toBe(true);
      await page.evaluate(() => localStorage.setItem('unrelated-player-progress', 'kept'));
      await page.locator('#rush-reload').click();
      await page.locator('#rush-unavailable').waitFor({ state: 'visible' });
      expect(await page.evaluate(() => localStorage.getItem('unrelated-player-progress'))).toBe('kept');
      expect(await page.locator('#rush-unavailable a').getAttribute('href')).toBe('./');
    });
  });

  it('pauses safely on a real WebGL context loss and retries without recording an unfinished run', async () => {
    await withPage('native-context-loss', {}, async page => {
      await begin(page);
      expect((await progress(page)).history.turdrush).toBeUndefined();
      const supported = await page.locator('#rush-canvas').evaluate(canvas => {
        const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
        if (!extension) {return false;}
        extension.loseContext(); return true;
      });
      expect(supported).toBe(true);
      await page.locator('#rush-unavailable').waitFor({ state: 'visible' });
      expect((await state(page)).phase).toBe('paused');
      expect(await page.evaluate(() => globalThis.__turdrush.diagnostics.available)).toBe(false);
      await frozen(page);
      expect((await progress(page)).history.turdrush).toBeUndefined();
      await page.locator('#rush-reload').click();
      await page.waitForFunction(() => globalThis.__turdrush?.diagnostics.available && globalThis.SuiteLoading?.state === 'ready');
      expect((await state(page)).phase).toBe('ready');
      await begin(page);
      expect((await state(page)).distance).toBeLessThan(20);
      expect((await progress(page)).history.turdrush).toBeUndefined();
      await page.locator('#rush-pause').click();
    });
  });

  for (const prefix of ['', '/studio']) {
    for (const [width, height] of [[320, 568], [568, 320]]) {
      it(`keeps real controls hittable without overlap at${width}x${height}${prefix || '/classic'}`, async () => {
        await withPage(`native-geometry-${prefix ? 'studio' : 'classic'}-${width}x${height}`, { prefix, viewport: { width, height } }, async page => {
          await page.evaluate(() => document.fonts.ready);
          const start = await page.locator('#rush-start').evaluate(button => {
            const box = button.getBoundingClientRect();
            const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            return { visible: hit === button || button.contains(hit), top: box.top, bottom: box.bottom };
          });
          expect(start.visible).toBe(true);
          expect(start.top).toBeGreaterThanOrEqual(0);
          expect(start.bottom).toBeLessThanOrEqual(height);
          await begin(page);
          const geometry = await page.evaluate(() => {
            const selectors = ['.rush-hub', '#rush-help', '#rush-mute', '#rush-pause', ...[...document.querySelectorAll('[data-rush-action]')].map(button => `[data-rush-action="${button.dataset.rushAction}"]`)];
            for (const selector of ['.suite-audio-open', '#suite-music-toggle', '#suite-arcade-a11y-toggle']) {
              if (document.querySelector(selector)?.checkVisibility()) {selectors.push(selector);}
            }
            const controls = selectors.map(selector => {
              const button = document.querySelector(selector), box = button.getBoundingClientRect();
              const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
              return { selector, box: box.toJSON(), hit: hit === button || button.contains(hit) };
            });
            return { controls, width: globalThis.innerWidth, scrollWidth: document.documentElement.scrollWidth, arena: document.querySelector('#rush-arena').getBoundingClientRect().toJSON() };
          });
          expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
          expect(geometry.arena.height).toBeGreaterThanOrEqual(140);
          for (const control of geometry.controls) {
            expect(control.hit, control.selector).toBe(true);
            expect(control.box.width, control.selector).toBeGreaterThanOrEqual(44);
            expect(control.box.height, control.selector).toBeGreaterThanOrEqual(44);
            expect(control.box.left, control.selector).toBeGreaterThanOrEqual(0);
            expect(control.box.right, control.selector).toBeLessThanOrEqual(width);
            expect(control.box.top, control.selector).toBeGreaterThanOrEqual(0);
            expect(control.box.bottom, control.selector).toBeLessThanOrEqual(height);
          }
          for (let a = 0; a < geometry.controls.length; a++) {
            for (let b = a + 1; b < geometry.controls.length; b++) {
              const first = geometry.controls[a], second = geometry.controls[b];
              const intersection = Math.max(0, Math.min(first.box.right, second.box.right) - Math.max(first.box.left, second.box.left)) * Math.max(0, Math.min(first.box.bottom, second.box.bottom) - Math.max(first.box.top, second.box.top));
              expect(intersection, `${first.selector} vs ${second.selector}`).toBe(0);
            }
          }
          await page.locator('#rush-pause').click();
        });
      });
    }
  }
});
