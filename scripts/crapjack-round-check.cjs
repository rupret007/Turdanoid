// Real controls on an already running server. No outcome or deck fixtures here.
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const base = process.argv[2];
const out = process.argv[3];
if (!base || !out) throw new Error('Supply an existing server URL and new evidence directory');
(async () => {
  await mkdir(out, { recursive: true });
  const report = { base, input: 'Native clicks and keys; natural deals; no state, deck or outcome assignments.', cases: [] };
  for (const [engine, type] of Object.entries({ chromium, webkit })) {
    const browser = await type.launch({ headless: true });
    try {
      for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 390, height: 844 }]) {
        const touch = viewport.width < 981;
        const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
        const page = await context.newPage();
        const item = { engine, viewport, errors: [] };
        report.cases.push(item);
        page.on('pageerror', error => item.errors.push(error.message));
        const activate = locator => touch ? locator.tap() : locator.click();
        const read = () => page.evaluate(() => ({ roundActive, dealerResolving, pendingDecision, currentBet, bankroll, player: playerHand.map(c => ({ ...c })), stats: { ...stats } }));
        const ready = async () => {
          for (let attempt = 0; attempt < 30; attempt++) {
            const s = await read();
            if (s.pendingDecision) {
              await activate(page.locator('#jackConfirmNo'));
            } else if (s.dealerResolving) {
              await page.waitForTimeout(100);
            } else if (s.roundActive) {
              return s;
            } else {
              if (s.currentBet < 10) await activate(page.locator(touch ? '#mobileFeltChipRack [data-chip="10"]' : '.table-bet-zone .chip-rack [data-chip="10"]').first());
              await activate(page.locator(touch ? '[data-mobile-action="deal"]' : '#dealBtn'));
            }
            await page.waitForTimeout(60);
          }
          throw new Error('No natural player turn in 30 attempts');
        };
        const assertSettledOnce = async before => {
          await page.waitForFunction(() => !roundActive && !dealerResolving, null, { timeout: 15000 });
          const after = await read();
          const delta = key => after.stats[key] - before.stats[key];
          assert.equal(delta('wins') + delta('losses') + delta('pushes'), 1, 'one hand produces one settlement');
          assert.equal(delta('decisions'), 1, 'the original Stand is counted once');
          assert.equal(after.bankroll, before.bankroll + (delta('wins') ? 2 * before.currentBet : delta('pushes') ? before.currentBet : 0), 'bankroll pays the single actual outcome');
          return after;
        };
        try {
          await page.goto(new URL('turdjack.html', base).href, { waitUntil: 'load' });
          await page.keyboard.press('Escape');
          await page.locator('#suite-arcade-a11y-toggle').waitFor({ state: 'visible' });
          item.colorControl = await page.evaluate(() => {
            const control = document.getElementById('suite-arcade-a11y-toggle');
            const box = control.getBoundingClientRect();
            const controls = [...document.querySelectorAll('.topbar button,.topbar a,.mobile-menu > details > summary,.pit-primary button,.pit-overflow > summary,#mobilePit button,#suite-music-toggle')]
              .filter(node => node !== control && node.checkVisibility({ checkVisibilityCSS: true }));
            const overlaps = controls.filter(node => {
              const other = node.getBoundingClientRect();
              return Math.min(box.right, other.right) - Math.max(box.left, other.left) > 1
                && Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 1;
            }).map(node => node.id || node.getAttribute('aria-label') || node.textContent.trim());
            return { width: box.width, height: box.height, overlaps };
          });
          assert(item.colorControl.width >= 44 && item.colorControl.height >= 44, 'Clr keeps its complete minimum target');
          assert.deepEqual(item.colorControl.overlaps, [], 'Clr does not cover any part of another action target');
          const before = await ready();
          await activate(page.locator(touch ? '[data-mobile-action="stand"]' : '#standBtn'));
          assert(await page.locator('#standBtn').isDisabled(), 'Stand locks before the reveal timer');
          assert(await page.locator('#hitBtn').isDisabled(), 'Hit locks before the reveal timer');
          assert(await page.locator('[data-mobile-action="smart"]').isDisabled(), 'Smart locks during dealer play');
          for (const key of ['KeyS', 'KeyH', 'KeyD', 'Enter']) await page.keyboard.press(key);
          item.rapid = { before, after: await assertSettledOnce(before) };
          const continuedBefore = await ready();
          await activate(page.locator(touch ? '[data-mobile-action="stand"]' : '#standBtn'));
          const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem('turdsuite_continue_v1')).games['turdjack.html'].snapshot);
          assert.equal(snapshot.dealerResolving, true, 'the in-flight dealer stage is saved');
          await activate(page.locator('.suite-back-pill'));
          await page.waitForURL(url => !url.pathname.endsWith('turdjack.html'));
          const link = page.locator('.game-card[href="turdjack.html"]');
          assert.match(await link.textContent(), /Continue/);
          await activate(link);
          await page.waitForFunction(() => typeof dealerResolving !== 'undefined', null, { timeout: 5000 });
          const restored = await read();
          assert.deepEqual(restored.player, continuedBefore.player, 'Continue preserves the committed player hand');
          assert.equal(restored.currentBet, continuedBefore.currentBet);
          if (restored.roundActive) {
            assert.equal(restored.dealerResolving, true, 'Continue resumes the committed dealer stage');
            assert.equal(restored.bankroll, continuedBefore.bankroll, 'Continue does not deduct the bet twice');
          }
          item.continue = { inFlight: true, before: continuedBefore, after: await assertSettledOnce(continuedBefore) };
          assert.deepEqual(item.errors, []);
          item.status = 'passed';
        } catch (error) {
          item.status = 'failed'; item.failure = error.stack; process.exitCode = 1;
        }
        await page.screenshot({ path: path.join(out, `${engine}-${viewport.width}.png`) }).catch(() => {});
        await context.close();
        await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
        console.log(JSON.stringify({ engine, viewport, status: item.status, failure: item.failure }));
      }
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
