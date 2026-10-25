// Native card UI regression checks against an already running source/site server.
// Usage: node scripts/card-ui-check.cjs http://127.0.0.1:4522/ /path/to/new/evidence
const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const base = process.argv[2];
const out = process.argv[3];
if (!base || !out) throw new Error('Supply an existing server base URL and a new evidence directory');
const games = [
  { name: 'crapjack', file: 'turdjack.html', guide: '#welcomeGuide', start: '#quickGuideBtn', help: '#helpBtn', phoneHelp: 'button[onclick="showWelcomeGuide()"]', hand: '#playerCards .playing-card' },
  { name: 'eights', file: 'crapeights.html', guide: '#welcomeGuide', start: '#quickStartBtn', help: '#helpBtn', phoneHelp: 'button[onclick="showWelcomeGuide()"]', hand: '#playerHand [data-card-id]' },
  { name: 'rummy', file: 'turdrummy.html', guide: '#guideOverlay', start: '#startRoundBtn', help: '#quickGuideBtn', phoneHelp: '#quickGuideBtn', hand: '#playerHand .card' },
  { name: 'spades', file: 'turdspades.html', guide: '#guide', start: '#quickStart', help: '#helpBtn', phoneHelp: '#helpBtn', hand: '#youCards .card' },
];
async function inGuide(page, game) {
  return page.evaluate(({ guide, name }) => {
    const focused = document.activeElement;
    return document.querySelector(guide).contains(focused)
      || (name === 'eights' && focused?.matches('.suite-back-pill'));
  }, game);
}
async function activeVisible(page) {
  return page.evaluate(() => {
    const node = document.activeElement;
    return node !== document.body && node?.checkVisibility({ checkVisibilityCSS: true }) && !node.disabled && !node.closest('[inert]');
  });
}
async function focusedControlIsInView(page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    const box = active.getBoundingClientRect();
    const panel = active.closest('.welcome-card, .guide-card, .overlay-card');
    const clip = panel?.getBoundingClientRect();
    return box.top >= Math.max(0, clip?.top || 0) - 1
      && box.bottom <= Math.min(innerHeight, clip?.bottom || innerHeight) + 1;
  });
}
(async () => {
  await mkdir(out, { recursive: true });
  const report = { startedAt: new Date().toISOString(), base, cases: [] };
  for (const [engine, type] of Object.entries({ chromium, webkit })) {
    const browser = await type.launch({ headless: true });
    try {
      for (const viewport of [{ width: 320, height: 568 }, { width: 568, height: 320 }, { width: 800, height: 1024 }, { width: 1280, height: 800 }]) {
        for (const game of games) {
          const touch = viewport.width < 981;
          const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
          const page = await context.newPage();
          const item = { engine, game: game.name, viewport, errors: [] };
          report.cases.push(item);
          const tag = `${engine}-${game.name}-${viewport.width}x${viewport.height}`;
          page.on('pageerror', error => item.errors.push(error.message));
          const activate = async locator => touch ? locator.tap() : locator.click();
          try {
            await page.goto(new URL(game.file, base).href, { waitUntil: 'load' });
            await page.locator(game.guide).waitFor({ state: 'visible' });
            assert(await inGuide(page, game), 'initial focus enters the guide');
            for (let index = 0; index < 8; index++) {
              await page.keyboard.press(index % 2 ? 'Shift+Tab' : 'Tab');
              assert(await inGuide(page, game), 'Tab stays in the visible guide');
            }
            if (viewport.width === 568) {
              const summary = page.locator(`${game.guide} .mobile-guide-details > summary`);
              if (await summary.count()) await activate(summary);
              const enlarged = await page.addStyleTag({ content: `${game.guide} p, ${game.guide} li { font-size:24px!important; line-height:1.7!important } ${game.guide} .mobile-guide-details>div { max-height:none!important }` });
              for (let index = 0; index < 8; index++) {
                await page.keyboard.press('Tab');
                assert(await focusedControlIsInView(page), 'Tab scrolls enlarged expanded-guide actions into view');
              }
              await enlarged.evaluate(node => node.remove());
              item.expandedGuide = 'native Tab keeps enlarged-text actions inside the visible panel';
            }
            await page.keyboard.press('Escape');
            await page.locator(game.guide).waitFor({ state: 'hidden' });
            assert(await activeVisible(page), 'Escape restores a visible usable control');
            let help = page.locator(game.help);
            if (!(await help.isVisible())) {
              await activate(page.locator('.mobile-menu summary, .mobile-settings > summary, #tsTableMenu > summary').first());
              help = page.locator(game.phoneHelp).first();
            }
            await activate(help);
            await page.locator(game.guide).waitFor({ state: 'visible' });
            assert(await inGuide(page, game), 'reopened help receives focus');
            await page.keyboard.press('Escape');
            await page.locator(game.guide).waitFor({ state: 'hidden' });
            assert(await activeVisible(page), 'reopened help returns to its trigger or menu');
            if (!(await help.isVisible())) await activate(page.locator('.mobile-menu summary, .mobile-settings > summary, #tsTableMenu > summary').first());
            await activate(help);
            await activate(page.locator(game.start));
            await page.waitForTimeout(1100);
            await page.waitForFunction(() => !document.querySelector('.fly-card'), null, { timeout: 5000 });
            if (game.name === 'spades' && !touch) {
              await page.waitForFunction(() => typeof window.__tsPickAiCard === 'function');
              await activate(page.locator('[data-bid="7"]'));
              assert.equal(await page.evaluate(() => state.bidChoice), 7, 'the real bid chip updates the live table');
              assert.equal((await page.locator('#bidV').textContent()).trim(), '7', 'bid dial reflects the chosen chip');
              await activate(page.locator('#tsTableMenu > summary'));
              const difficulty = page.locator('#tsAiDifficultySelect');
              for (const level of ['easy', 'hard', 'normal']) {
                await difficulty.selectOption(level);
                assert.equal(await page.evaluate(() => localStorage.getItem('turdspades_ai_difficulty_v1')), level, 'Spades strength control stores its actual choice');
                assert.equal(await page.evaluate(() => localStorage.getItem('turdsuite_difficulty_v1')), level, 'suite strength follows the control');
                assert(await page.evaluate(() => {
                  const card = window.__tsPickAiCard(0);
                  return window.state === state && !!card && legalCards(0).some(legal => legal.id === card.id);
                }), 'the selected strength has a live legal-card picker');
              }
              await activate(page.locator('#tsTableMenu > summary'));
              await activate(page.locator('[data-bid="4"]'));
              item.spadesBridge = 'native bid chips and all three actual strength controls passed';
            }
            if (game.name === 'eights' && viewport.width === 320) {
              await page.waitForFunction(() => currentPlayer === 0 && !focusSuspendedRound);
              await page.waitForTimeout(200);
              const cards = page.locator(game.hand);
              await cards.first().focus(); // Setup only; navigation below uses native keys.
              await page.keyboard.press('End');
              assert.equal(await page.evaluate(() => document.activeElement.dataset.cardId), await cards.last().getAttribute('data-card-id'), 'End reveals and focuses the final card');
              assert(await cards.last().isVisible(), 'final card is displayed');
              await page.keyboard.press('Home');
              assert.equal(await page.evaluate(() => document.activeElement.dataset.cardId), await cards.first().getAttribute('data-card-id'), 'Home reveals the first page');
              item.paging = 'native End/Home passed after settled layout';
            }
            item.layout = await page.evaluate(selector => {
              const footer = document.getElementById('suite-music-status');
              const boundary = footer ? footer.getBoundingClientRect().top : innerHeight;
              const dock = document.querySelector('.action-dock, .dock');
              const table = document.querySelector('.table');
              const handBoundary = Math.min(boundary, dock?.getBoundingClientRect().top || boundary, table?.getBoundingClientRect().bottom || boundary);
              const cards = [...document.querySelectorAll(selector)].filter(card => !card.hidden).map(card => {
                const r = card.getBoundingClientRect();
                return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
              });
              return { boundary, handBoundary, overflow: document.documentElement.scrollWidth - innerWidth, cards };
            }, game.hand);
            assert(item.layout.overflow <= 1, 'no horizontal page overflow');
            assert(item.layout.cards.length > 0, 'a real hand is rendered');
            for (const card of item.layout.cards) {
              assert(card.y >= 0 && card.bottom <= item.layout.handBoundary + 1, 'hand clears the table edge, action dock and optional music strip');
            }
            assert.deepEqual(item.errors, [], 'no uncaught page errors');
            item.status = 'passed';
          } catch (error) {
            item.status = 'failed';
            item.failure = error.message;
            process.exitCode = 1;
          }
          await page.screenshot({ path: path.join(out, `${tag}.png`) }).catch(() => {});
          await context.close();
          await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
          console.log(JSON.stringify({ tag, status: item.status, failure: item.failure }));
        }
      }
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
