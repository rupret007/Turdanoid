/**
 * Foreground real-input Crappy Eights playtest. No game-state or timer mutation.
 * PLAYWRIGHT_CHANNEL=chromium node scripts/crapeights-autoplay.mjs
 * Options: --port 8154 --rounds 2 --seed 8042 --timeout 180000
 *          --scenario all|phone|small|keyboard|reduced --output <checkout directory>
 * Four runs cover touch, 320px, keyboard-only and reduced motion. RNG is seeded;
 * dealing, bots, card selection, scoring, storage and pacing use the live page.
 * Artifacts stay in this worktree; the conductor may copy them into its reviews.
 */
import { createServer } from 'node:http';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const options = { port: 8154, rounds: 2, seed: 8042, timeout: 180000, scenario: 'all',
  output: resolve(root, 'docs/1000x/crapeights-autoplay-r3') };
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index].replace(/^--/, '');
  const value = process.argv[index + 1];
  if (!(name in options) || value === undefined) throw new Error(`Unknown/incomplete option: ${process.argv[index]}`);
  options[name] = name === 'output' ? resolve(value) : name === 'scenario' ? value : Number(value);
}
for (const name of ['port', 'rounds', 'seed', 'timeout']) {
  if (!Number.isSafeInteger(options[name]) || options[name] < 1) throw new Error(`--${name} must be a positive integer`);
}
if (options.port > 65535) throw new Error('--port must be at most 65535');
const outputRelative = relative(root, options.output);
if (outputRelative.startsWith('..') || isAbsolute(outputRelative)) throw new Error('--output must stay inside this worktree');
const scenarios = [
  { name: 'phone', viewport: { width: 390, height: 844 }, touch: true },
  { name: 'small', viewport: { width: 320, height: 640 }, touch: true },
  { name: 'keyboard', viewport: { width: 1280, height: 800 }, keyboard: true },
  { name: 'reduced', viewport: { width: 390, height: 844 }, touch: true, reduced: true },
].filter(scenario => options.scenario === 'all' || scenario.name === options.scenario);
if (!scenarios.length) throw new Error(`Unknown scenario: ${options.scenario}`);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    const within = relative(root, path);
    if (within.startsWith('..') || isAbsolute(within)) { response.writeHead(403).end('Forbidden'); return; }
    const content = await readFile(path);
    response.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
    response.end(content);
  } catch { response.writeHead(404).end('Not found'); }
});

const report = { startedAt: new Date().toISOString(), options, results: [], errors: [] };
let browser;

async function inspect(page) {
  return page.evaluate(() => {
    const state = {
      round: roundNumber, active: roundActive, player: currentPlayer, direction,
      suit: activeSuit, deck: deck.map(card => card.id), discard: discard.map(card => card.id),
      hands: players.map(player => player.hand.map(card => card.id)), scores: players.map(player => player.score),
      drawn: hasDrawnThisTurn, pendingWild: pendingWildCard?.id || null,
      pendingDrawCards, pendingSkips, onboardingOpen, focusSuspendedRound,
    };
    const suits = ['S', 'H', 'D', 'C'];
    suits.sort((a, b) => players[0].hand.filter(card => card.rank !== '8' && card.suit === b).length
      - players[0].hand.filter(card => card.rank !== '8' && card.suit === a).length);
    const cards = [...document.querySelectorAll('#playerHand .card-btn')].map(element => {
      const bounds = element.getBoundingClientRect();
      return { id: element.dataset.cardId, rank: element.dataset.rank,
        playable: element.classList.contains('playable'), width: element.offsetWidth, height: element.offsetHeight,
        left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom };
    });
    const status = document.querySelector('#statusText');
    return { key: JSON.stringify(state), state, suitChoice: suits[0], cards,
      status: status?.textContent, live: { role: status?.getAttribute('role'), politeness: status?.getAttribute('aria-live') },
      layout: { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth, height: document.documentElement.scrollHeight },
      overlays: [...document.querySelectorAll('.overlay')].filter(element => getComputedStyle(element).display !== 'none').map(element => element.id),
      motion: { reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        animated: document.getAnimations().filter(animation => animation.playState === 'running'
          && Number(animation.effect?.getComputedTiming().duration) > 1).map(animation => animation.effect?.target?.className || '') },
    };
  });
}

