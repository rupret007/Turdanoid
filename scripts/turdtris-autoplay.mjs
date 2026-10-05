/**
 * Real-time Turdtris placement-bot playtest; intentionally outside vitest.
 *
 * PLAYWRIGHT_CHANNEL=chromium node scripts/turdtris-autoplay.mjs
 * node scripts/turdtris-autoplay.mjs --seconds=12 --runs=phone-320 --port=8152
 * node scripts/turdtris-autoplay.mjs --output=/absolute/artifact/directory
 *
 * Each of the five default runs lasts 90 seconds, plus interaction probes.
 * Results, screenshots and measured rAF/long-task samples stay in the output
 * directory. The bot reads board state but moves only through UI input.
 */
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const options = Object.fromEntries(process.argv.slice(2).map(argument => {
  const [key, ...value] = argument.replace(/^--/, '').split('=');
  return [key, value.join('=')];
}));
const port = Number(options.port || 8152);
const seconds = Number(options.seconds || 90);
const output = resolve(options.output || '/Users/jeffstory/Documents/bob-overnight-inject/conductor/reviews/turdanoid-1000x/r3/turdtris-autoplay');
if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isFinite(seconds) || seconds < 1) {
  throw new Error('Use --port=1..65535 and --seconds=1 or greater.');
}
const variants = [
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'phone-320', width: 320, height: 640 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'reduced-motion', width: 390, height: 844, reduced: true },
  { name: 'muted', width: 390, height: 844, muted: true }
].filter(variant => !options.runs || options.runs.split(',').includes(variant.name));
if (!variants.length) throw new Error('No matching --runs; use phone-390,phone-320,desktop-1280,reduced-motion,muted.');

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon'
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(`${root}${sep}`)) throw new Error('Outside repository');
    const body = await readFile(path);
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});

