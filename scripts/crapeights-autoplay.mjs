/**
 * Real-input Crappy Eights endurance check; no game-state mutation or timer skips.
 *
 * PLAYWRIGHT_CHANNEL=chromium node scripts/crapeights-autoplay.mjs
 * Options: --port 8154 --rounds 2 --seed 8042 --timeout 180000 --output <directory>
 * Artifacts default to docs/1000x/crapeights-autoplay inside this checkout.
 * Exit 1 means a console/page error, stuck round, overflow, or inaccessible hand.
 */
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const options = { port: 8154, rounds: 2, seed: 8042, timeout: 180000,
  output: resolve(root, 'docs/1000x/crapeights-autoplay') };
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index].replace(/^--/, '');
  const value = process.argv[index + 1];
  if (!(name in options) || value === undefined) {
    throw new Error(`Unknown/incomplete option: ${process.argv[index]}`);
  }
  options[name] = name === 'output' ? resolve(value) : Number(value);
}
for (const name of ['port', 'rounds', 'seed', 'timeout']) {
  if (!Number.isSafeInteger(options[name]) || options[name] < 1) {
    throw new Error(`--${name} must be a positive integer`);
  }
}
if (options.port > 65535) throw new Error('--port must be at most 65535');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const within = relative(root, path);
    if (within.startsWith('..') || isAbsolute(within)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const content = await readFile(path);
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
    response.end(content);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

const report = { startedAt: new Date().toISOString(), options, results: [], errors: [] };
let browser;

async function inspect(page) {
  return page.evaluate(() => {
    const hands = players.map(player => player.hand.map(card => card.id));
    const state = {
      round: roundNumber, active: roundActive, player: currentPlayer, direction,
      suit: activeSuit, deck: deck.map(card => card.id), discard: discard.map(card => card.id),
      hands, scores: players.map(player => player.score), drawn: hasDrawnThisTurn,
      pendingWild: pendingWildCard?.id || null, pendingDrawCards, pendingSkips,
      onboardingOpen, focusSuspendedRound,
    };
    const hand = players[0]?.hand || [];
    const suits = ['S', 'H', 'D', 'C'];
    suits.sort((a, b) => hand.filter(card => card.rank !== '8' && card.suit === b).length
      - hand.filter(card => card.rank !== '8' && card.suit === a).length);
    const cards = [...document.querySelectorAll('#playerHand .card-btn')].map(element => {
      const bounds = element.getBoundingClientRect();
      return { id: element.dataset.id || element.dataset.cardId, width: element.offsetWidth,
        height: element.offsetHeight, left: bounds.left, right: bounds.right,
        top: bounds.top, bottom: bounds.bottom };
    });
    return { key: JSON.stringify(state), state, suitChoice: suits[0],
      playable: getPlayableCards(hand).length,
      status: document.querySelector('#statusText')?.textContent,
      layout: { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth, cards },
    };
  });
}

async function activate(page, selector, touch) {
  const button = page.locator(selector).first();
  if (!await button.isVisible() || !await button.isEnabled()) return false;
  try {
    if (touch) await button.tap({ timeout: 1500 });
    else await button.click({ timeout: 1500 });
    return true;
  } catch (error) {
    // A scheduled auto-pass may legitimately disable a button during pointer input.
    if (!await button.isEnabled()) return false;
    throw error;
  }
}

async function runViewport(viewport) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 600,
    isMobile: viewport.width < 600, reducedMotion: 'no-preference' });
  // Fix randomness only. Deal, pacing, AI, input and storage remain the real game.
  await context.addInitScript(seed => {
    let value = seed >>> 0;
    Math.random = () => {
      value = (Math.imul(1664525, value) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }, options.seed + viewport.width);
  const page = await context.newPage();
  const result = { viewport, roundsCompleted: 0, actions: { Smart: 0, Draw: 0, Pass: 0, Suit: 0 },
    errors: [], layoutIssues: [], timeline: [], screenshots: [] };
  report.results.push(result);
  page.on('console', message => {
    if (message.type() === 'error') result.errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', error => result.errors.push(`page: ${error.stack || error.message}`));
  page.on('dialog', dialog => dialog.accept());
  const screenshot = async label => {
    const filename = `${viewport.width}-${label}.png`;
    await page.screenshot({ path: resolve(options.output, filename), fullPage: true });
    result.screenshots.push(filename);
  };
  let lastKey = '';
  let lastChangedAt = Date.now();
  let roundStartedAt = Date.now();
  let lastLogAt = Date.now();
  let changes = 0;
  const layoutIssues = new Set();
  try {
    await page.goto(`http://127.0.0.1:${options.port}/crapeights.html`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Quick Start', exact: true }).click();
    await page.waitForFunction(() => roundActive && !onboardingOpen);
    await page.waitForTimeout(650);
    await screenshot('opening');
    roundStartedAt = lastChangedAt = Date.now();
    while (result.roundsCompleted < options.rounds) {
      const snapshot = await inspect(page);
      const now = Date.now();
      if (snapshot.key !== lastKey) {
        lastKey = snapshot.key;
        lastChangedAt = now;
        changes += 1;
        result.timeline.push({ elapsedMs: now - roundStartedAt, ...snapshot.state,
          status: snapshot.status });
        const layout = snapshot.layout;
        if (layout.scrollWidth > layout.viewport + 1 || layout.bodyWidth > layout.viewport + 1) {
          layoutIssues.add(`Horizontal overflow: ${Math.max(layout.scrollWidth, layout.bodyWidth)} > ${layout.viewport}`);
        }
        for (const card of layout.cards) {
          if (card.width < 44 || card.height < 44) {
            layoutIssues.add(`Hand card tap box ${card.width}×${card.height} is below 44px`);
          }
          if (card.left < -1 || card.right > layout.viewport + 1) {
            layoutIssues.add(`Hand extends beyond viewport (${Math.round(card.left)}..${Math.round(card.right)})`);
          }
        }
        if (changes === 16) await screenshot('in-play');
      }
      if (!snapshot.state.active) {
        await page.waitForTimeout(1800);
        result.roundsCompleted += 1;
        await screenshot(`round-${result.roundsCompleted}-receipt`);
        console.log(`[${viewport.width}] round ${result.roundsCompleted}/${options.rounds} finished; scores ${snapshot.state.scores.join('/')}`);
        if (result.roundsCompleted === options.rounds) break;
        const next = await activate(page, '#nextRoundBtn', viewport.width < 600);
        if (!next && !await activate(page, '#newMatchOverlayBtn', viewport.width < 600)) {
          throw new Error('Finished round has no available Next Round or New Match button');
        }
        lastChangedAt = roundStartedAt = Date.now();
        continue;
      }
      if (now - lastChangedAt >= 10000) {
        throw new Error(`Stuck turn: no state change for 10s. ${snapshot.key}; ${snapshot.status}`);
      }
      if (now - roundStartedAt > options.timeout) {
        throw new Error(`Round exceeded ${options.timeout}ms despite progressing`);
      }
      if (now - lastLogAt >= 5000) {
        lastLogAt = now;
        console.log(`[${viewport.width}] round ${snapshot.state.round}, player ${snapshot.state.player}, hands ${snapshot.state.hands.map(hand => hand.length).join('/')}, ${changes} state changes`);
      }
      if (snapshot.state.pendingWild) {
        if (await activate(page, `[data-suit="${snapshot.suitChoice}"]`, viewport.width < 600)) result.actions.Suit += 1;
      } else if (snapshot.state.player === 0) {
        const action = snapshot.playable > 0 ? 'Smart' : snapshot.state.drawn ? 'Pass' : 'Draw';
        if (await activate(page, `#${action.toLowerCase()}Btn`, viewport.width < 600)) result.actions[action] += 1;
      }
      await page.waitForTimeout(100);
    }
    result.layoutIssues = [...layoutIssues];
    result.pass = result.roundsCompleted === options.rounds && result.errors.length === 0
      && result.layoutIssues.length === 0;
    console.log(`[${viewport.width}] ${result.pass ? 'PASS' : 'FAIL'}: ${result.roundsCompleted} full rounds; ${JSON.stringify(result.actions)}; errors=${result.errors.length}, layout=${result.layoutIssues.length}`);
  } catch (error) {
    result.errors.push(error.stack || error.message);
    result.layoutIssues = [...layoutIssues];
    result.pass = false;
    await screenshot('failure').catch(() => {});
    console.error(`[${viewport.width}] FAIL: ${error.message}`);
  } finally {
    await context.close();
  }
}

try {
  await mkdir(options.output, { recursive: true });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(options.port, '127.0.0.1', accept);
  });
  const channel = process.env.PLAYWRIGHT_CHANNEL;
  browser = await chromium.launch({ headless: true, channel: channel || undefined });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    await runViewport(viewport);
  }
} catch (error) {
  report.errors.push(error.stack || error.message);
  console.error(error.message);
} finally {
  if (browser) await browser.close();
  await new Promise(accept => server.close(accept));
  report.finishedAt = new Date().toISOString();
  report.pass = report.errors.length === 0 && report.results.length === 2
    && report.results.every(result => result.pass);
  await mkdir(options.output, { recursive: true });
  await writeFile(resolve(options.output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Crappy Eights autoplay ${report.pass ? 'PASS' : 'FAIL'}; artifacts: ${options.output}`);
  process.exitCode = report.pass ? 0 : 1;
}