async function checkFocus(page, result) {
  const focus = await page.evaluate(() => {
    const element = document.activeElement;
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return { tag: element.tagName, id: element.id, card: element.dataset.cardId,
      visible: element.matches(':focus-visible'), outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0,
      shadow: style.boxShadow !== 'none', inViewport: bounds.bottom > 0 && bounds.top < innerHeight };
  });
  if (!focus.visible || (!focus.outline && !focus.shadow) || !focus.inViewport) {
    throw new Error(`Keyboard focus is not visible: ${JSON.stringify(focus)}`);
  }
  result.keyboard.focusChecks += 1;
}

async function tabTo(page, selector, result) {
  for (let count = 0; count < 120; count += 1) {
    if (await page.evaluate(selector => document.activeElement?.matches(selector), selector)) {
      await checkFocus(page, result);
      return;
    }
    await page.keyboard.press('Tab');
    result.keyboard.tabs += 1;
  }
  throw new Error(`Keyboard Tab cannot reach ${selector}`);
}

async function activate(page, selector, scenario, result) {
  const button = page.locator(selector).first();
  if (!await button.isVisible() || !await button.isEnabled()) return false;
  // Native input only. Focus is reached through Tab rather than locator.focus().
  if (scenario.keyboard) {
    await tabTo(page, selector, result);
    await page.keyboard.press('Enter');
    result.keyboard.enters += 1;
  } else if (scenario.touch) await button.tap({ timeout: 4000 });
  else await button.click({ timeout: 4000 });
  return true;
}

async function checkModalLayout(page, selector, result) {
  const issues = await page.locator(selector).evaluate(overlay => {
    const problems = [];
    if (document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1) problems.push('document overflows horizontally');
    const card = overlay.querySelector('.overlay-card');
    if (card && card.scrollWidth > card.clientWidth + 1) problems.push('modal contents overflow horizontally');
    for (const element of overlay.querySelectorAll('button,select,a[href]')) {
      if (!element.getClientRects().length) continue;
      const bounds = element.getBoundingClientRect();
      if (bounds.left < -1 || bounds.right > innerWidth + 1) problems.push(`${element.textContent.trim()} extends past viewport`);
    }
    return problems;
  });
  if (issues.length) throw new Error(`${selector}: ${issues.join('; ')}`);
  result.modalChecks.push(`${selector} has no horizontal overflow`);
}

async function waitDismissed(page, selector) {
  await page.locator(selector).waitFor({ state: 'hidden', timeout: 2500 });
}

async function tapCard(page, card, scenario, result) {
  const selector = `#playerHand [data-card-id="${card.id}"]`;
  if (scenario.keyboard) {
    await tabTo(page, '#playerHand .card-btn', result);
    // Exercise the hand's actual arrow-key traversal, then native activation.
    for (let count = 0; count <= 52; count += 1) {
      if (await page.evaluate(id => document.activeElement?.dataset.cardId === id, card.id)) break;
      if (count === 52) throw new Error(`Arrow keys cannot reach card ${card.id}`);
      await page.keyboard.press('ArrowRight');
      result.keyboard.arrows += 1;
    }
    await checkFocus(page, result);
    await page.keyboard.press('Enter');
    result.keyboard.enters += 1;
    if ((await inspect(page)).state.pendingWild) return;
    await page.keyboard.press('KeyP');
    result.keyboard.plays += 1;
  } else {
    // Find an actually exposed point in the fan; a card's center can be covered.
    const button = page.locator(selector);
    await button.scrollIntoViewIfNeeded();
    const point = await button.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      for (const y of [14, 25, bounds.height / 2, bounds.height - 14]) {
        for (const x of [14, 25, bounds.width / 2, bounds.width - 14]) {
          if (element.contains(document.elementFromPoint(bounds.left + x, bounds.top + y))) {
            return { x: bounds.left + x, y: bounds.top + y };
          }
        }
      }
      return null;
    });
    if (!point) throw new Error(`Playable card ${card.id} has no exposed tap point`);
    if (scenario.touch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    // Selection can lift a card. The second action uses the stable native Play button.
    if (!(await inspect(page)).state.pendingWild) await activate(page, '#playBtn', scenario, result);
  }
  result.actions.Card += 1;
}