function installMeasurements({ muted }) {
  if (muted) {
    localStorage.setItem('turdsuite_muted', '1');
    localStorage.setItem('turdtrisSoundOn_v1', '0');
  }
  const metrics = window.__autoplayMetrics = {
    deltas: [], longTasks: [], oscillatorStarts: 0, canvasesCreated: 0,
    hiddenFrames: 0, started: performance.now(), last: 0
  };
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function(name, ...args) {
    if (String(name).toLowerCase() === 'canvas') metrics.canvasesCreated++;
    return originalCreateElement(name, ...args);
  };
  if (window.OscillatorNode) {
    const originalStart = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function(...args) {
      metrics.oscillatorStarts++;
      return originalStart.apply(this, args);
    };
  }
  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
    new PerformanceObserver(list => {
      for (const task of list.getEntries()) metrics.longTasks.push({ start: task.startTime, duration: task.duration });
    }).observe({ type: 'longtask', buffered: true });
  }
  const frame = now => {
    if (metrics.last && !document.hidden) metrics.deltas.push(now - metrics.last);
    if (document.hidden) metrics.hiddenFrames++;
    metrics.last = now;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

async function readState(page, withBoard = false) {
  return page.evaluate(withBoard => {
    const visible = id => getComputedStyle(document.getElementById(id)).display !== 'none';
    const rect = element => {
      const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    };
    return {
      score, level, lines: linesCleared, pieces: runStats.pieces,
      elapsedMs: runStats.elapsedMs, paused, gameOver, onboardingOpen,
      loopRunning: rAF !== null, softDrop, dasLeftHeld, dasRightHeld,
      repeating: holdInterval !== null, repeatPending: holdDelayTimeout !== null,
      overlays: { pause: visible('pauseOverlay'), gameOver: visible('gameOverOverlay') },
      scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, viewportHeight: innerHeight,
      boardRect: rect(document.getElementById('game')),
      dockRect: rect(document.getElementById('mobileControls')),
      touchTargets: withBoard ? Array.from(document.querySelectorAll('#mobileControls [data-action]'), button =>
        ({ action: button.dataset.action, ...rect(button) })) : undefined,
      sceneShake, sparks: clearSparks.length, trails: dropTrails.length,
      canvasesCreated: window.__autoplayMetrics.canvasesCreated,
      soundEnabled, suiteMuted: suiteMuted(), reduced: !!reducedMotion?.matches,
      piece: tetromino ? { name: tetromino.name, row: tetromino.row, col: tetromino.col,
        rotation: tetromino.rotation, matrix: tetromino.matrix } : null,
      board: withBoard ? playfield.map(row => row.map(cell => cell ? 1 : 0)) : undefined
    };
  }, withBoard);
}

// A small one-piece lookahead: reward clears, strongly avoid holes and topout,
// and keep the surface low and even. It does not manipulate the live game.
function findPlacement({ board, piece }) {
  if (!piece || !board) return null;
  const rows = board.length;
  const columns = board[0].length;
  let matrix = piece.matrix;
  let best = null;
  for (let turns = 0; turns < 4; turns++) {
    if (turns) matrix = matrix[0].map((_, x) => matrix.map(row => row[x]).reverse());
    const valid = (row, col) => matrix.every((cells, y) => cells.every((cell, x) => {
      if (!cell) return true;
      return col + x >= 0 && col + x < columns && row + y < rows &&
        (row + y < 0 || !board[row + y][col + x]);
    }));
    for (let col = -3; col < columns; col++) {
      let row = piece.row;
      if (!valid(row, col)) continue;
      while (valid(row + 1, col)) row++;
      const trial = board.map(cells => [...cells]);
      let topout = 0;
      matrix.forEach((cells, y) => cells.forEach((cell, x) => {
        if (!cell) return;
        if (row + y < 2) topout++;
        if (row + y >= 0) trial[row + y][col + x] = 1;
      }));
      const remaining = trial.filter(cells => !cells.every(Boolean));
      const clears = rows - remaining.length;
      while (remaining.length < rows) remaining.unshift(Array(columns).fill(0));
      const heights = [];
      let holes = 0;
      for (let x = 0; x < columns; x++) {
        let height = 0;
        for (let y = 0; y < rows; y++) {
          if (remaining[y][x] && !height) height = rows - y;
          else if (!remaining[y][x] && height) holes++;
        }
        heights.push(height);
      }
      const bumpiness = heights.slice(1).reduce((sum, height, x) => sum + Math.abs(height - heights[x]), 0);
      const cost = topout * 1000 + holes * 9 + heights.reduce((sum, height) => sum + height, 0) * 0.55 +
        bumpiness * 0.4 + Math.max(...heights) * 0.8 - clears * 8 + turns * 0.01;
      if (!best || cost < best.cost) best = { turns, col, cost };
    }
  }
  return best;
}

async function press(page, action, mobile) {
  if (mobile) {
    const box = await page.locator(`[data-action="${action}"]`).boundingBox();
    if (!box) throw new Error(`Missing touch control ${action}`);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await page.keyboard.press({ left: 'ArrowLeft', right: 'ArrowRight', rotate: 'ArrowUp',
      drop: 'Space', down: 'ArrowDown', hold: 'c', pause: 'p' }[action]);
  }
}

async function interactionProbes(page, mobile, directory, issues) {
  await page.keyboard.down('ArrowDown');
  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('p');
  const pausedState = await readState(page);
  if (!pausedState.paused || !pausedState.overlays.pause || pausedState.loopRunning) issues.push('Pause did not show its overlay and stop the game loop.');
  if (pausedState.softDrop || pausedState.dasLeftHeld || pausedState.dasRightHeld || pausedState.repeatPending || pausedState.repeating) issues.push('Pause retained held input.');
  await page.screenshot({ path: resolve(directory, 'pause.png') });
  await page.keyboard.up('ArrowDown');
  await page.keyboard.up('ArrowRight');
  if (mobile) {
    await press(page, 'down', true);
    const blockedState = await readState(page);
    if (blockedState.softDrop || blockedState.repeatPending || blockedState.repeating || blockedState.piece.row !== pausedState.piece.row) issues.push('A paused dock press queued or moved soft drop.');
  }
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(220);
  const resumed = await readState(page);
  if (resumed.paused || resumed.overlays.pause || !resumed.loopRunning || resumed.softDrop || resumed.piece.col !== pausedState.piece.col) issues.push('Resume retained an overlay or held input.');

  if (mobile) {
    const menu = page.locator('.mobile-menu details');
    await menu.locator('summary').click();
    await page.waitForTimeout(60);
    if (!(await readState(page)).paused) issues.push('Run Menu failed to pause.');
    await page.screenshot({ path: resolve(directory, 'run-menu.png') });
    await menu.locator('summary').click();
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(60);
    if ((await readState(page)).paused) issues.push('Closing Run Menu failed to resume.');
    for (const boundary of ['pointercancel', 'pointerleave']) {
      await page.dispatchEvent('[data-action="left"]', 'pointerdown', { pointerType: 'touch', pointerId: 99 });
      await page.dispatchEvent('#mobileControls', boundary, { pointerType: 'touch', pointerId: 99 });
      const cancelled = await readState(page);
      await page.waitForTimeout(190);
      if (cancelled.repeatPending || cancelled.repeating || (await readState(page)).piece.col !== cancelled.piece.col) issues.push(`${boundary} retained touch movement.`);
    }
  }
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  if (!(await readState(page)).paused) issues.push('Window blur failed to auto-pause.');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.evaluate(() => document.activeElement.blur());
}

function percentile(sorted, fraction) {
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] : 0;
}

