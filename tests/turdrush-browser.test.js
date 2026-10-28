// @vitest-environment node
// Native controls/RAF/rendering. /fixture/ replaces only createRun at this
// isolated test server with a labeled complete collision fixture, never a forced
// result callback. /studio/ applies Rad Dad's exact SDK audio-profile adaptation.
import { Buffer } from 'node:buffer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { availableParallelism, freemem, loadavg } from 'node:os';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it, onTestFailed, onTestFinished } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const available = existsSync(chromium.executablePath());
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
let browser, server, base;

beforeAll(async () => {
  if (!available) {return;}
  server = createServer(async (request, response) => {
    const original = new URL(request.url, 'http://localhost').pathname;
    const pathname = original.replace(/^\/(?:fixture|audio-fixture|studio)\//, '/');
    const file = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!file.startsWith(root + sep)) {response.writeHead(403).end(); return;}
    try {
      let bytes = await readFile(file);
      const audioFixture = original.startsWith('/audio-fixture/');
      if ((original.startsWith('/fixture/') || audioFixture) && pathname === '/games/turdrush-core.js') {
        const source = bytes.toString();
        const declaration = 'export function createRun(seed = 1)';
        if (!source.includes(declaration)) {throw new Error('Update the explicit core fixture adapter.');}
        bytes = Buffer.from(source.replace(declaration, 'function fixtureActualCreateRun(seed = 1)') + `
export function createRun(seed = 1) {
  const state = fixtureActualCreateRun(seed);
  state.distance = 512; state.elapsed = 30; state.speed = 15; state.picks = 5;
  state.score = 5370; state.entities = ${audioFixture ? JSON.stringify([{ id: 9000, kind: 'pick', lane: 1, at: 513 }, { id: 9001, kind: 'shield', lane: 1, at: 513 }, { id: 9002, kind: 'barrier', lane: 1, at: 516 }, { id: 9003, kind: 'barrier', lane: 1, at: 532 }]) : JSON.stringify([{ id: 9000, kind: 'barrier', lane: 1, at: 513 }])};
  state._nextChunk = 1e9; return state;
}
`);
      }
      if (audioFixture && pathname === '/games/turdrush-renderer.js') {
        bytes = Buffer.from(bytes.toString() + `
+const observedReset = TurdRushRenderer.prototype.resetRun;
+TurdRushRenderer.prototype.resetRun = function (...args) {
+  const before = { elapsed: this.elapsed, shake: this.shake || 0, sparks: this.sparks.length };
+  const returned = Reflect.apply(observedReset, this, args);
+  (globalThis.__runnerResetObservations ||= []).push({ before, after: { elapsed: this.elapsed, shake: this.shake || 0, sparks: this.sparks.length } });
+  return returned;
+};
+`.replace(/^\+/gm, ''));
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
  const touches = await page.evaluate(() => globalThis.__runnerTouchSamples);
  if (touches) {await writeFile(resolve(directory, name + '-touch-events.json'), JSON.stringify(touches, null, 2));}
}
function mark(page, label) {
  const info = page.runnerTestInfo;
  if (!info) {return;}
  info.steps.push({ afterMs: Date.now() - info.startedMs, label });
  if (info.steps.length > 48) {info.steps.shift();}
}
async function bounded(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([promise, new Promise(done => {timer = setTimeout(() => done({ diagnosticTimedOutMs: milliseconds }), milliseconds);})]);
  } catch (error) {return { diagnosticError: error.message };}
  finally {clearTimeout(timer);}
}
async function withPage(name, options, run) {
  const viewport = options.viewport || { width: 1280, height: 900 };
  const info = { name, startedAt: new Date().toISOString(), startedMs: Date.now(),
    availableCPUs: availableParallelism(), loadAtStart: loadavg(), freeMiBAtStart: Math.round(freemem() / 1024 / 1024),
    steps: [{ afterMs: 0, label: 'create owned Chromium page' }] };
  let page = null, reported = false;
  const errors = [];
  const reportFailure = async failure => {
    if (reported) {return;}
    reported = true;
    const frozenInfo = { ...info, steps: info.steps.map(step => ({ ...step })) };
    const failureObservedAt = new Date().toISOString();
    const snapshot = page && !page.isClosed() ? await bounded(page.evaluate(() => {
      const state = globalThis.__turdrush?.state;
      const panel = id => {const node = document.getElementById(id); return node ? { visible: node.checkVisibility(), open: !!node.open, disabled: !!node.disabled } : null;};
      return { url: globalThis.location.href, atMs: Math.round(globalThis.performance.now()), hidden: document.hidden, loading: globalThis.SuiteLoading?.state,
        audioLevel: document.getElementById('suite-effects-level')?.value,
        audioContexts: globalThis.__runnerNativeAudioContexts?.map(context => ({ state: context.state })),
        nativeAudioNodes: globalThis.__runnerNativeAudioNodes, studioCalls: globalThis.__runnerStudioCalls,
        bodyPhase: document.body?.dataset.rushPhase, activeElement: document.activeElement?.id,
        state: state ? { phase: state.phase, elapsed: state.elapsed, distance: state.distance, score: state.score, player: state.player } : null,
        renderer: globalThis.__turdrush?.diagnostics, timing: globalThis.__runnerTestTiming,
        glClears: globalThis.__runnerNativeGlClears,
        touchSamples: globalThis.__runnerTouchSamples,
        panels: Object.fromEntries(['rush-intro', 'rush-paused', 'rush-results', 'rush-unavailable', 'rush-guide', 'suite-audio-settings', 'rush-start', 'rush-resume', 'rush-pause'].map(id => [id, panel(id)])) };
    }), 1500) : { pageUnavailable: true };
    const diagnostic = { ...frozenInfo, failureObservedAt, elapsedMs: Date.now() - info.startedMs, failure,
      loadAtFailure: loadavg(), freeMiBAtFailure: Math.round(freemem() / 1024 / 1024), pageErrors: errors, snapshot };
    console.error('[turdrush-first-failure] ' + JSON.stringify(diagnostic));
    const directory = process.env.ARCADE_RUNNER_SCREENSHOTS || (process.env.CI ? resolve(root, 'test-results/turdrush') : null);
    if (directory) {
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, name + '-FIRST-FAILURE.json'), JSON.stringify(diagnostic, null, 2));
      if (page && !page.isClosed()) {
        await bounded(page.screenshot({ path: resolve(directory, name + '-FIRST-FAILURE.png'), timeout: 1500 }), 1600);
      }
    }
  };
  // Vitest's test-wide timeout does not throw through an outstanding Playwright
  // promise immediately. Preserve its actual last stage before closing the page.
  onTestFailed(context => reportFailure(context.task.result?.errors?.map(error => error.message) || ['Vitest marked the unchanged-deadline test failed']));
  onTestFinished(async () => {if (page && !page.isClosed()) {await page.close();}});
  console.info('[turdrush-test-start] ' + JSON.stringify({ name, startedAt: info.startedAt, availableCPUs: info.availableCPUs, loadAtStart: info.loadAtStart }));
  try {
    page = await browser.newPage({ viewport, hasTouch: viewport.width < 1000, reducedMotion: options.reducedMotion || 'reduce' });
    page.runnerTestInfo = info;
    page.on('pageerror', error => errors.push(error.message));
    mark(page, 'install read-only timing observer and isolated preferences');
    await page.addInitScript(({ denied, unsupported, observeGL, observeAudio, unmuted }) => {
      if (observeAudio) {
        globalThis.__runnerNativeAudioContexts = [];
        globalThis.__runnerNativeAudioNodes = [];
        for (const name of ['AudioContext', 'webkitAudioContext']) {
          const Native = globalThis[name];
          if (typeof Native !== 'function') {continue;}
          globalThis[name] = new Proxy(Native, {
            construct(Target, args) {
              const context = Reflect.construct(Target, args);
              globalThis.__runnerNativeAudioContexts.push(context);
              return context;
            }
          });
        }
        for (const name of ['AudioBufferSourceNode', 'OscillatorNode']) {
          const prototype = globalThis[name]?.prototype, nativeStart = prototype?.start;
          if (!nativeStart) {continue;}
          prototype.start = function (...args) {
            globalThis.__runnerNativeAudioNodes.push({ type: name, state: this.context.state, atMs: Math.round(globalThis.performance.now()) });
            return Reflect.apply(nativeStart, this, args);
          };
        }
      }
      // Cheap counters only: do not clone gameplay state or change media/clocks.
      const timing = { frames: 0, maxFrameGapMs: 0, framesOver100ms: 0, timerSamples: 0, maxTimerDelayMs: 0, inputs: [] };
      let previousFrame = 0, previousTimer = globalThis.performance.now();
      const frame = now => {
        if (previousFrame) {
          const gap = now - previousFrame;
          timing.maxFrameGapMs = Math.max(timing.maxFrameGapMs, Math.round(gap));
          if (gap > 100) {timing.framesOver100ms++;}
        }
        previousFrame = now; timing.frames++;
        globalThis.requestAnimationFrame(frame);
      };
      globalThis.requestAnimationFrame(frame);
      globalThis.setInterval(() => {
        const now = globalThis.performance.now();
        timing.maxTimerDelayMs = Math.max(timing.maxTimerDelayMs, Math.round(Math.max(0, now - previousTimer - 250)));
        timing.timerSamples++; previousTimer = now;
      }, 250);
      for (const type of ['keydown', 'pointerdown']) {
        document.addEventListener(type, event => {
          timing.inputs.push({ atMs: Math.round(globalThis.performance.now()), type, key: event.key, repeat: event.repeat,
            target: event.target.closest?.('button,a,canvas,input')?.id || event.target.closest?.('[data-rush-action]')?.dataset.rushAction || event.target.nodeName });
          if (timing.inputs.length > 16) {timing.inputs.shift();}
        }, { capture: true, passive: true });
      }
      globalThis.__runnerTestTiming = timing;
      if (observeGL) {
        globalThis.__runnerNativeGlClears = 0;
        const prototype = globalThis.WebGL2RenderingContext?.prototype;
        const nativeClear = prototype?.clear;
        if (nativeClear) {
          prototype.clear = function (...args) {
            globalThis.__runnerNativeGlClears++;
            return Reflect.apply(nativeClear, this, args);
          };
        }
      }
      if (denied) {
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new globalThis.DOMException('Denied', 'SecurityError'); } });
      } else {
        localStorage.setItem('turdsuite_muted', unmuted ? '0' : '1');
        localStorage.setItem('stalemate.music', 'off');
      }
      if (unsupported) {
        const nativeContext = globalThis.HTMLCanvasElement.prototype.getContext;
        globalThis.HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
          return kind === 'webgl2' ? null : Reflect.apply(nativeContext, this, [kind, ...args]);
        };
      }
    }, { denied: options.denied || false, unsupported: options.unsupported || false, observeGL: options.observeGL || false, observeAudio: options.observeAudio || false, unmuted: options.unmuted || false });
    mark(page, 'navigate runner page');
    await page.goto(base + (options.prefix || '') + '/turdrush.html');
    mark(page, 'wait shared ready and read-only runner API');
    await page.waitForFunction(() => globalThis.__turdrush && globalThis.SuiteLoading?.state === 'ready');
    if (!options.unsupported) {
      expect(await page.evaluate(() => globalThis.__turdrush.diagnostics.available)).toBe(true);
      expect(await page.locator('#rush-start').isEnabled()).toBe(true);
    }
    mark(page, 'native test body');
    await run(page);
    expect(errors).toEqual([]);
    await capture(page, name);
    console.info('[turdrush-test-pass] ' + JSON.stringify({ name, elapsedMs: Date.now() - info.startedMs, lastStage: info.steps.at(-1)?.label }));
  } catch (error) {
    await reportFailure(error.message);
    throw error;
  } finally {if (page && !page.isClosed()) {await page.close();}}
}
const state = page => {mark(page, 'read-only runner state'); return page.evaluate(() => globalThis.__turdrush.state);};
const progress = page => {mark(page, 'read-only progress snapshot'); return page.evaluate(() => globalThis.SuiteProgress.snapshot());};
async function begin(page) {
  mark(page, 'page.locator(\'#rush-start\').click()');
  await page.locator('#rush-start').click();
  mark(page, 'page.waitForFunction(() => globalThis.__turdrush.state.phase === \'running\' && globalThis.__turdrush.state.distance > 0)');
  await page.waitForFunction(() => globalThis.__turdrush.state.phase === 'running' && globalThis.__turdrush.state.distance > 0);
}
async function frozen(page) {
  const before = await state(page);
  mark(page, 'page.waitForTimeout(180); // Verify that a paused/finished run stays frozen across actual RAF ticks.');
  await page.waitForTimeout(180); // Verify that a paused/finished run stays frozen across actual RAF ticks.
  expect(await state(page)).toEqual(before);
}
async function resume(page) {
  const distance = (await state(page)).distance;
  mark(page, 'page.locator(\'#rush-resume\').click()');
  await page.locator('#rush-resume').click();
  mark(page, 'page.waitForFunction(from => globalThis.__turdrush.state.phase === \'running\' && globalThis.__turdrush.state.distance > from, distance)');
  await page.waitForFunction(from => globalThis.__turdrush.state.phase === 'running' && globalThis.__turdrush.state.distance > from, distance);
}
async function observeTouches(page) {
  await page.evaluate(() => {
    globalThis.__runnerTouchSamples = [];
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      document.addEventListener(type, event => {
        const state = globalThis.__turdrush.state;
        globalThis.__runnerTouchSamples.push({ type, at: globalThis.performance.now(), id: event.pointerId, primary: event.isPrimary,
          trusted: event.isTrusted, x: event.clientX, y: event.clientY, lane: state.player.lane, cooldown: state._laneCooldown });
        if (globalThis.__runnerTouchSamples.length > 128) {globalThis.__runnerTouchSamples.shift();}
      }, { capture: true, passive: true });
    }
  });
}
async function flickPackets(page, directions, firstId = 31) {
  const box = await page.locator('#rush-canvas').boundingBox();
  const x = Math.round(box.x + box.width * .5), y = Math.round(box.y + box.height * .65);
  return directions.flatMap((direction, index) => {
    const point = atX => ({ id: firstId + index, x: atX, y, radiusX: 3, radiusY: 3, force: 1 });
    return [
      { type: 'touchStart', touchPoints: [point(x)] },
      { type: 'touchMove', touchPoints: [point(x + (direction === 'left' ? -70 : 70))] },
      { type: 'touchEnd', touchPoints: [] }
    ];
  });
}
async function nativeBurst(client, packets) {
  // The protocol connection preserves packet order; await all receipts after
  // sending one deliberate input burst so IPC does not pace the user's flicks.
  await Promise.all(packets.map(packet => client.send('Input.dispatchTouchEvent', packet)));
}