async function readSave(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('turdsuite_continue_v1'))?.games?.['crapeights.html']?.snapshot);
}

async function continueViaHub(page, scenario, result, screenshot) {
  const before = await readSave(page);
  if (!before || !before.roundActive || before.currentPlayer !== 0) throw new Error('Continue check did not start on a live human turn');
  if (scenario.touch) await activate(page, '.mobile-menu summary', scenario, result);
  await Promise.all([
    page.waitForURL(url => url.pathname === '/' || url.pathname === '/index.html'),
    activate(page, scenario.touch ? '.mobile-menu-actions button' : '.actions button', scenario, result),
  ]);
  const resume = '.game-card[href="crapeights.html"]';
  if (!(await page.locator(`${resume} .play`).textContent()).includes('Continue')) throw new Error('Hub does not offer Continue for the live table');
  await Promise.all([
    page.waitForURL('**/crapeights.html'),
    activate(page, resume, scenario, result),
  ]);
  await page.waitForFunction(() => typeof roundActive !== 'undefined' && roundActive);
  const after = await readSave(page);
  if (JSON.stringify(after) !== JSON.stringify(before)) {
    throw new Error(`Continue changed saved table: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`);
  }
  if ((await inspect(page)).overlays.length) throw new Error('An overlay blocks the restored table');
  result.continue.exactSnapshot = true;
  result.continue.before = before;
  await screenshot('continued');
}

