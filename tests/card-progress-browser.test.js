// @vitest-environment node
/* global state, progressMeta, applyEightsSnapshot, applyRummySnapshot, updateAll,
renderAll, clearAiTimer, clearAiTurnTimeout, createShoe, shoe, render, SuiteProgress,
getComputedStyle, performance, innerHeight */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, webkit } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { URL } from 'node:url';
import { validEightsSnapshot, validRummySnapshot } from './continue-fixtures.js';

const root = resolve(import.meta.dirname, '..');
const engines = { chromium, webkit };
const evidence = process.env.CARD_PROGRESS_EVIDENCE_DIR;
const configuredBase = process.env.CARD_PROGRESS_BASE_URL?.replace(/\/$/, '');
const receipts = [];
let server, origin;

beforeAll(async () => {
  if (!Object.values(engines).some(engine => existsSync(engine.executablePath()))) { return; }
  if (configuredBase) {
    origin = configuredBase;
    if (evidence) { await mkdir(evidence, { recursive: true }); }
    return;
  }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  server = createServer(async (request, response) => {
    const file = resolve(root, `.${new URL(request.url, 'http://localhost').pathname}`);
    if (!file.startsWith(root + sep)) { return response.writeHead(403).end(); }
    try { response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(await readFile(file)); }
    catch { response.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
  if (evidence) { await mkdir(evidence, { recursive: true }); }
});
afterAll(async () => {
  if (evidence && receipts.length) {
    await writeFile(resolve(evidence, 'report.json'), JSON.stringify({ checkedAt: new Date().toISOString(), baseUrl: origin,
      method: 'Explicitly staged near-completion integration fixtures; native final legal action, result sharing/keyboard, reload and replay. Not natural complete-session evidence.', cases: receipts }, null, 2) + '\n');
  }
  if (server) { await new Promise(done => server.close(done)); }
});

function eightsFixture() {
  const snap = validEightsSnapshot();
  const hand = snap.players[0].hand;
  const ordinary = hand.findIndex(card => card.rank !== '8');
  [hand[0], hand[ordinary]] = [hand[ordinary], hand[0]];
  for (const player of snap.players) { snap.deck.push(...player.hand.splice(1)); player.score = 0; }
  snap.players[0].score = 199; snap.currentPlayer = 0;
  snap.activeSuit = snap.players[0].hand[0].suit;
  snap.pendingDrawCards = 0; snap.pendingSkips = 0; snap.pendingWildCard = null;
  snap.selectedCardId = null;
  return snap;
}
function rummyFixture() {
  const snap = validRummySnapshot();
  const all = ['C', 'D', 'H', 'S'].flatMap((suit, s) => Array.from({ length: 13 }, (_, i) => ({ suit, rank: i + 1, id: `${suit}${i + 1}-${s * 13 + i}` })));
  const wanted = new Set(['C1', 'C2', 'C3', 'D4', 'D5', 'D6', 'H7', 'H8', 'H9', 'H10', 'S13']);
  snap.playerHand = all.filter(card => wanted.has(card.suit + card.rank));
  const rest = all.filter(card => !wanted.has(card.suit + card.rank));
  snap.aiHand = rest.splice(0, 10); snap.discard = rest.splice(0, 1); snap.stock = rest;
  Object.assign(snap, { playerScore: 80, aiScore: 0, round: 1, turn: 'player', phase: 'discard',
    roundOver: false, matchOver: false, selectedCardId: 'S13-51', drawnCardId: 'S13-51', drawnCardSource: 'stock' });
  return snap;
}
async function openJackHistory(page, phone) {
  if (phone) {
    await page.locator('.mobile-menu > details > summary').click();
    await page.locator('.mobile-menu button[onclick*="intelToggleBtn"]').click();
  } else { await page.locator('#intelToggleBtn').click(); }
  if (!(await page.locator('#intelDrawer').evaluate(node => node.open))) { await page.locator('#intelDrawer > summary').click(); }
}
async function openSpadesDetails(page) {
  if (!(await page.locator('#tsDrawerToggle').isVisible())) { await page.locator('#tsTableMenu > summary').click(); }
  await page.locator('#tsDrawerToggle').click();
  // The existing score drawer reveals over 280ms; focus can reach its contents
  // earlier, so qualify rendered geometry after that native reveal settles.
  await page.waitForFunction(() => {
    const drawer = document.querySelector('#tsDetailsDrawer');
    return drawer.classList.contains('open') && Number(getComputedStyle(drawer).opacity) >= .99 && drawer.getBoundingClientRect().height >= 44;
  });
}

describe('card completed progress native result/reload/replay', () => {
  for (const [engine, type] of Object.entries(engines)) {
    for (const width of [390, 1280]) {
      for (const game of ['turdjack', 'crapeights', 'turdrummy', 'turdspades']) {
        it.skipIf(!existsSync(type.executablePath()))(`${engine} ${game} keeps honest results and usable sharing at ${width}px`, async () => {
          const phone = width === 390;
          const browser = await type.launch();
          const page = await browser.newPage({ viewport: { width, height: phone ? 844 : 800 }, isMobile: phone, hasTouch: phone, reducedMotion: 'reduce' });
          page.setDefaultTimeout(5000);
          page.setDefaultNavigationTimeout(10000);
          const item = { engine, width, game, errors: [] };
          receipts.push(item); page.on('pageerror', error => item.errors.push(error.message));
          page.on('dialog', dialog => dialog.accept());
          try {
            await page.goto(`${origin}/${game}.html`);
            item.url = page.url();
            if (game === 'turdjack') {
              await page.locator('#closeGuideBtn').click();
              await page.evaluate(() => {
                createShoe(4);
                const cards = [['A', 'S'], ['9', 'C'], ['K', 'H'], ['7', 'D']].map(([rank, suit]) => shoe.splice(shoe.findIndex(card => card.rank === rank && card.suit === suit), 1)[0]);
                shoe.push(...cards.reverse());
              });
              await page.locator('[data-chip="25"]:visible').first().click();
              await page.locator('#dealBtn:visible,[data-mobile-action="deal"]:visible').first().click();
            } else if (game === 'crapeights') {
              await page.locator('#closeGuideBtn').click();
              await page.evaluate(snapshot => { clearAiTimer(); applyEightsSnapshot({ ...snapshot, progressMeta }); updateAll(); }, eightsFixture());
              await page.locator('#playerHand [data-card-id]').first().click();
              // The staged legal card is ordinary, so the native Play decision ends the match.
              if (await page.locator('#suitChooser').isVisible()) { await page.locator('#cancelSuitBtn').click(); }
              await page.locator('#playBtn').click();
            } else if (game === 'turdrummy') {
              await page.locator('#startRoundBtn').click();
              if (await page.locator('#coachSkipBtn').isVisible()) { await page.locator('#coachSkipBtn').click(); }
              await page.evaluate(snapshot => { clearAiTurnTimeout(); applyRummySnapshot({ ...snapshot, progressMeta }); renderAll(); }, rummyFixture());
              await page.locator('#ginBtn').click();
              await page.locator('#trophyOverlay.show').waitFor();
            } else {
              await page.locator('#quickStart').click();
              await page.evaluate(() => {
                clearAiTimer();
                const all = state.hands.flat();
                const own = all.find(card => card.suit === 'S' && card.rank === 14);
                const trick = [['C', 2], ['D', 3], ['H', 4]].map(([suit, rank], i) => ({ player: i + 1, card: all.find(card => card.suit === suit && card.rank === rank) }));
                Object.assign(state, { hands: [[own], [], [], []], trick, playedThisRound: all.filter(card => card.id !== own.id),
                  phase: 'play', currentPlayer: 0, bids: [2, 3, 4, 4], tricks: [3, 4, 2, 3], scores: [200, -100], selected: null });
                render();
              });
              await page.locator('#youCards .card').click();
              await page.locator('#playBtn').click();
            }
            await page.waitForFunction(name => (SuiteProgress.snapshot().history[name] || []).length === 1, game);
            item.entry = await page.evaluate(name => SuiteProgress.snapshot().history[name][0], game);
            expect(item.entry.kind).toBe(game === 'turdjack' ? 'hand' : 'match');
            if (game === 'turdspades') { expect(item.entry).toMatchObject({ playerScore: 260, opponentScore: -30 }); }
            if (game === 'turdspades') { await page.locator('#tsTrophy.show').waitFor({ state: 'hidden', timeout: 6000 }); }
            if (game === 'turdjack') { await openJackHistory(page, phone); }
            if (game === 'turdspades') {
              await openSpadesDetails(page);
              item.drawerOpened = await page.locator('#tsDetailsDrawer').evaluate(node => ({ classes: node.className,
                rect: node.getBoundingClientRect().toJSON(), opacity: getComputedStyle(node).opacity,
                expanded: document.querySelector('#tsDrawerToggle').getAttribute('aria-expanded') }));
            }
            const share = page.locator('.suite-result-share button');
            // Native Tab must reveal the complete action inside the existing scroll surface.
            item.shareKeyboardKey = engine === 'webkit' ? 'Alt+Tab' : 'Tab';
            // WebKit follows Safari's alternate keyboard navigation: Option+Tab
            // includes buttons regardless of the host's full-keyboard preference.
            for (let count = 0; count < 60 && !(await share.evaluate(node => node === document.activeElement)); count++) { await page.keyboard.press(item.shareKeyboardKey); }
            expect(await share.evaluate(node => node === document.activeElement)).toBe(true);
            if (game === 'turdspades') {
              item.drawerFocused = await page.locator('#tsDetailsDrawer').evaluate(node => ({ classes: node.className,
                rect: node.getBoundingClientRect().toJSON(), opacity: getComputedStyle(node).opacity,
                expanded: document.querySelector('#tsDrawerToggle').getAttribute('aria-expanded') }));
            }
            item.shareTarget = await share.evaluate(node => {
              const r = node.getBoundingClientRect();
              return { width: r.width, height: r.height, top: r.top, bottom: r.bottom,
                visibleBottom: innerHeight - (parseFloat(document.documentElement.style.getPropertyValue('--mobile-footer')) || 0),
                hits: [[r.x + 8, r.y + 8], [r.right - 8, r.y + 8], [(r.x + r.right) / 2, (r.y + r.bottom) / 2], [r.x + 8, r.bottom - 8], [r.right - 8, r.bottom - 8]].map(([x, y]) => node.contains(document.elementFromPoint(x, y))) };
            });
            expect(item.shareTarget.width).toBeGreaterThanOrEqual(44);
            expect(item.shareTarget.height).toBeGreaterThanOrEqual(44);
            expect(item.shareTarget.top).toBeGreaterThanOrEqual(0);
            expect(item.shareTarget.bottom).toBeLessThanOrEqual(item.shareTarget.visibleBottom);
            expect(item.shareTarget.hits).toEqual([true, true, true, true, true]);
            if (evidence) { await page.screenshot({ path: resolve(evidence, `${engine}-${game}-${width}-result.png`) }); }
            item.phase = 'native-share';
            await page.keyboard.press('Enter');
            await page.waitForFunction(() => document.querySelector('.suite-result-share-status').textContent.length > 0, null, { timeout: 5000 });
            expect(await page.evaluate(name => SuiteProgress.snapshot().history[name].length, game)).toBe(1);
            item.phase = 'reload';
            await page.reload();
            expect(await page.evaluate(name => SuiteProgress.snapshot().history[name].length, game)).toBe(1);
            item.restored = await page.evaluate(name => ({ meta: progressMeta, save: window.Suite.table.load(name + '.html'),
              resultVisible: !!document.querySelector('.suite-result-share:not([hidden])') }), game);
            item.phase = 'native-replay';
            if (game === 'turdjack') {
              const deal = page.locator('#dealBtn:visible,[data-mobile-action="deal"]:visible').first();
              // A reload returns to the ordinary betting stage; place a real new wager.
              await page.locator('[data-chip="25"]:visible').first().click();
              await deal.click();
            }
            else if (game === 'crapeights') {
              const replay = page.locator('#newMatchOverlayBtn');
              // Native keyboard navigation must reveal the whole action in the
              // result scroll surface before the trusted pointer activation.
              for (let count = 0; count < 20 && !(await replay.evaluate(node => node === document.activeElement)); count++) { await page.keyboard.press(item.shareKeyboardKey); }
              expect(await replay.evaluate(node => node === document.activeElement)).toBe(true);
              item.replayVisual = await replay.evaluate(node => ({ rect: node.getBoundingClientRect().toJSON(),
                animations: node.getAnimations({ subtree: false }).map(animation => animation.effect.getTiming()),
                parentAnimations: node.parentElement.parentElement.getAnimations().map(animation => animation.effect.getTiming()) }));
              item.replayMotion = [];
              for (let sample = 0; sample < 10; sample++) {
                item.replayMotion.push(await replay.evaluate(node => ({ at: performance.now(), rect: node.getBoundingClientRect().toJSON(),
                  transform: getComputedStyle(node).transform, parentTransform: getComputedStyle(node.parentElement.parentElement).transform })));
                await page.waitForTimeout(32);
              }
              const target = await replay.evaluate(node => {
                const r = node.getBoundingClientRect();
                return { x: (r.x + r.right) / 2, y: (r.y + r.bottom) / 2, width: r.width, height: r.height,
                  top: r.top, bottom: r.bottom,
                  visibleBottom: innerHeight - (parseFloat(document.documentElement.style.getPropertyValue('--mobile-footer')) || 0),
                  hits: [[r.x + 8, r.y + 8], [r.right - 8, r.y + 8], [(r.x + r.right) / 2, (r.y + r.bottom) / 2], [r.x + 8, r.bottom - 8], [r.right - 8, r.bottom - 8]].map(([x, y]) => node.contains(document.elementFromPoint(x, y))) };
              });
              item.replayTarget = target;
              expect(target.width).toBeGreaterThanOrEqual(44);
              expect(target.height).toBeGreaterThanOrEqual(44);
              expect(target.top).toBeGreaterThanOrEqual(0);
              expect(target.bottom).toBeLessThanOrEqual(target.visibleBottom);
              expect(target.hits).toEqual([true, true, true, true, true]);
              // A trusted current-center touch/click exercises the actual result
              // action without changing its style or demanding a motionless box.
              if (phone) { await page.touchscreen.tap(target.x, target.y); }
              else { await page.mouse.click(target.x, target.y); }
            }
            else if (game === 'turdrummy') { await page.locator('#trophyRematchBtn').click(); }
            else {
              if (!(await page.locator('#newMatchBtn').isVisible())) { await page.locator('#tsTableMenu > summary').click(); }
              await page.locator('#newMatchBtn').click();
            }
            item.replayId = await page.evaluate(() => progressMeta.id);
            expect(item.replayId).not.toBe(item.entry.id);
            expect(await page.evaluate(({ name, id }) => SuiteProgress.snapshot().history[name].some(entry => entry.id === id), { name: game, id: item.entry.id })).toBe(true);
            expect(item.errors).toEqual([]); item.pass = true;
          } catch (error) {
            item.pass = false; item.failure = String(error.stack || error);
            if (evidence) { await page.screenshot({ path: resolve(evidence, `${engine}-${game}-${width}-failure.png`) }); }
            throw error;
          } finally { await browser.close(); }
        }, 25000);
      }
    }
  }
});
