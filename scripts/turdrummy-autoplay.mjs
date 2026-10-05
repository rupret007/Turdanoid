#!/usr/bin/env node
/**
 * TurdRummy autoplay harness (round 3). Not run by vitest.
 *
 * Serves the repo, then plays TurdRummy through the real controls (taps on cards and buttons,
 * never direct state writes) at phone, small-phone and desktop sizes. It records:
 *   - console errors and uncaught page errors
 *   - stuck turns: no state change for 10 s while the table should be moving
 *   - overlays that do not dismiss after their button is pressed
 *   - horizontal scroll, and dock/hand controls cut off the viewport
 *   - clicks that Playwright cannot land (something covers the card or button)
 *   - bot turn latency (how long the bot takes between the player's move and its own)
 *   - screenshots every few actions, plus round-end and trophy frames
 *
 * Scenarios: phone (390x844), small (320x640), desktop (1280x800), reduced (390x844 with
 * prefers-reduced-motion), continue (navigate away mid-round, come back, play on), keyboard
 * (Tab/Arrow/Enter only, with focus-visibility checks).
 *
 * Usage:
 *   node scripts/turdrummy-autoplay.mjs [--scenarios=phone,small,desktop,reduced,continue,keyboard]
 *        [--rounds=2] [--match] [--seed=1] [--max-actions=400] [--out=DIR] [--base=URL]
 * Env:
 *   PLAYWRIGHT_CHANNEL  browser channel (default: Playwright's bundled Chromium)
 *
 * Exit code is 1 when any finding was recorded.
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const SCENARIO_DEFS = {
  phone: { viewport: { width: 390, height: 844 }, mobile: true, handAboveFold: true },
  small: { viewport: { width: 320, height: 640 }, mobile: true },
  desktop: { viewport: { width: 1280, height: 800 }, mobile: false, handAboveFold: true },
  reduced: { viewport: { width: 390, height: 844 }, mobile: true, reducedMotion: 'reduce', handAboveFold: true },
  continue: { viewport: { width: 390, height: 844 }, mobile: true },
  keyboard: { viewport: { width: 1280, height: 800 }, mobile: false }
};
const STUCK_MS = 10000;
const SHOT_EVERY = 6;
const MAX_SHOTS = 14;

function parseArgs(argv) {
  const opts = {
    scenarios: ['phone', 'small', 'desktop', 'reduced', 'continue', 'keyboard'],
    rounds: 2,
    match: false,
    seed: 1,
    maxActions: 400,
    out: join(tmpdir(), 'turdrummy-autoplay'),
    base: ''
  };
  for (const arg of argv) {
    if (arg === '--match') opts.match = true;
    else if (arg.startsWith('--scenarios=')) opts.scenarios = arg.slice(12).split(',').filter(Boolean);
    else if (arg.startsWith('--rounds=')) opts.rounds = Number(arg.slice(9));
    else if (arg.startsWith('--seed=')) opts.seed = Number(arg.slice(7));
    else if (arg.startsWith('--max-actions=')) opts.maxActions = Number(arg.slice(14));
    else if (arg.startsWith('--out=')) opts.out = arg.slice(6);
    else if (arg.startsWith('--base=')) opts.base = arg.slice(7);
    else if (arg === '--trace') opts.trace = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  for (const name of opts.scenarios) {
    if (!SCENARIO_DEFS[name]) throw new Error(`unknown scenario: ${name}`);
  }
  return opts;
}

function startServer(port) {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
      const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
      const filePath = join(root, safePath === '/' ? 'index.html' : safePath);
      const body = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

// Seeded RNG so a failing run can be replayed with the same --seed.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Everything the harness needs from the page, read in one evaluate call.
const READ_STATE = () => ({
  initialized: state.initialized,
  round: state.round,
  turn: state.turn,
  phase: state.phase,
  roundOver: state.roundOver,
  matchOver: state.matchOver,
  playerScore: state.playerScore,
  aiScore: state.aiScore,
  selected: state.selectedCardId,
  drawnId: state.drawnCardId,
  drawnSource: state.drawnCardSource,
  stock: state.stock.length,
  discardTop: state.discard.length ? state.discard[state.discard.length - 1].id : null,
  hand: state.playerHand.map((card) => card.id),
  aiHandCount: state.aiHand.length,
  message: String(state.message || ''),
  guideOpen: document.getElementById('guideOverlay').classList.contains('show'),
  trophyOpen: document.getElementById('trophyOverlay').classList.contains('show'),
  coachVisible: !document.getElementById('coachCard').hidden,
  coachStep: document.getElementById('coachStep').textContent,
  overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  enabled: {
    drawStock: !document.getElementById('drawStockBtn').disabled,
    drawDiscard: !document.getElementById('drawDiscardBtn').disabled,
    discard: !document.getElementById('discardBtn').disabled,
    knock: !document.getElementById('knockBtn').disabled,
    gin: !document.getElementById('ginBtn').disabled,
    newRound: !document.getElementById('newRoundBtn').disabled
  }
});

// Changes whenever anything the player or the bot can move shifts.
const FINGERPRINT = () => JSON.stringify([
  state.round, state.turn, state.phase, state.roundOver, state.matchOver,
  state.playerScore, state.aiScore, state.stock.length,
  state.discard.map((card) => card.id).join(),
  state.playerHand.map((card) => card.id).join(),
  state.aiHand.length, state.selectedCardId, state.drawnCardId,
  state.lastAiAction, state.message
]);

// Smart policy, evaluated by the page's own analyzer: best discard, and whether the top discard helps.
const PLAN = () => {
  const hand = state.playerHand;
  const blocked = state.drawnCardSource === 'discard' ? state.drawnCardId : null;
  let best = null;
  for (const card of hand) {
    if (card.id === blocked) continue;
    const dw = analyzeHand(handAfterDiscard(hand, card.id)).deadwoodScore;
    if (!best || dw < best.dw) best = { id: card.id, dw };
  }
  const now = analyzeHand(hand).deadwoodScore;
  let takeDiscardGain = 0;
  if (state.discard.length) {
    const top = state.discard[state.discard.length - 1];
    const withTop = [...hand, top];
    let bestWithTop = Infinity;
    for (const card of withTop) {
      if (card.id === top.id) continue;
      bestWithTop = Math.min(bestWithTop, analyzeHand(handAfterDiscard(withTop, card.id)).deadwoodScore);
    }
    takeDiscardGain = now - bestWithTop;
  }
  return { bestId: best ? best.id : null, bestDw: best ? best.dw : null, takeDiscardGain, now };
};

async function fingerprintOf(page) {
  return page.evaluate(FINGERPRINT);
}

async function waitForChange(page, before, timeout = STUCK_MS) {
  return page.waitForFunction((fp) => {
    const cur = JSON.stringify([
      state.round, state.turn, state.phase, state.roundOver, state.matchOver,
      state.playerScore, state.aiScore, state.stock.length,
      state.discard.map((card) => card.id).join(),
      state.playerHand.map((card) => card.id).join(),
      state.aiHand.length, state.selectedCardId, state.drawnCardId,
      state.lastAiAction, state.message
    ]);
    return cur !== fp;
  }, before, { timeout, polling: 100 });
}

function createHarness({ browser, base, opts, cfg, name, outDir, report }) {
  const rng = mulberry32(opts.seed + name.length * 97);
  const findings = report.findings;
  let shots = 0;
  let seq = 0;
  let context = null;
  let page = null;
  let actions = 0;
  let dialogs = 0;
  let foldMeasured = false;
  const botLatency = [];
  const found = (kind, detail) => findings.push({ scenario: name, kind, detail });
  const trace = (line) => { if (opts.trace) console.log(`[trace ${name}] ${line}`); };

  async function shot(tag) {
    if (shots >= MAX_SHOTS) return;
    shots += 1;
    seq += 1;
    await mkdir(outDir, { recursive: true });
    await page.screenshot({ path: join(outDir, `${name}-${String(seq).padStart(2, '0')}-${tag}.png`) });
  }

  async function tap(locator, pos) {
    const options = { timeout: 3000, ...(pos ? { position: pos } : {}) };
    if (cfg.mobile) await locator.tap(options);
    else await locator.click(options);
  }

  async function press(selector, tag) {
    const locator = page.locator(selector).first();
    try {
      await tap(locator);
    } catch (error) {
      found('click-blocked', `${tag} (${selector}) could not be tapped: ${String(error.message).split('\n')[0]}`);
      throw new Error('blocked');
    }
    actions += 1;
  }

  async function tapCard(id) {
    const locator = page.locator(`#playerHand [data-card-id="${id}"]`).first();
    const box = await locator.boundingBox();
    // A real finger lands on the visible left strip of an overlapped fan card.
    const pos = box ? { x: Math.max(4, box.width * 0.25), y: box.height * 0.5 } : undefined;
    try {
      await tap(locator, pos);
      if (opts.trace) {
        const at = await page.evaluate(() => ({ sel: state.selectedCardId, scrollY: window.scrollY, hand: document.getElementById('playerHand').getBoundingClientRect().top }));
        trace(`tapped ${id} pos ${JSON.stringify(pos)} -> ${JSON.stringify(at)}`);
      }
    } catch (error) {
      found('click-blocked', `card ${id} could not be tapped on its visible strip: ${String(error.message).split('\n')[0]}`);
      throw new Error('blocked');
    }
    actions += 1;
  }

  async function checkLayout(tag) {
    const issues = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const out = [];
      const sel = ['.action-dock button', '#playerHand .card-button', '.topbar button', '#messageBox'];
      for (const s of sel) {
        for (const node of document.querySelectorAll(s)) {
          if (node.closest('[hidden]') || node.offsetParent === null) continue;
          const r = node.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.left < -1 || r.right > vw + 1) out.push(`${s} ${node.id || node.dataset.cardId || ''} x ${Math.round(r.left)}..${Math.round(r.right)} of ${vw}`);
          if (s === '.action-dock button' && (r.bottom > vh + 1 || r.top < 0)) out.push(`dock button ${node.id} y ${Math.round(r.top)}..${Math.round(r.bottom)} of ${vh}`);
        }
      }
      return out.slice(0, 6);
    });
    for (const issue of issues) found('cut-off', `${tag}: ${issue}`);
  }

  // First-screen fit: every card of the player's hand should sit above the sticky action dock
  // without scrolling. Sizes where that cannot fit (320x640) record the numbers but do not fail.
  async function measureFold() {
    const m = await page.evaluate(() => {
      const dock = document.querySelector('.action-dock').getBoundingClientRect();
      const cards = Array.from(document.querySelectorAll('#playerHand .card-button')).map((c) => c.getBoundingClientRect());
      const above = cards.filter((r) => r.top >= 0 && r.bottom <= dock.top + 1).length;
      return { vh: window.innerHeight, dockTop: Math.round(dock.top), cards: cards.length, above, cardTop: Math.round(Math.min(...cards.map((r) => r.top))), cardBottom: Math.round(Math.max(...cards.map((r) => r.bottom))) };
    });
    report.folds.push({ scenario: name, ...m });
    if (cfg.handAboveFold && m.above < m.cards) {
      found('hand-below-fold', `only ${m.above} of ${m.cards} hand cards sit above the dock at ${cfg.viewport.width}x${cfg.viewport.height} (dock top ${m.dockTop}, cards ${m.cardTop}-${m.cardBottom})`);
    }
  }

  async function dismissOverlay(kind) {
    const before = await page.evaluate(() => ({
      guide: document.getElementById('guideOverlay').classList.contains('show'),
      trophy: document.getElementById('trophyOverlay').classList.contains('show')
    }));
    if (kind === 'guide') await press('#startRoundBtn', 'start round');
    if (kind === 'trophy') await press('#trophyRematchBtn', 'trophy rematch');
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({
      guide: document.getElementById('guideOverlay').classList.contains('show'),
      trophy: document.getElementById('trophyOverlay').classList.contains('show')
    }));
    if ((kind === 'guide' && before.guide && after.guide) || (kind === 'trophy' && before.trophy && after.trophy)) {
      found('overlay-stuck', `${kind} overlay did not dismiss after its button`);
    }
  }

  // Plays one legal move (or waits for the bot). Returns false when the scenario should end.
  async function step() {
    if (actions >= opts.maxActions) return false;
    const s = await page.evaluate(READ_STATE);
    if (!foldMeasured && s.hand.length >= 10 && s.turn === 'player' && s.phase === 'draw' && !s.guideOpen) {
      foldMeasured = true;
      await measureFold();
      await shot('first-hand');
    }
    if (s.overflowX > 1) found('horizontal-scroll', `${s.overflowX}px wider than the viewport on ${name} at round ${s.round}`);

    if (s.guideOpen) {
      await dismissOverlay('guide');
      return true;
    }
    if (s.trophyOpen) {
      await dismissOverlay('trophy');
      return true;
    }
    if (s.coachVisible && rng() < 0.4) {
      await press('#coachNextBtn', `coach next (${s.coachStep})`);
      return true;
    }
    if (!s.initialized) {
      await press('#newRoundBtn', 'first round');
      return true;
    }
    if (s.matchOver) {
      await shot('match-over');
      return false;
    }
    if (s.roundOver) {
      await shot('round-end');
      await page.waitForTimeout(1200);
      await press('#newRoundBtn', 'next round');
      return true;
    }

    if (s.turn === 'ai') {
      const started = Date.now();
      const before = await fingerprintOf(page);
      try {
        await waitForChange(page, before);
      } catch {
        const snap = await page.evaluate(READ_STATE);
        const focus = await page.evaluate(() => ({ hidden: document.hidden, focused: document.hasFocus() }));
        found('stuck', `bot turn: no state change for ${STUCK_MS / 1000}s; message "${snap.message}"; focus ${JSON.stringify(focus)}; turn ${snap.turn}/${snap.phase}`);
        await shot('stuck');
        return false;
      }
      botLatency.push(Date.now() - started);
      return true;
    }

    if (s.phase === 'draw') {
      const plan = await page.evaluate(PLAN);
      const useDiscard = s.enabled.drawDiscard && plan.takeDiscardGain >= 3;
      const before = await fingerprintOf(page);
      await press(useDiscard ? '#drawDiscardBtn' : '#drawStockBtn', useDiscard ? 'draw discard' : 'draw stock');
      await waitForChange(page, before).catch(() => found('stuck', 'draw did not change state'));
      if (actions % SHOT_EVERY === 0) await shot('mid-round');
      return true;
    }

    // Discard phase: knock or gin when legal, otherwise discard the best card.
    const plan = await page.evaluate(PLAN);
    if (plan.bestId === null) {
      found('stuck', 'discard phase with no discardable card');
      await shot('stuck');
      return false;
    }
    if (s.enabled.gin && plan.bestDw === 0) {
      if (s.selected !== plan.bestId) await tapCard(plan.bestId);
      await press('#ginBtn', 'gin');
      await page.waitForTimeout(150);
      return true;
    }
    if (s.enabled.knock && plan.bestDw <= 10 && rng() < 0.5) {
      if (s.selected !== plan.bestId) await tapCard(plan.bestId);
      await press('#knockBtn', 'knock');
      await page.waitForTimeout(150);
      return true;
    }
    if (s.selected !== plan.bestId) {
      trace(`select ${plan.bestId} (dw ${plan.bestDw}, selected ${s.selected})`);
      await tapCard(plan.bestId);
      return true;
    }
    const before = await fingerprintOf(page);
    trace(`discard ${plan.bestId}`);
    await press('#discardBtn', 'discard');
    await waitForChange(page, before).catch(() => found('stuck', 'discard did not change state'));
    return true;
  }

  async function play({ untilRounds = opts.rounds, untilMatch = opts.match, label = '' } = {}) {
    let rounds = 0;
    let lastRound = -1;
    while (actions < opts.maxActions) {
      let keepGoing;
      try {
        keepGoing = await step();
      } catch (error) {
        // A blocked tap is already recorded as a finding; the scenario cannot continue past it.
        if (error.message === 'blocked') break;
        throw error;
      }
      const s = await page.evaluate(READ_STATE);
      if (s.round !== lastRound && s.round > 0) {
        lastRound = s.round;
        rounds = Math.max(rounds, s.round);
      }
      if (!keepGoing) break;
      if (!untilMatch && rounds >= untilRounds && s.roundOver) break;
      if (untilMatch && s.matchOver) {
        // Let the trophy appear, then record it and stop.
        await page.waitForTimeout(2000);
        const trophy = await page.evaluate(() => document.getElementById('trophyOverlay').classList.contains('show'));
        if (trophy) await shot('trophy');
        else found('overlay-missing', 'match ended but the trophy overlay never showed');
        break;
      }
    }
    return { rounds: rounds, label };
  }

  return {
    attach(ctx, p) {
      context = ctx;
      page = p;
      page.on('pageerror', (error) => found('page-error', String(error.message || error).slice(0, 300)));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const text = message.text();
        if (/favicon/i.test(text)) return;
        found('console-error', text.slice(0, 300));
      });
      page.on('dialog', (dialog) => {
        dialogs += 1;
        dialog.accept().catch(() => {});
      });
    },
    get page() { return page; },
    get actions() { return actions; },
    count() { actions += 1; },
    get dialogs() { return dialogs; },
    botLatency,
    shot,
    checkLayout,
    play,
    found,
    press,
    tapCard,
    step,
    rng
  };
}

async function openTable(page, base) {
  await page.bringToFront();
  await page.goto(`${base}/turdrummy.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof state !== 'undefined');
}

async function runPointScenario(browser, name, base, opts, report, outDir) {
  const cfg = SCENARIO_DEFS[name];
  const harness = createHarness({ browser, base, opts, cfg, name, outDir, report });
  const context = await browser.newContext({
    viewport: cfg.viewport,
    isMobile: cfg.mobile,
    hasTouch: cfg.mobile,
    deviceScaleFactor: cfg.mobile ? 2 : 1,
    ...(cfg.reducedMotion ? { reducedMotion: cfg.reducedMotion } : {})
  });
  const page = await context.newPage();
  harness.attach(context, page);
  const started = Date.now();
  await openTable(page, base);
  await page.evaluate(() => {
    window.__flights = 0;
    new MutationObserver((records) => {
      for (const r of records) {
        for (const node of r.addedNodes) {
          if (node.classList && node.classList.contains('fly-card')) window.__flights += 1;
        }
      }
    }).observe(document.body, { childList: true });
  });
  await harness.checkLayout('start');
  const { rounds } = await harness.play({ label: name });
  await harness.checkLayout('end');
  const flights = await page.evaluate(() => window.__flights || 0);
  const canvases = await page.evaluate(() => document.querySelectorAll('canvas').length);
  if (cfg.reducedMotion && (flights > 0 || canvases > 0)) {
    harness.found('reduced-motion', `expected no flights or confetti canvas, saw ${flights} flights and ${canvases} canvases`);
  }
  report.runs.push({
    scenario: name,
    viewport: cfg.viewport,
    reducedMotion: cfg.reducedMotion || 'no-preference',
    actions: harness.actions,
    rounds,
    dialogs: harness.dialogs,
    flights,
    botLatencyMs: summarize(harness.botLatency),
    seconds: Math.round((Date.now() - started) / 1000)
  });
  await context.close();
}

// Save, leave for the hub and come back mid-round: the same table must restore and accept a move.
async function runContinueScenario(browser, base, opts, report, outDir) {
  const name = 'continue';
  const cfg = SCENARIO_DEFS.continue;
  const harness = createHarness({ browser, base, opts, cfg, name, outDir, report });
  const context = await browser.newContext({ viewport: cfg.viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  harness.attach(context, page);
  await openTable(page, base);
  await harness.press('#startRoundBtn', 'start round');
  for (let i = 0; i < 4; i += 1) await harness.step();
  // Only leave on the player's turn so the restore check compares settled state.
  for (let i = 0; i < 20; i += 1) {
    const s = await page.evaluate(READ_STATE);
    if (s.turn === 'player' && !s.roundOver && !s.guideOpen && !s.trophyOpen) break;
    await harness.step();
  }
  const before = await page.evaluate(() => JSON.stringify({
    round: state.round, turn: state.turn, phase: state.phase, hand: state.playerHand.map((c) => c.id),
    stock: state.stock.map((c) => c.id), discard: state.discard.map((c) => c.id),
    player: state.playerScore, ai: state.aiScore, selected: state.selectedCardId
  }));
  await harness.shot('before-leave');
  await page.goto(`${base}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.goto(`${base}/turdrummy.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof state !== 'undefined' && state.initialized);
  const restored = await page.evaluate(() => ({
    guideOpen: document.getElementById('guideOverlay').classList.contains('show'),
    snapshot: JSON.stringify({
      round: state.round, turn: state.turn, phase: state.phase, hand: state.playerHand.map((c) => c.id),
      stock: state.stock.map((c) => c.id), discard: state.discard.map((c) => c.id),
      player: state.playerScore, ai: state.aiScore, selected: state.selectedCardId
    })
  }));
  if (restored.guideOpen) harness.found('continue', 'returning to a live table showed the welcome guide again');
  if (restored.snapshot !== before) {
    harness.found('continue', `restored table differs from the one left behind: ${before.slice(0, 160)} vs ${restored.snapshot.slice(0, 160)}`);
  }
  await harness.shot('restored');
  // The restored table must accept an action and move on.
  const acted = await page.evaluate(READ_STATE);
  if (acted.turn === 'player') {
    const fp = await fingerprintOf(page);
    if (acted.phase === 'draw') await harness.press('#drawStockBtn', 'draw after restore');
    else {
      await harness.tapCard(acted.hand[0]);
      await harness.press('#discardBtn', 'discard after restore');
    }
    await waitForChange(page, fp, 5000).catch(() => harness.found('continue', 'restored table did not accept an action'));
  }
  report.runs.push({ scenario: name, viewport: cfg.viewport, actions: harness.actions, restored: restored.snapshot === before });
  await context.close();
}

// Tab/Arrow/Enter only, one round. Checks every focused control shows a visible focus ring.
async function runKeyboardScenario(browser, base, opts, report, outDir) {
  const name = 'keyboard';
  const cfg = SCENARIO_DEFS.keyboard;
  const harness = createHarness({ browser, base, opts, cfg, name, outDir, report });
  const context = await browser.newContext({ viewport: cfg.viewport });
  const page = await context.newPage();
  harness.attach(context, page);
  await openTable(page, base);
  const focusCheck = async (tag) => {
    const ring = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { tag: 'none' };
      const cs = getComputedStyle(el);
      const visible = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 || cs.boxShadow !== 'none';
      return { tag: el.id || el.dataset.cardId || el.tagName, visible };
    });
    if (ring.tag !== 'none' && !ring.visible) harness.found('focus-invisible', `${tag}: focused ${ring.tag} has no visible focus ring`);
    return ring;
  };
  // Tab until the focus lands on the selector (or give up after 60 presses).
  const tabTo = async (selector, tag) => {
    for (let i = 0; i < 60; i += 1) {
      const hit = await page.evaluate((sel) => !!document.activeElement && document.activeElement.matches(sel), selector);
      if (hit) return true;
      await page.keyboard.press('Tab');
    }
    harness.found('keyboard', `${tag}: Tab never reached ${selector}`);
    return false;
  };

  await page.keyboard.press('Tab');
  const startBtn = await tabTo('#startRoundBtn', 'guide');
  if (startBtn) {
    await page.keyboard.press('Enter');
    await focusCheck('after guide');
  }
  await page.waitForTimeout(300);
  for (let turns = 0; turns < 200 && harness.actions < opts.maxActions; turns += 1) {
    const s = await page.evaluate(READ_STATE);
    if (s.roundOver) {
      await harness.shot('round-end');
      break;
    }
    if (s.coachVisible) {
      await tabTo('#coachNextBtn', 'coach');
      await page.keyboard.press('Enter');
      continue;
    }
    if (s.turn === 'ai') {
      await page.waitForTimeout(400);
      continue;
    }
    if (s.phase === 'draw') {
      const target = s.enabled.drawStock ? '#drawStockBtn' : '#drawDiscardBtn';
      if (!(await tabTo(target, 'draw'))) break;
      await focusCheck('draw button');
      await page.keyboard.press('Enter');
      harness.count();
      await page.waitForTimeout(200);
      continue;
    }
    // Discard: move focus into the hand, then arrow to the best card.
    const plan = await page.evaluate(PLAN);
    if (!(await tabTo('#playerHand .card-button', 'hand'))) break;
    const index = await page.evaluate((id) => {
      const buttons = Array.from(document.querySelectorAll('#playerHand button.card-button'));
      return buttons.findIndex((b) => b.dataset.cardId === id);
    }, plan.bestId);
    const current = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('#playerHand button.card-button'));
      return buttons.indexOf(document.activeElement);
    });
    for (let i = current; i < index; i += 1) await page.keyboard.press('ArrowRight');
    for (let i = current; i > index; i -= 1) await page.keyboard.press('ArrowLeft');
    await focusCheck('hand card');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
    if (!(await tabTo('#discardBtn', 'discard'))) break;
    await focusCheck('discard button');
    const before = await fingerprintOf(page);
    await page.keyboard.press('Enter');
    harness.count();
    await waitForChange(page, before, STUCK_MS).catch(() => harness.found('stuck', 'keyboard discard did not change state'));
  }
  report.runs.push({ scenario: name, viewport: cfg.viewport, actions: harness.actions });
  await context.close();
}

function summarize(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: sorted.length,
    median: sorted[Math.floor(sorted.length / 2)],
    max: sorted[sorted.length - 1]
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const port = 8166;
  let server = null;
  let base = opts.base;
  if (!base) {
    server = await startServer(port);
    base = `http://127.0.0.1:${port}`;
  }
  await mkdir(opts.out, { recursive: true });
  const launch = { headless: true };
  if (process.env.PLAYWRIGHT_CHANNEL) launch.channel = process.env.PLAYWRIGHT_CHANNEL;
  const browser = await chromium.launch(launch);
  const report = { base, seed: opts.seed, rounds: opts.rounds, match: opts.match, runs: [], folds: [], findings: [] };
  try {
    for (const name of opts.scenarios) {
      console.log(`[autoplay] ${name} ...`);
      if (name === 'continue') await runContinueScenario(browser, base, opts, report, opts.out);
      else if (name === 'keyboard') await runKeyboardScenario(browser, base, opts, report, opts.out);
      else await runPointScenario(browser, name, base, opts, report, opts.out);
    }
  } finally {
    await browser.close();
    if (server) server.close();
  }
  await writeFile(join(opts.out, 'report.json'), JSON.stringify(report, null, 2));
  for (const run of report.runs) console.log(`[autoplay] ${JSON.stringify(run)}`);
  if (report.findings.length === 0) {
    console.log('[autoplay] PASS: no findings');
  } else {
    console.log(`[autoplay] FAIL: ${report.findings.length} finding(s)`);
    for (const f of report.findings) console.log(`  - [${f.scenario}] ${f.kind}: ${f.detail}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