/**
 * Explicit synthetic fixtures, run AFTER the bot and performance measurement.
 * These verify UI boundaries and make a four-scene visual review repeatable;
 * none of their lines, times, scores or levels count as autoplay achievements.
 */
async function fixtureProbes(page, mobile, result, capture) {
  result.fixtures = { synthetic: true,
    description: 'Forced board/time/level fixtures after measured gameplay; not bot achievements.', cases: [] };
  const fail = message => result.issues.push(`Synthetic fixture: ${message}`);
  const receipt = () => page.evaluate(() => ({
    mode: runMode, title: document.getElementById('endTitle').textContent,
    kicker: document.getElementById('endKicker').textContent,
    bestLabel: document.getElementById('endBestLabel').textContent,
    best: document.getElementById('endBest').textContent,
    lines: linesCleared, score, elapsedMs: runStats.elapsedMs, gameOver,
    overlay: getComputedStyle(document.getElementById('gameOverOverlay')).display,
    classicBest: localStorage.getItem('turdtrisHighScore'),
    sprintBest: localStorage.getItem('turdtrisSprint40BestMs_v1'),
    ultraBest: localStorage.getItem('turdtrisUltra120Best_v1')
  }));
  const replay = async () => {
    await page.getByRole('button', { name: 'Play Again', exact: true }).click();
    await page.evaluate(() => document.activeElement.blur());
    const state = await readState(page);
    if (state.gameOver || state.paused || state.overlays.gameOver || state.overlays.pause || state.pieces || state.lines || state.score) fail('Play Again retained run state or overlays.');
  };
  const chooseMode = async mode => {
    const menu = page.locator('.mobile-menu details');
    await menu.locator('summary').click();
    await page.locator('#modeSetting').selectOption(mode);
    await page.getByRole('button', { name: 'Start selected mode', exact: true }).click();
    await page.evaluate(() => document.activeElement.blur());
    await page.waitForTimeout(80);
    const state = await readState(page);
    if (state.paused || state.gameOver || state.overlays.pause || state.overlays.gameOver || !state.loopRunning) fail(`Selecting ${mode} left stale pause/end state.`);
  };

  if ((await readState(page)).gameOver) await replay();
  await page.evaluate(() => {
    stopLoop();
    for (const row of playfield) row.fill('G');
    tetromino = { name: 'O', matrix: [[1, 1], [1, 1]], row: -2, col: 4,
      rotation: 0, lastActionRotate: false, lastKick: false };
    drawPlayfield();
  });
  await press(page, 'drop', mobile);
  const overflow = await receipt();
  if (!overflow.gameOver || overflow.overlay === 'none' || overflow.title !== 'Game Over') fail('Forced Classic topout did not show its receipt.');
  await capture('forced-classic-topout-receipt');
  result.fixtures.cases.push({ fixture: 'forced-classic-topout', ...overflow });
  await replay();
  const originalKeys = await receipt();

  await chooseMode('sprint');
  await page.evaluate(() => {
    stopLoop();
    for (const row of playfield) row.fill(0);
    playfield[rows - 1].fill('J');
    playfield[rows - 1][4] = playfield[rows - 1][5] = 0;
    tetromino = { name: 'O', matrix: [[1, 1], [1, 1]], row: rows - 3, col: 4,
      rotation: 0, lastActionRotate: false, lastKick: false };
    linesCleared = 39; level = 5; levelLines = 0;
    runStats.elapsedMs = 65432; runStats.pieces = 100;
    updateScore(); drawPlayfield();
  });
  await press(page, 'drop', mobile);
  const sprint = await receipt();
  if (!sprint.gameOver || sprint.lines !== 40 || sprint.title !== '40 lines. Flushed!' || Number(sprint.sprintBest) !== 65432) fail(`Sprint completion/record mismatch: ${JSON.stringify(sprint)}`);
  if (sprint.classicBest !== originalKeys.classicBest || sprint.ultraBest !== originalKeys.ultraBest) fail('Sprint changed another mode’s record.');
  await capture('forced-sprint-40l-receipt');
  result.fixtures.cases.push({ fixture: 'forced-sprint-39-lines-plus-clear', ...sprint });
  await replay();
  if (await page.evaluate(() => runMode !== 'sprint')) fail('Sprint replay did not retain its mode.');

  await chooseMode('ultra');
  await page.evaluate(() => { runStats.elapsedMs = 119990; score = 12345; updateScore(); });
  await page.waitForFunction(() => gameOver);
  const ultra = await receipt();
  if (!ultra.gameOver || ultra.elapsedMs !== 120000 || ultra.title !== 'Time’s up!' || Number(ultra.ultraBest) !== 12345) fail(`Ultra completion/record mismatch: ${JSON.stringify(ultra)}`);
  if (ultra.classicBest !== originalKeys.classicBest || ultra.sprintBest !== sprint.sprintBest) fail('Ultra changed another mode’s record.');
  await capture('forced-ultra-timeout-receipt');
  result.fixtures.cases.push({ fixture: 'forced-ultra-119990ms-plus-real-clock', ...ultra });
  await replay();
  if (await page.evaluate(() => runMode !== 'ultra')) fail('Ultra replay did not retain its mode.');

  await chooseMode('classic');
  await page.evaluate(() => {
    stopLoop();
    for (const row of playfield) row.fill(0);
    const colors = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    const heights = [5, 4, 3, 2, 1, 0, 2, 3, 4, 2];
    for (let col = 0; col < cols; col++) {
      for (let h = 0; h < heights[col]; h++) playfield[rows - 1 - h][col] = colors[(h + col) % colors.length];
    }
    tetromino = { name: 'T', matrix: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], row: 5, col: 3,
      rotation: 0, lastActionRotate: false, lastKick: false };
    hypeText = ''; hypeTimer = 0; spawnAge = 1000;
  });
  for (const scene of [{ level: 1, name: 'porcelain-palace' }, { level: 5, name: 'midnight-sewer' },
    { level: 9, name: 'biolume-lagoon' }, { level: 13, name: 'cosmic-commode' }]) {
    await page.evaluate(nextLevel => { level = nextLevel; updateScore(); drawPlayfield(); }, scene.level);
    await capture(`visual-fixture-${scene.name}`);
    result.fixtures.cases.push({ fixture: 'visual-only-environment-gallery', ...scene });
  }
}