async function runScenario(scenario) {
  const context = await browser.newContext({ viewport: scenario.viewport, hasTouch: !!scenario.touch, isMobile: !!scenario.touch });
  await context.addInitScript(seed => {
    // Separate streams make shuffles reproducible without depending on cosmetic FX.
    let deal = seed >>> 0;
    let cosmetic = (seed + 1024) >>> 0;
    Math.random = () => { cosmetic = (Math.imul(1664525, cosmetic) + 1013904223) >>> 0; return cosmetic / 4294967296; };
    Crypto.prototype.getRandomValues = function(array) {
      for (let index = 0; index < array.length; index += 1) { deal = (Math.imul(1664525, deal) + 1013904223) >>> 0; array[index] = deal; }
      return array;
    };
    window.__ceAutoplayAnnouncements = [];
    document.addEventListener('DOMContentLoaded', () => {
      const status = document.querySelector('#statusText');
      if (!status) return;
      new MutationObserver(() => window.__ceAutoplayAnnouncements.push(status.textContent)).observe(status, { subtree: true, childList: true, characterData: true });
    });
  }, options.seed + scenario.viewport.width + (scenario.reduced ? 1 : 0));
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: scenario.reduced ? 'reduce' : 'no-preference' });
  const result = { scenario: scenario.name, viewport: scenario.viewport, reducedMotion: !!scenario.reduced,
    roundsCompleted: 0, matchesCompleted: 0, actions: { Card: 0, Smart: 0, Draw: 0, Pass: 0, Suit: 0 },
    keyboard: { tabs: 0, enters: 0, arrows: 0, plays: 0, focusChecks: 0 },
    continue: { exactSnapshot: false, acceptedAction: false }, modalChecks: [], announcements: [],
    errors: [], layoutIssues: [], timeline: [], screenshots: [] };
  report.results.push(result);
  page.on('console', message => { if (message.type() === 'error') result.errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => result.errors.push(`page: ${error.stack || error.message}`));
  page.on('dialog', dialog => dialog.accept());
  const screenshot = async label => {
    const filename = `${scenario.name}-${scenario.viewport.width}-${label}.png`;
    await page.screenshot({ path: resolve(options.output, filename), fullPage: true });
    result.screenshots.push(filename);
  };
  const collectAnnouncements = async () => {
    result.announcements.push(...await page.evaluate(() => window.__ceAutoplayAnnouncements.splice(0)));
  };
  let lastKey = '';
  let lastChangedAt = Date.now();
  let roundStartedAt = Date.now();
  let lastLogAt = Date.now();
  let changes = 0;
  let humanTurns = 0;
  let continueKey = null;
  const layoutIssues = new Set();
  try {
    await page.goto(`http://127.0.0.1:${options.port}/crapeights.html`, { waitUntil: 'networkidle' });
    await checkModalLayout(page, '#welcomeGuide', result);
    await screenshot('guide');
    await activate(page, '#quickStartBtn', scenario, result);
    await waitDismissed(page, '#welcomeGuide');
    result.modalChecks.push('Quick Start dismisses guide');
    await page.waitForFunction(() => roundActive && !onboardingOpen);
    await page.waitForTimeout(scenario.reduced ? 50 : 650);
    await screenshot('opening');
    await activate(page, '#tableDrawerBtn', scenario, result);
    await page.locator('#tableDrawer').waitFor({ state: 'visible' });
    await checkModalLayout(page, '#tableDrawer', result);
    await activate(page, '#closeDrawerBtn', scenario, result);
    await waitDismissed(page, '#tableDrawer');
    result.modalChecks.push('Table details opens and dismisses');
    roundStartedAt = lastChangedAt = Date.now();
    while (result.roundsCompleted < options.rounds) {
      const snapshot = await inspect(page);
      const now = Date.now();
      await collectAnnouncements();
      if (snapshot.key !== lastKey) {
        lastKey = snapshot.key;
        lastChangedAt = now;
        changes += 1;
        result.timeline.push({ elapsedMs: now - roundStartedAt, ...snapshot.state, status: snapshot.status });
        if (continueKey && snapshot.key !== continueKey) { result.continue.acceptedAction = true; continueKey = null; }
        if (snapshot.live.role !== 'status' || !['polite', 'assertive'].includes(snapshot.live.politeness)) throw new Error('Turn status is not an accessible live region');
        const layout = snapshot.layout;
        if (layout.scrollWidth > layout.viewport + 1 || layout.bodyWidth > layout.viewport + 1) {
          layoutIssues.add(`Horizontal overflow: ${Math.max(layout.scrollWidth, layout.bodyWidth)} > ${layout.viewport}`);
        }
        for (const card of snapshot.cards) {
          if (card.width < 44 || card.height < 44) layoutIssues.add(`Hand card tap box ${card.width}×${card.height} is below 44px`);
          if (card.left < -1 || card.right > layout.viewport + 1) layoutIssues.add(`Hand extends beyond viewport (${Math.round(card.left)}..${Math.round(card.right)})`);
        }
        if (scenario.reduced && (!snapshot.motion.reduced || snapshot.motion.animated.length)) {
          throw new Error(`Reduced motion has running animations: ${snapshot.motion.animated.join(', ')}`);
        }
        if (changes % 6 === 0 && snapshot.state.active) await screenshot(`turn-${String(changes).padStart(3, '0')}`);
      }
      if (!snapshot.state.active) {
        await page.locator('#roundOverlay').waitFor({ state: 'visible', timeout: 2500 });
        await checkModalLayout(page, '#roundOverlay', result);
        await page.waitForTimeout(scenario.reduced ? 20 : 350);
        result.roundsCompleted += 1;
        if (snapshot.state.scores.some(score => score >= 200)) result.matchesCompleted += 1;
        await screenshot(`round-${result.roundsCompleted}-receipt`);
        console.log(`[${scenario.name}] round ${result.roundsCompleted}/${options.rounds}; scores ${snapshot.state.scores.join('/')}`);
        // Dismiss every result, including the final one, to prove the next deal accepts input.
        const next = await activate(page, '#nextRoundBtn', scenario, result);
        if (!next && !await activate(page, '#newMatchOverlayBtn', scenario, result)) throw new Error('Finished round has no available Next Round or New Match');
        await waitDismissed(page, '#roundOverlay');
        await page.waitForFunction(() => roundActive);
        result.modalChecks.push(`Round ${result.roundsCompleted} result dismisses into a live deal`);
        lastChangedAt = roundStartedAt = Date.now();
        continue;
      }
      if (now - lastChangedAt >= 10000) throw new Error(`Stuck turn: no state change for 10s. ${snapshot.key}; ${snapshot.status}`);
      if (now - roundStartedAt > options.timeout) throw new Error(`Round exceeded ${options.timeout}ms despite progressing`);
      if (now - lastLogAt >= 8000) {
        lastLogAt = now;
        console.log(`[${scenario.name}] round ${snapshot.state.round}, player ${snapshot.state.player}, hands ${snapshot.state.hands.map(hand => hand.length).join('/')}, ${changes} changes`);
      }
      const expectedOverlay = snapshot.state.pendingWild ? 'suitChooser' : null;
      if (snapshot.overlays.some(overlay => overlay !== expectedOverlay)) throw new Error(`Unexpected blocking overlay: ${snapshot.overlays.join(', ')}`);
      if (snapshot.state.pendingWild) {
        await checkModalLayout(page, '#suitChooser', result);
        if (await activate(page, `.suit-btn[data-suit="${snapshot.suitChoice}"]`, scenario, result)) {
          result.actions.Suit += 1;
          await waitDismissed(page, '#suitChooser');
          result.modalChecks.push('Wild suit choice dismisses picker');
        }
      } else if (snapshot.state.player === 0) {
        if (!result.continue.exactSnapshot && humanTurns >= 2 && !snapshot.state.drawn) {
          await continueViaHub(page, scenario, result, screenshot);
          continueKey = (await inspect(page)).key;
          lastChangedAt = Date.now();
        }
        const playable = snapshot.cards.filter(card => card.playable);
        if (playable.length && humanTurns % 2 === 0) {
          // Prefer a wild when present so the picker is exercised naturally.
          const card = playable.find(card => card.rank === '8') || playable[0];
          await tapCard(page, card, scenario, result);
        } else {
          const action = playable.length ? 'Smart' : snapshot.state.drawn ? 'Pass' : 'Draw';
          if (await activate(page, `#${action.toLowerCase()}Btn`, scenario, result)) result.actions[action] += 1;
        }
        humanTurns += 1;
      }
      await page.waitForTimeout(90);
    }
    await collectAnnouncements();
    if (!result.continue.exactSnapshot || !result.continue.acceptedAction) throw new Error('Continue was not restored and followed by an accepted action');
    if (!result.announcements.some(text => /played/.test(text) && !/^You\b/.test(text))) throw new Error('No bot play was announced through the live status region');
    if (!result.announcements.some(text => /wins round|Match complete/.test(text))) throw new Error('No round result was announced through the live status region');
    if (scenario.keyboard && (!result.keyboard.arrows || !result.keyboard.plays || !result.keyboard.tabs)) throw new Error('Keyboard round did not exercise Tab, arrows and playing a selected card');
    result.layoutIssues = [...layoutIssues];
    result.pass = result.roundsCompleted === options.rounds && result.errors.length === 0 && result.layoutIssues.length === 0;
    if (result.pass) await unlink(resolve(options.output, `${scenario.name}-${scenario.viewport.width}-failure.png`)).catch(() => {});
    console.log(`[${scenario.name}] ${result.pass ? 'PASS' : 'FAIL'}: ${result.roundsCompleted} rounds, ${JSON.stringify(result.actions)}, continue=${result.continue.acceptedAction}, errors=${result.errors.length}, layout=${result.layoutIssues.length}`);
  } catch (error) {
    result.errors.push(error.stack || error.message);
    result.layoutIssues = [...layoutIssues];
    result.pass = false;
    await screenshot('failure').catch(() => {});
    console.error(`[${scenario.name}] FAIL: ${error.message}`);
  } finally { await context.close(); }
}

try {
  await mkdir(options.output, { recursive: true });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(options.port, '127.0.0.1', accept); });
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  for (const scenario of scenarios) await runScenario(scenario);
} catch (error) {
  report.errors.push(error.stack || error.message);
  console.error(error.message);
} finally {
  if (browser) await browser.close();
  await new Promise(accept => server.close(accept));
  report.finishedAt = new Date().toISOString();
  report.pass = report.errors.length === 0 && report.results.length === scenarios.length && report.results.every(result => result.pass);
  await mkdir(options.output, { recursive: true });
  await writeFile(resolve(options.output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Crappy Eights autoplay ${report.pass ? 'PASS' : 'FAIL'}; artifacts: ${options.output}`);
  process.exitCode = report.pass ? 0 : 1;
}