describe.skipIf(!available)('native Turd Rush interface', () => {
  it('starts real WebGL rendering and accepts native buttons/keys without repeating held actions', async () => {
    await withPage('native-input', {}, async page => {
      expect((await state(page)).phase).toBe('ready');
      await begin(page);
      expect(await page.evaluate(() => globalThis.__turdrush.diagnostics.drawCalls)).toBeGreaterThan(0);
      mark(page, 'page.keyboard.press(\'ArrowLeft\')');
      await page.keyboard.press('ArrowLeft');
      mark(page, 'page.waitForFunction(() => globalThis.__turdrush.state.player.x <= -2.39)');
      await page.waitForFunction(() => globalThis.__turdrush.state.player.x <= -2.39);
      mark(page, 'page.keyboard.down(\'ArrowRight\')');
      await page.keyboard.down('ArrowRight');
      mark(page, 'page.waitForFunction(() => globalThis.__turdrush.state.player.lane === 1 && Math.abs(globalThis.__turdrush.state.player.x) < 0.01)');
      await page.waitForFunction(() => globalThis.__turdrush.state.player.lane === 1 && Math.abs(globalThis.__turdrush.state.player.x) < 0.01);
      mark(page, 'page.keyboard.down(\'ArrowRight\'); // Browser sets repeat=true on a held second keydown.');
      await page.keyboard.down('ArrowRight'); // Browser sets repeat=true on a held second keydown.
      mark(page, 'page.waitForTimeout(180)');
      await page.waitForTimeout(180);
      expect((await state(page)).player.lane).toBe(1);
      mark(page, 'page.keyboard.up(\'ArrowRight\')');
      await page.keyboard.up('ArrowRight');
      mark(page, 'page.locator(\'[data-rush-action="jump"]\').click()');
      await page.locator('[data-rush-action="jump"]').click();
      mark(page, 'page.waitForFunction(() => globalThis.__turdrush.state.player.y > 0.5)');
      await page.waitForFunction(() => globalThis.__turdrush.state.player.y > 0.5);
      mark(page, 'page.evaluate(() => {');
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
      mark(page, 'page.locator(\'[data-rush-action="slide"]\').dblclick({ delay: 20 })');
      await page.locator('[data-rush-action="slide"]').dblclick({ delay: 20 });
      const samples = await page.evaluate(() => globalThis.__runnerSlideSamples);
      expect(samples).toHaveLength(2);
      expect(samples[0].before).toBe(0);
      expect(samples[0].after).toBe(0.72);
      expect(samples[1].before).toBeGreaterThan(0);
      expect(samples[1].after).toBe(samples[1].before);
      expect((await state(page)).phase).toBe('running');
      mark(page, 'page.locator(\'#rush-pause\').click()');
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
      mark(page, 'page.waitForFunction(() => globalThis.__turdrush.state.player.x <= -2.39)');
      await page.waitForFunction(() => globalThis.__turdrush.state.player.x <= -2.39);
      expect((await state(page)).player.lane).toBe(0);
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 5, y }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      mark(page, 'page.waitForTimeout(180)');
      await page.waitForTimeout(180);
      expect((await state(page)).player.lane).toBe(0);
      await client.detach();
      mark(page, 'page.locator(\'#rush-pause\').click()');
      await page.locator('#rush-pause').click();
    });
  });

  it('keeps rapid corrective horizontal touch flicks instead of consuming a cooldown-rejected swipe', async () => {
    await withPage('native-touch-corrective', { viewport: { width: 390, height: 844 } }, async page => {
      await begin(page);
      await page.evaluate(() => {
        globalThis.__runnerTouchSamples = [];
        for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
          document.addEventListener(type, event => {
            if (event.target.id !== 'rush-canvas') {return;}
            const state = globalThis.__turdrush.state;
            globalThis.__runnerTouchSamples.push({ type, at: globalThis.performance.now(), id: event.pointerId, primary: event.isPrimary,
              x: event.clientX, y: event.clientY, lane: state.player.lane, cooldown: state._laneCooldown });
          }, { capture: true, passive: true });
        }
      });
      const box = await page.locator('#rush-canvas').boundingBox();
      const client = await page.context().newCDPSession(page);
      const x = Math.round(box.x + box.width * .5), y = Math.round(box.y + box.height * .65);
      const point = (id, atX) => ({ id, x: atX, y, radiusX: 3, radiusY: 3, force: 1 });
      mark(page, 'two actual touch flicks: left then immediately corrective right');
      try {
        // Queue ordered native protocol packets before awaiting replies. Slow
        // automation round trips must not turn a rapid human correction into
        // two gestures separated by more than the actual100ms cooldown.
        const packets = [
          { type: 'touchStart', touchPoints: [point(11, x)] },
          { type: 'touchMove', touchPoints: [point(11, x - 70)] },
          { type: 'touchEnd', touchPoints: [] },
          { type: 'touchStart', touchPoints: [point(12, x)] },
          { type: 'touchMove', touchPoints: [point(12, x + 70)] },
          { type: 'touchEnd', touchPoints: [] }
        ];
        await Promise.all(packets.map(packet => client.send('Input.dispatchTouchEvent', packet)));
        const samples = await page.evaluate(() => globalThis.__runnerTouchSamples);
        if (process.env.ARCADE_RUNNER_SCREENSHOTS) {
          await mkdir(process.env.ARCADE_RUNNER_SCREENSHOTS, { recursive: true });
          await writeFile(resolve(process.env.ARCADE_RUNNER_SCREENSHOTS, 'native-touch-corrective-events.json'), JSON.stringify(samples, null, 2));
        }
        await page.waitForFunction(() => globalThis.__turdrush.state.player.lane === 1, null, { timeout: 1500 });
        expect(samples.filter(sample => sample.type === 'pointermove')).toHaveLength(2);
        expect(samples.some(sample => sample.lane === 0)).toBe(true);
        expect((await state(page)).player.lane).toBe(1);
        await page.locator('#rush-pause').click();
      } finally {await client.detach();}
    });
  });

  it('keeps the owner swipe when a second touch releases its implicit pointer capture', async () => {
    await withPage('native-touch-owner', { viewport: { width: 390, height: 844 } }, async page => {
      await begin(page);
      await page.evaluate(() => {
        globalThis.__runnerTouchSamples = [];
        for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
          document.addEventListener(type, event => {
            const state = globalThis.__turdrush.state;
            globalThis.__runnerTouchSamples.push({ type, id: event.pointerId, primary: event.isPrimary, x: event.clientX, y: event.clientY, lane: state.player.lane });
          }, { capture: true, passive: true });
        }
      });
      const box = await page.locator('#rush-canvas').boundingBox();
      const client = await page.context().newCDPSession(page);
      const x = Math.round(box.x + box.width * .5), y = Math.round(box.y + box.height * .65);
      const point = (id, atX = x, atY = y) => ({ id, x: atX, y: atY, radiusX: 3, radiusY: 3, force: 1 });
      try {
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(21)] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(21), point(22, x + 55, y + 40)] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(21), point(22, x + 56, y + 40)] });
        const secondaryId = await page.evaluate(() => globalThis.__runnerTouchSamples.find(sample => sample.type === 'pointerdown' && !sample.primary).id);
        // Exercise the actual browser's capture lifecycle, not a synthetic game
        // action: only the secondary contact loses its native implicit capture.
        await page.locator('#rush-canvas').evaluate((canvas, id) => canvas.releasePointerCapture(id), secondaryId);
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(21), point(22, x + 60, y + 40)] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(21, x - 70), point(22, x + 60, y + 40)] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForFunction(() => globalThis.__turdrush.state.player.lane === 0, null, { timeout: 1500 });
        const samples = await page.evaluate(() => globalThis.__runnerTouchSamples);
        const lost = samples.findIndex(sample => sample.type === 'lostpointercapture' && !sample.primary);
        const moved = samples.findIndex(sample => sample.type === 'pointermove' && sample.primary && sample.x === x - 70);
        expect(lost).toBeGreaterThanOrEqual(0);
        expect(lost).toBeLessThan(moved);
        expect((await state(page)).player.lane).toBe(0);
        await page.locator('#rush-pause').click();
      } finally {await client.detach();}
    });
  });

  async function expectLaneTargets(page, name, cases) {
    await begin(page); await observeTouches(page);
    const client = await page.context().newCDPSession(page), outcomes = [];
    try {
      for (let index = 0; index < cases.length; index++) {
        const [from, directions, target, paced, firstId] = cases[index];
        if (index) {
          await page.locator('#rush-pause').click();
          await page.locator('#rush-restart-paused').click();
        }
        if (from !== 1) {await page.keyboard.press(from === 0 ? 'ArrowLeft' : 'ArrowRight');}
        await page.waitForFunction(lane => globalThis.__turdrush.state.player.lane === lane
          && Math.abs(globalThis.__turdrush.state.player.x - (lane - 1) * 2.4) < .01, from);
        const packets = await flickPackets(page, directions, firstId);
        mark(page, `native${paced ? ' paced40ms' : ' fast'} flicks from${from}: ${directions.join(',')}`);
        if (paced) {
          for (let cursor = 0; cursor < packets.length; cursor += 3) {
            await nativeBurst(client, packets.slice(cursor, cursor + 3));
            if (cursor + 3 < packets.length) {await page.waitForTimeout(paced);}
          }
        } else {await nativeBurst(client, packets);}
        await page.waitForTimeout(350); // Complete the bounded250ms intent and real lane interpolation.
        const after = await state(page);
        outcomes.push({ from, directions, target, paced: paced || 0, player: after.player, elapsed: after.elapsed });
        expect(after.phase).toBe('running');
        expect(after.player.lane, JSON.stringify(outcomes.at(-1))).toBe(target);
        expect(after.player.x).toBeCloseTo((target - 1) * 2.4, 2);
      }
      if (process.env.ARCADE_RUNNER_SCREENSHOTS) {
        await mkdir(process.env.ARCADE_RUNNER_SCREENSHOTS, { recursive: true });
        await writeFile(resolve(process.env.ARCADE_RUNNER_SCREENSHOTS, `${name}.json`), JSON.stringify(outcomes, null, 2));
      }
      await page.locator('#rush-pause').click();
    } finally {await client.detach();}
  }

  it('keeps a bounded lane target through double flicks and triple corrections', async () => {
    await withPage('native-touch-targets', { viewport: { width: 390, height: 844 } }, async page => {
      await expectLaneTargets(page, 'native-touch-target-cases', [
        [2, ['left', 'left', 'right'], 1, 0, 40], [0, ['right', 'right', 'left'], 1, 0, 44],
        [2, ['left', 'left'], 0, 0, 48], [0, ['right', 'right'], 2, 0, 52]
      ]);
    });
  });

  it('keeps a bounded lane target through edge corrections and paced opposite flicks', async () => {
    await withPage('native-touch-targets-edges', { viewport: { width: 390, height: 844 } }, async page => {
      await expectLaneTargets(page, 'native-touch-target-edge-cases', [
        [0, ['left', 'left', 'right'], 1, 0, 56], [2, ['right', 'right', 'left'], 1, 0, 60],
        [1, ['left', 'right'], 1, 40, 64]
      ]);
    });
  });

  it('attributes cancelled contacts correctly and drops pending swipe movement on Pause', async () => {
    await withPage('native-touch-cancel-pending', { viewport: { width: 390, height: 844 } }, async page => {
      await begin(page); await observeTouches(page);
      const client = await page.context().newCDPSession(page);
      const restart = async () => {
        if ((await state(page)).phase === 'running') {await page.locator('#rush-pause').click();}
        await page.locator('#rush-restart-paused').click();
        await page.waitForFunction(() => globalThis.__turdrush.state.phase === 'running');
      };
      try {
        mark(page, 'completed B flick survives new below-threshold C cancellation');
        let packets = await flickPackets(page, ['left', 'right', 'left'], 80);
        // Contact C starts but never crosses the action threshold.
        packets = [...packets.slice(0, 7), { type: 'touchCancel', touchPoints: [] }];
        await nativeBurst(client, packets);
        await page.waitForTimeout(350);
        expect((await state(page)).player.lane).toBe(1);

        await restart();
        mark(page, 'owner B cancellation drops its still-pending corrective flick');
        packets = await flickPackets(page, ['left', 'right'], 90);
        await nativeBurst(client, [...packets.slice(0, -1), { type: 'touchCancel', touchPoints: [] }]);
        await page.waitForTimeout(350);
        expect((await state(page)).player.lane).toBe(0);

        await restart();
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => globalThis.__turdrush.state.player.x > 2.39);
        mark(page, 'a clamped C flick does not steal B ownership before C cancels');
        packets = await flickPackets(page, ['left', 'left', 'left'], 100);
        await nativeBurst(client, [...packets.slice(0, -1), { type: 'touchCancel', touchPoints: [] }]);
        await page.waitForTimeout(350);
        expect((await state(page)).player.lane).toBe(0);

        await restart();
        mark(page, 'native Pause touch interrupts a queued correction before the next RAF');
        packets = await flickPackets(page, ['left', 'right'], 110);
        const pauseBox = await page.locator('#rush-pause').boundingBox();
        await nativeBurst(client, [...packets,
          { type: 'touchStart', touchPoints: [{ id: 120, x: Math.round(pauseBox.x + pauseBox.width / 2), y: Math.round(pauseBox.y + pauseBox.height / 2) }] },
          { type: 'touchEnd', touchPoints: [] }
        ]);
        expect((await state(page)).phase).toBe('paused');
        expect((await state(page)).player.lane).toBe(0);
        await frozen(page);
        await resume(page);
        await page.waitForTimeout(350);
        expect((await state(page)).player.lane).toBe(0);
        await page.locator('#rush-pause').click();
      } finally {await client.detach();}
    });
  });

  it('preserves an earlier completed flick through a simulated cancellation of a later native contact reusing its pointer ID', async () => {
    await withPage('native-reused-pointer-owner', { viewport: { width: 390, height: 844 } }, async page => {
      await begin(page); await observeTouches(page);
      await page.evaluate(() => {
        let contacts = 0, released = false;
        const canvas = document.getElementById('rush-canvas');
        canvas.addEventListener('pointerdown', () => contacts++);
        canvas.addEventListener('pointermove', event => {
          if (contacts === 3 && !released) {
            released = true;
            // Explicit lifecycle-boundary fixture only. Native mouse contacts
            // reuse id1; tightly batched CDP moves can coalesce before capture
            // activates. Route a cancellation without mutating game state/time.
            canvas.dispatchEvent(new globalThis.PointerEvent('pointercancel', {
              bubbles: true, pointerId: event.pointerId, pointerType: event.pointerType,
              isPrimary: event.isPrimary, clientX: event.clientX, clientY: event.clientY
            }));
          }
        });
      });
      const box = await page.locator('#rush-canvas').boundingBox();
      const x = Math.round(box.x + box.width * .5), y = Math.round(box.y + box.height * .65);
      const event = (type, atX, pressed) => ({ type, x: atX, y, button: type === 'mouseMoved' ? 'none' : 'left', buttons: pressed ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1 });
      const packets = [
        event('mouseMoved', x, false), event('mousePressed', x, true), event('mouseMoved', x - 70, true), event('mouseReleased', x - 70, false),
        event('mouseMoved', x, false), event('mousePressed', x, true), event('mouseMoved', x + 70, true), event('mouseReleased', x + 70, false),
        event('mouseMoved', x, false), event('mousePressed', x, true), event('mouseMoved', x + 2, true), event('mouseMoved', x + 3, true), event('mouseReleased', x + 3, false)
      ];
      const client = await page.context().newCDPSession(page);
      try {
        await Promise.all(packets.map(packet => client.send('Input.dispatchMouseEvent', packet)));
        await page.waitForTimeout(350);
        const samples = await page.evaluate(() => globalThis.__runnerTouchSamples);
        const downs = samples.filter(sample => sample.type === 'pointerdown');
        expect(downs).toHaveLength(3);
        expect(new Set(downs.map(sample => sample.id)).size).toBe(1);
        expect(samples.some(sample => sample.type === 'pointercancel' && !sample.trusted && sample.id === downs[2].id)).toBe(true);
        expect((await state(page)).player.lane).toBe(1);
        await page.locator('#rush-pause').click();
      } finally {await client.detach();}
    });
  });

  for (const [width, height] of [[320, 568], [390, 844], [568, 320]]) {
    it(`visually separates the inline intro words at${width}x${height}`, async () => {
      await withPage(`native-intro-word-gap-${width}`, { viewport: { width, height } }, async page => {
        await page.evaluate(() => document.fonts.ready);
        const heading = await page.locator('#rush-intro-title').evaluate(node => {
          const first = node.firstChild, next = node.querySelector('em').firstChild;
          const preceding = document.createRange(), following = document.createRange();
          const end = first.textContent.trimEnd().length;
          preceding.setStart(first, end - 1); preceding.setEnd(first, end);
          following.setStart(next, 0); following.setEnd(next, 1);
          return { visible: node.checkVisibility(), text: node.innerText.replace(/\s+/g, ' ').trim(),
            a: preceding.getBoundingClientRect().toJSON(), clean: following.getBoundingClientRect().toJSON() };
        });
        expect(heading.visible).toBe(true);
        expect(heading.text).toBe('Make a clean getaway.');
        if (Math.abs(heading.a.top - heading.clean.top) < heading.a.height * .5) {
          expect(heading.clean.left - heading.a.right, 'Inline a and clean need a real visible word gap').toBeGreaterThan(0);
        }
      });
    });
  }

  it('holds help and pause gates until deliberate Resume and does not replay held keyboard input', async () => {
    await withPage('native-pause-help', {}, async page => {
      await begin(page);
      mark(page, 'page.locator(\'#rush-help\').click()');
      await page.locator('#rush-help').click();
      expect(await page.locator('#rush-guide').evaluate(dialog => dialog.open)).toBe(true);
      expect((await state(page)).phase).toBe('paused');
      expect(await page.evaluate(() => globalThis.Suite.getSoundState().paused)).toBe(true);
      mark(page, 'page.keyboard.press(\'ArrowRight\')');
      await page.keyboard.press('ArrowRight');
      await frozen(page);
      mark(page, 'page.locator(\'#rush-contrast\').click()');
      await page.locator('#rush-contrast').click();
      expect(await page.locator('#rush-contrast').getAttribute('aria-pressed')).toBe('true');
      expect(await page.evaluate(() => globalThis.__turdrush.diagnostics.highContrast)).toBe(true);
      expect(await page.evaluate(() => globalThis.Suite.isColorblindMode())).toBe(true);
      await frozen(page);
      mark(page, 'page.locator(\'#rush-close-help\').click()');
      await page.locator('#rush-close-help').click();
      expect((await state(page)).phase).toBe('paused');
      await frozen(page);
      await resume(page);
      expect((await state(page)).player.lane).toBe(1);
      mark(page, 'page.keyboard.down(\'p\')');
      await page.keyboard.down('p');
      mark(page, 'page.keyboard.down(\'p\')');
      await page.keyboard.down('p');
      expect((await state(page)).phase).toBe('paused');
      mark(page, 'page.keyboard.up(\'p\')');
      await page.keyboard.up('p');
      await frozen(page);
    });
  });

  it('requires explicit Resume after simulated backgrounding and actual viewport rotation', async () => {
    await withPage('native-interruption', { viewport: { width: 390, height: 844 } }, async page => {
      await begin(page);
      mark(page, 'page.evaluate(() => {');
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new globalThis.Event('visibilitychange'));
      });
      expect((await state(page)).phase).toBe('paused');
      await frozen(page);
      mark(page, 'page.evaluate(() => {');
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        document.dispatchEvent(new globalThis.Event('visibilitychange'));
        globalThis.dispatchEvent(new globalThis.Event('focus'));
      });
      await frozen(page);
      await resume(page);
      mark(page, 'page.setViewportSize({ width: 568, height: 320 })');
      await page.setViewportSize({ width: 568, height: 320 });
      mark(page, 'page.waitForFunction(() => globalThis.__turdrush.state.phase === \'paused\')');
      await page.waitForFunction(() => globalThis.__turdrush.state.phase === 'paused');
      await frozen(page);
      await resume(page);
      expect((await state(page)).phase).toBe('running');
      mark(page, 'page.locator(\'#rush-pause\').click()');
      await page.locator('#rush-pause').click();
    });
  });

  it('uses the production studio-profile Audio dialog without advancing the run or auto-resuming', async () => {
    await withPage('native-studio-audio', { prefix: '/studio' }, async page => {
      await begin(page);
      expect(await page.evaluate(() => globalThis.Suite.isStudioAudio())).toBe(true);
      mark(page, 'page.getByRole(\'button\', { name: \'Audio settings\', exact: true }).click()');
      await page.getByRole('button', { name: 'Audio settings', exact: true }).click();
      expect(await page.locator('#suite-audio-settings').evaluate(dialog => dialog.open)).toBe(true);
      expect((await state(page)).phase).toBe('paused');
      await frozen(page);
      mark(page, 'page.locator(\'#suite-effects-level\').focus()');
      await page.locator('#suite-effects-level').focus();
      mark(page, 'page.keyboard.press(\'Home\')');
      await page.keyboard.press('Home');
      mark(page, 'adjust effects volume with seven native ArrowRight presses');
      for (let step = 0; step < 7; step++) {await page.keyboard.press('ArrowRight');}
      expect(await page.locator('#suite-effects-level').inputValue()).toBe('35');
      expect(await page.evaluate(() => globalThis.Suite.getEffectsVolume())).toBe(0.35);
      mark(page, 'page.locator(\'#suite-effects-close\').click()');
      await page.locator('#suite-effects-close').click();
      expect((await state(page)).phase).toBe('paused');
      await frozen(page);
      await resume(page);
      expect(await page.evaluate(() => globalThis.Suite.getSoundState().paused)).toBe(false);
      mark(page, 'page.locator(\'#rush-pause\').click()');
      await page.locator('#rush-pause').click();
    });
  });

  it('arms the native Studio sound context on Start so the first Right input produces a real accepted cue', async () => {
    await withPage('native-studio-first-input', { prefix: '/studio', unmuted: true, observeAudio: true }, async page => {
      expect(await page.evaluate(() => globalThis.__runnerNativeAudioContexts.length)).toBe(0);
      await page.evaluate(() => {
        globalThis.__runnerStudioCalls = [];
        const nativePlay = globalThis.Suite.playSound;
        globalThis.Suite.playSound = function (...args) {
          const before = globalThis.__runnerNativeAudioNodes.length;
          const accepted = Reflect.apply(nativePlay, this, args);
          globalThis.__runnerStudioCalls.push({ event: args[0], accepted,
            nativeStarts: globalThis.__runnerNativeAudioNodes.length - before,
            phase: globalThis.__turdrush.state.phase });
          return accepted;
        };
      });
      await begin(page);
      mark(page, 'Start must construct and resume the real native context before any game action');
      expect(await page.evaluate(() => globalThis.__runnerNativeAudioContexts.length)).toBe(1);
      await page.waitForFunction(() => globalThis.__runnerNativeAudioContexts[0].state === 'running', null, { timeout: 5000 });
      mark(page, 'first native Right must be accepted immediately, not a later pickup/death sound');
      await page.locator('[data-rush-action="right"]').click();
      const calls = await page.evaluate(() => globalThis.__runnerStudioCalls.filter(call => call.event === 'tris.move'));
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({ accepted: true, phase: 'running' });
      expect(calls[0].nativeStarts).toBeGreaterThan(0);
      expect((await state(page)).player.lane).toBe(2);
      await page.locator('#rush-pause').click();
    });
  });

  it('plays with denied storage and never needs persistence to bind native controls', async () => {
    await withPage('native-storage-denied', { denied: true, viewport: { width: 320, height: 568 } }, async page => {
      await begin(page);
      mark(page, 'page.locator(\'[data-rush-action="jump"]\').click()');
      await page.locator('[data-rush-action="jump"]').click();
      mark(page, 'page.waitForFunction(() => globalThis.__turdrush.state.player.y > 0.2)');
      await page.waitForFunction(() => globalThis.__turdrush.state.player.y > 0.2);
      mark(page, 'page.locator(\'#rush-pause\').click()');
      await page.locator('#rush-pause').click();
      await frozen(page);
      await resume(page);
      expect((await state(page)).phase).toBe('running');
      mark(page, 'page.locator(\'#rush-pause\').click()');
      await page.locator('#rush-pause').click();
    });
  });

  it('records one collision result per run and accepts one fresh run across native double-tap replay', async () => {
    await withPage('native-terminal-fixture', { prefix: '/fixture' }, async page => {
      expect((await progress(page)).history.turdrush).toBeUndefined();
      mark(page, 'page.locator(\'#rush-start\').click()');
      await page.locator('#rush-start').click();
      mark(page, 'page.locator(\'#rush-results\').waitFor({ state: \'visible\' })');
      await page.locator('#rush-results').waitFor({ state: 'visible' });
      expect((await state(page)).reason).toBe('barrier');
      let record = await progress(page);
      expect(record.history.turdrush).toHaveLength(1);
      expect(record.history.turdrush[0]).toMatchObject({ distance: 512, picks: 5, kind: 'run', outcome: 'complete' });
      expect(record.earned['rush-distance']).toBeTruthy();
      const firstId = record.history.turdrush[0].id;
      await frozen(page);
      expect((await progress(page)).history.turdrush).toHaveLength(1);
      mark(page, 'page.getByRole(\'button\', { name: \'Share score\', exact: true }).click()');
      await page.getByRole('button', { name: 'Share score', exact: true }).click();
      mark(page, 'page.waitForFunction(() => /copied|Select and copy/i.test(document.querySelector(\'.suite-result-share-status\').textContent))');
      await page.waitForFunction(() => /copied|Select and copy/i.test(document.querySelector('.suite-result-share-status').textContent));
      // A genuine native double tap may start one fresh run. It must not create
      // two starts/results; assertions above do not assume the550ms guard is
      // still active after asynchronous storage/share inspection.
      mark(page, 'page.locator(\'#rush-again\').dblclick({ delay: 20 })');
      await page.locator('#rush-again').dblclick({ delay: 20 });
      mark(page, 'page.waitForFunction(() => globalThis.SuiteProgress.snapshot().history.turdrush.length === 2)');
      await page.waitForFunction(() => globalThis.SuiteProgress.snapshot().history.turdrush.length === 2);
      record = await progress(page);
      expect(record.history.turdrush[1].id).not.toBe(firstId);
      const ids = record.history.turdrush.map(entry => entry.id);
      await frozen(page);
      mark(page, 'page.reload()');
      await page.reload();
      mark(page, 'page.waitForFunction(() => globalThis.__turdrush && globalThis.SuiteLoading?.state === \'ready\')');
      await page.waitForFunction(() => globalThis.__turdrush && globalThis.SuiteLoading?.state === 'ready');
      expect((await state(page)).phase).toBe('ready');
      expect((await progress(page)).history.turdrush.map(entry => entry.id)).toEqual(ids);
    });
  });

  it('drops deferred old pickup and shield-hit sounds on results, retains terminal cues and resets replay visuals', async () => {
    await withPage('native-deferred-audio-fixture', { prefix: '/audio-fixture', reducedMotion: 'no-preference' }, async page => {
      mark(page, 'hold only the isolated SDK audio promise; keep native bank playback');
      await page.evaluate(() => {
        const nativeAudio = globalThis.Suite.audio.bind(globalThis.Suite);
        let release;
        const held = new Promise(done => {release = done;});
        globalThis.__runnerPresetCalls = [];
        globalThis.__releaseRunnerAudio = release;
        globalThis.Suite.audio = () => held.then(nativeAudio).then(bank => ({
          ...bank,
          playPreset(...args) { globalThis.__runnerPresetCalls.push(args[0]); return bank.playPreset(...args); }
        }));
      });
      mark(page, 'native Start; actual core picks, shield absorption and fatal collision');
      await page.locator('#rush-start').click();
      await page.locator('#rush-results').waitFor({ state: 'visible' });
      expect((await state(page)).phase).toBe('over');
      expect((await state(page)).picks).toBe(6);
      expect((await state(page)).player.shield).toBe(0);
      expect(await page.evaluate(() => globalThis.__runnerPresetCalls)).toEqual([]);
      mark(page, 'release deferred SDK on results and inspect actual forwarded presets');
      await page.evaluate(() => globalThis.__releaseRunnerAudio());
      await page.waitForFunction(() => globalThis.__runnerPresetCalls.includes('lose'));
      expect(await page.evaluate(() => globalThis.__runnerPresetCalls)).toEqual(['snap', 'lose']);
      const first = (await progress(page)).history.turdrush[0].id;
      await page.locator('#rush-again').click();
      await page.waitForFunction(() => globalThis.SuiteProgress.snapshot().history.turdrush.length === 2);
      const resets = await page.evaluate(() => globalThis.__runnerResetObservations);
      expect(resets).toHaveLength(2);
      expect(resets[1].before.elapsed).toBeGreaterThan(0);
      expect(resets.every(reset => reset.after.elapsed === 0 && reset.after.shake === 0 && reset.after.sparks === 0)).toBe(true);
      expect((await progress(page)).history.turdrush[1].id).not.toBe(first);
    });
  });

  it('offers a usable renderer capability fallback while keeping unrelated saved data', async () => {
    await withPage('native-no-webgl', { unsupported: true }, async page => {
      expect(await page.evaluate(() => globalThis.__turdrush.diagnostics.available)).toBe(false);
      expect(await page.locator('#rush-unavailable').isVisible()).toBe(true);
      expect(await page.locator('#rush-unavailable-text').innerText()).toContain('records are safe');
      expect(await page.locator('#rush-reload').isEnabled()).toBe(true);
      expect(await page.locator('#rush-start').isDisabled()).toBe(true);
      mark(page, 'page.evaluate(() => localStorage.setItem(\'unrelated-player-progress\', \'kept\'))');
      await page.evaluate(() => localStorage.setItem('unrelated-player-progress', 'kept'));
      mark(page, 'page.locator(\'#rush-reload\').click()');
      await page.locator('#rush-reload').click();
      mark(page, 'page.locator(\'#rush-unavailable\').waitFor({ state: \'visible\' })');
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
      mark(page, 'page.locator(\'#rush-unavailable\').waitFor({ state: \'visible\' })');
      await page.locator('#rush-unavailable').waitFor({ state: 'visible' });
      expect((await state(page)).phase).toBe('paused');
      expect(await page.evaluate(() => globalThis.__turdrush.diagnostics.available)).toBe(false);
      await frozen(page);
      expect((await progress(page)).history.turdrush).toBeUndefined();
      mark(page, 'page.locator(\'#rush-reload\').click()');
      await page.locator('#rush-reload').click();
      mark(page, 'page.waitForFunction(() => globalThis.__turdrush?.diagnostics.available && globalThis.SuiteLoading?.state === \'ready\')');
      await page.waitForFunction(() => globalThis.__turdrush?.diagnostics.available && globalThis.SuiteLoading?.state === 'ready');
      expect((await state(page)).phase).toBe('ready');
      await begin(page);
      expect((await state(page)).distance).toBeLessThan(20);
      expect((await progress(page)).history.turdrush).toBeUndefined();
      mark(page, 'page.locator(\'#rush-pause\').click()');
      await page.locator('#rush-pause').click();
    });
  });

  it('stops native GPU redraws for a static reduced-motion intro and a paused run, then renders on Resume', async () => {
    await withPage('native-paused-gpu', { observeGL: true }, async page => {
      const settle = () => page.evaluate(() => new Promise(done => globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(done))));
      // A late font swap can legitimately resize the canvas; finish that real
      // layout work before asserting that the intro is otherwise static.
      mark(page, 'wait fonts and two RAFs before static GPU sample');
      await page.evaluate(() => document.fonts.ready);
      await settle();
      let clears = await page.evaluate(() => globalThis.__runnerNativeGlClears);
      expect(clears).toBeGreaterThan(0);
      mark(page, 'page.waitForTimeout(250); // A static intro needs no new GPU submission.');
      await page.waitForTimeout(250); // A static intro needs no new GPU submission.
      expect(await page.evaluate(() => globalThis.__runnerNativeGlClears)).toBe(clears);
      await begin(page);
      mark(page, 'page.waitForFunction(before => globalThis.__runnerNativeGlClears > before, clears, { timeout: 5000 })');
      await page.waitForFunction(before => globalThis.__runnerNativeGlClears > before, clears, { timeout: 5000 });
      mark(page, 'page.locator(\'#rush-pause\').click()');
      await page.locator('#rush-pause').click();
      await settle();
      clears = await page.evaluate(() => globalThis.__runnerNativeGlClears);
      mark(page, 'page.waitForTimeout(250); // Paused gameplay may update DOM, not redraw the identical 3D scene.');
      await page.waitForTimeout(250); // Paused gameplay may update DOM, not redraw the identical 3D scene.
      expect(await page.evaluate(() => globalThis.__runnerNativeGlClears)).toBe(clears);
      await frozen(page);
      await resume(page);
      mark(page, 'page.waitForFunction(before => globalThis.__runnerNativeGlClears > before, clears, { timeout: 5000 })');
      await page.waitForFunction(before => globalThis.__runnerNativeGlClears > before, clears, { timeout: 5000 });
      mark(page, 'page.locator(\'#rush-pause\').click()');
      await page.locator('#rush-pause').click();
    });
  });

  it('shows the complete active onboarding lesson inside the568px landscape arena', async () => {
    await withPage('native-landscape-onboarding', { viewport: { width: 568, height: 320 } }, async page => {
      mark(page, 'page.evaluate(() => document.fonts.ready)');
      await page.evaluate(() => document.fonts.ready);
      await begin(page);
      mark(page, 'page.waitForFunction(() => {');
      await page.waitForFunction(() => {
        const lesson = document.getElementById('rush-lesson');
        return globalThis.__turdrush.state.phase === 'running' && lesson.checkVisibility() && lesson.textContent.trim().length > 10;
      });
      const geometry = await page.locator('#rush-lesson').evaluate(lesson => {
        const text = document.createRange(); text.selectNodeContents(lesson);
        return { text: lesson.textContent.trim(), visible: lesson.checkVisibility(),
          scrollWidth: lesson.scrollWidth, clientWidth: lesson.clientWidth,
          box: lesson.getBoundingClientRect().toJSON(),
          textBoxes: [...text.getClientRects()].map(box => box.toJSON()),
          arena: document.getElementById('rush-arena').getBoundingClientRect().toJSON(),
          controls: [...document.querySelectorAll('[data-rush-action]')].map(button => button.getBoundingClientRect().toJSON()) };
      });
      expect(geometry.visible).toBe(true);
      expect(geometry.text).toMatch(/Swipe left|Jump high|Golden picks/);
      expect(geometry.clientWidth).toBeGreaterThan(0);
      expect(geometry.scrollWidth, `Full lesson must fit: ${geometry.text}`).toBeLessThanOrEqual(geometry.clientWidth + 1);
      expect(geometry.textBoxes.length).toBeGreaterThan(0);
      for (const text of geometry.textBoxes) {
        expect(text.width).toBeGreaterThan(0);
        expect(text.height).toBeGreaterThan(0);
        expect(text.left).toBeGreaterThanOrEqual(geometry.arena.left);
        expect(text.right).toBeLessThanOrEqual(geometry.arena.right);
        expect(text.top).toBeGreaterThanOrEqual(geometry.arena.top);
        expect(text.bottom).toBeLessThanOrEqual(geometry.arena.bottom);
        for (const control of geometry.controls) {
          const intersection = Math.max(0, Math.min(text.right, control.right) - Math.max(text.left, control.left)) * Math.max(0, Math.min(text.bottom, control.bottom) - Math.max(text.top, control.top));
          expect(intersection, 'Lesson must not cover an action button').toBe(0);
        }
      }
      await capture(page, 'native-landscape-onboarding-active');
      mark(page, 'page.locator(\'#rush-pause\').click()');
      await page.locator('#rush-pause').click();
    });
  });

  for (const prefix of ['', '/studio']) {
    for (const [width, height] of [[320, 568], [568, 320]]) {
      it(`keeps real controls hittable without overlap at${width}x${height}${prefix || '/classic'}`, async () => {
        await withPage(`native-geometry-${prefix ? 'studio' : 'classic'}-${width}x${height}`, { prefix, viewport: { width, height } }, async page => {
          mark(page, 'page.evaluate(() => document.fonts.ready)');
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
          mark(page, 'page.locator(\'#rush-pause\').click()');
          await page.locator('#rush-pause').click();
        });
      });
    }
  }
});