async function playRun(browser, variant) {
  const mobile = variant.width < 700;
  const directory = resolve(output, variant.name);
  await mkdir(directory, { recursive: true });
  const context = await browser.newContext({ viewport: { width: variant.width, height: variant.height },
    deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await context.addInitScript(installMeasurements, { muted: !!variant.muted });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);
  await page.emulateMedia({ reducedMotion: variant.reduced ? 'reduce' : 'no-preference' });
  const result = { variant, durationRequestedSeconds: seconds, consoleErrors: [], pageErrors: [],
    issues: [], timeline: [], screenshots: [], restarts: 0, placements: 0 };
  page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
  page.on('pageerror', error => result.pageErrors.push(error.message));
  page.on('dialog', async dialog => { result.issues.push(`Unexpected ${dialog.type()}: ${dialog.message()}`); await dialog.dismiss(); });
  const capture = async label => {
    const file = `${label}.png`;
    await page.screenshot({ path: resolve(directory, file) });
    result.screenshots.push(file);
  };
  try {
    const response = await page.goto(`http://127.0.0.1:${port}/turdtris.html`, { waitUntil: 'networkidle' });
    if (!response?.ok()) throw new Error(`Page HTTP ${response?.status()}`);
    await capture('onboarding');
    const beforeGesture = await page.evaluate(() => window.__autoplayMetrics.oscillatorStarts);
    if (beforeGesture) result.issues.push(`${beforeGesture} oscillators started before a user gesture.`);
    await page.getByRole('button', { name: 'Review Then Start' }).click();
    await page.evaluate(() => document.activeElement.blur());
    await interactionProbes(page, mobile, directory, result.issues);
    const started = Date.now();
    const measurementStart = await page.evaluate(() => ({ frame: window.__autoplayMetrics.deltas.length, time: performance.now() }));
    let nextScreenshot = 0;
    let lastProgress = started;
    let lastSignature = '';
    while (Date.now() - started < seconds * 1000) {
      const elapsed = (Date.now() - started) / 1000;
      const state = await readState(page, true);
      if (elapsed >= nextScreenshot) {
        await capture(`play-${String(Math.floor(nextScreenshot)).padStart(3, '0')}s`);
        result.timeline.push({ seconds: Number(elapsed.toFixed(2)), ...state, board: undefined });
        nextScreenshot += 10;
        console.log(`${variant.name} ${Math.floor(elapsed)}s: ${state.pieces} pieces, ${state.lines} lines, L${state.level}, ${state.score} points`);
      }
      if (state.scrollWidth > state.viewportWidth) result.issues.push(`Horizontal overflow ${state.scrollWidth} > ${state.viewportWidth} at ${elapsed.toFixed(1)}s.`);
      if (state.boardRect.x < 0 || state.boardRect.right > state.viewportWidth || state.boardRect.y < 0 || state.boardRect.bottom > state.viewportHeight) result.issues.push('Playfield escaped the viewport.');
      if (mobile) {
        if (state.dockRect.x < 0 || state.dockRect.right > state.viewportWidth || state.dockRect.bottom > state.viewportHeight || state.boardRect.bottom > state.dockRect.y) result.issues.push('Touch dock escaped the viewport or overlapped the board.');
        for (const button of state.touchTargets) {
          if (button.width < 44 || button.height < 44) result.issues.push(`Touch target ${button.action} is smaller than 44px (${button.width}×${button.height}).`);
        }
      }
      if (state.paused || state.onboardingOpen || state.overlays.pause) throw new Error(`Unexpected pause/guide/overlay during play at ${elapsed.toFixed(1)}s.`);
      if (variant.reduced && (state.sceneShake > 0 || state.sparks || state.trails)) result.issues.push(`Reduced motion retained shake/particles/trails at ${elapsed.toFixed(1)}s.`);
      if (state.gameOver) {
        if (!state.overlays.gameOver || state.loopRunning) result.issues.push('Game over failed to show its overlay or stop the loop.');
        await capture(`game-over-${++result.restarts}`);
        await page.getByRole('button', { name: 'Play Again', exact: true }).click();
        await page.evaluate(() => document.activeElement.blur());
        const restarted = await readState(page);
        if (restarted.gameOver || restarted.paused || restarted.overlays.gameOver || restarted.overlays.pause || restarted.pieces) throw new Error('Play Again left stale state or overlays.');
        lastProgress = Date.now();
        continue;
      }
      if (state.overlays.gameOver || !state.loopRunning || !state.piece) throw new Error('Active run has a stale end overlay, stopped loop, or missing piece.');
      const signature = `${state.pieces}/${state.score}/${state.lines}`;
      if (signature !== lastSignature) { lastSignature = signature; lastProgress = Date.now(); }
      if (Date.now() - lastProgress > 5000) throw new Error('No piece/score/line progress for five seconds.');
      const target = findPlacement(state);
      if (target) {
        for (let turn = 0; turn < target.turns; turn++) await press(page, 'rotate', mobile);
        const col = await page.evaluate(() => tetromino.col);
        for (let step = 0; step < Math.abs(col - target.col); step++) await press(page, col > target.col ? 'left' : 'right', mobile);
      }
      await press(page, 'drop', mobile);
      result.placements++;
      await page.waitForTimeout(250);
    }
    result.durationActualSeconds = (Date.now() - started) / 1000;
    result.final = await readState(page);
    await capture('final');
    const measurements = await page.evaluate(() => window.__autoplayMetrics);
    const deltas = measurements.deltas.slice(measurementStart.frame).filter(delta => delta > 0);
    const ordered = [...deltas].sort((a, b) => a - b);
    const total = deltas.reduce((sum, delta) => sum + delta, 0);
    const longTasks = measurements.longTasks.filter(task => task.start >= measurementStart.time);
    result.performance = { frames: deltas.length, meanFps: total ? Number((1000 * deltas.length / total).toFixed(2)) : 0,
      medianFrameMs: Number(percentile(ordered, 0.5).toFixed(2)), p95FrameMs: Number(percentile(ordered, 0.95).toFixed(2)),
      p99FrameMs: Number(percentile(ordered, 0.99).toFixed(2)), maxFrameMs: Number((ordered.at(-1) || 0).toFixed(2)),
      framesOver34ms: deltas.filter(delta => delta > 34).length, longTasks: longTasks.length,
      longestTaskMs: Math.max(0, ...longTasks.map(task => task.duration)),
      oscillatorStarts: measurements.oscillatorStarts, canvasesCreated: measurements.canvasesCreated,
      hiddenFrames: measurements.hiddenFrames };
    if (variant.muted && measurements.oscillatorStarts) result.issues.push(`Muted run started ${measurements.oscillatorStarts} audio oscillators.`);
    if (result.performance.meanFps < 50) result.issues.push(`Measured rAF FPS below 50: ${result.performance.meanFps}.`);
    await writeFile(resolve(directory, 'measurements.json'), JSON.stringify({ frameDeltasMs: deltas, longTasks }, null, 2));
    await fixtureProbes(page, mobile, result, capture);
    if (variant.muted && await page.evaluate(() => window.__autoplayMetrics.oscillatorStarts)) result.issues.push('Muted synthetic fixture started an audio oscillator.');
  } catch (error) {
    result.issues.push(error.stack || error.message);
    await capture('failure').catch(() => {});
  } finally {
    result.issues = [...new Set(result.issues)];
    result.status = result.issues.length || result.consoleErrors.length || result.pageErrors.length ? 'FAIL' : 'PASS';
    await writeFile(resolve(directory, 'report.json'), JSON.stringify(result, null, 2));
    await context.close();
  }
  console.log(`${variant.name}: ${result.status}; FPS=${result.performance?.meanFps ?? 'unavailable'}; issues=${result.issues.length}`);
  return result;
}

let browser;
try {
  await mkdir(output, { recursive: true });
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolveListen);
  });
  const channel = process.env.PLAYWRIGHT_CHANNEL || 'chromium';
  try { browser = await chromium.launch({ channel, headless: true }); }
  catch (error) {
    console.log(`Channel ${channel} unavailable; trying bundled Chromium (${error.message.split('\n')[0]}).`);
    browser = await chromium.launch({ headless: true });
  }
  const reports = [];
  for (const variant of variants) reports.push(await playRun(browser, variant));
  const summary = { recordedAt: new Date().toISOString(), secondsPerRun: seconds,
    status: reports.every(report => report.status === 'PASS') ? 'PASS' : 'FAIL', reports };
  await writeFile(resolve(output, 'summary.json'), JSON.stringify(summary, null, 2));
  const rows = reports.map(report => `| ${report.variant.name} | ${report.status} | ${report.performance?.meanFps ?? '—'} | ${report.performance?.p95FrameMs ?? '—'} | ${report.performance?.longTasks ?? '—'} | ${report.placements} | ${report.restarts} |`);
  await writeFile(resolve(output, 'summary.md'), `# Turdtris real-time autoplay\n\n${summary.recordedAt}; ${seconds}s requested per run. FPS measures browser rAF pacing in headless Chromium, not physical-phone GPU performance.\n\n| Run | Result | Mean FPS | P95 frame ms | Long tasks | Placements | Restarts |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\nSee each report.json for state samples, UI errors and screenshots; measurements.json contains raw rAF deltas and long tasks.\n`);
  console.log(`${summary.status}: reports and screenshots written to ${output}`);
  process.exitCode = summary.status === 'PASS' ? 0 : 1;
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolveClose => server.close(resolveClose));
}
