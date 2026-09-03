import { chromium, devices } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8123';
// Default to the Edge channel (Windows dev workflow). Set PLAYWRIGHT_CHANNEL=""
// to use Playwright's bundled Chromium (Linux/CI).
const browserChannel = process.env.PLAYWRIGHT_CHANNEL ?? 'msedge';
const failures = [];

function fail(name, message) {
  failures.push(`${name}: ${message}`);
}

async function runCheck(browser, name, path, options = {}) {
  const context = await browser.newContext(
    options.mobile ? devices['iPhone 12'] : { viewport: { width: 1440, height: 900 } }
  );
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  let dialogCount = 0;

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('dialog', async (dialog) => {
    dialogCount += 1;
    await dialog.accept();
  });

  try {
    const response = await page.goto(`${baseUrl}/${path}`, { waitUntil: 'load' });
    if (!response || !response.ok()) {
      fail(name, `page load failed for ${path}`);
    }
    await page.waitForTimeout(400);
    if (options.assert) await options.assert(page, () => dialogCount);
    if (options.actions) await options.actions(page, () => dialogCount);
    await page.waitForTimeout(400);
  } catch (err) {
    fail(name, `exception: ${err.message}`);
  }

  if (consoleErrors.length) fail(name, `console errors: ${consoleErrors.join(' | ')}`);
  if (pageErrors.length) fail(name, `page errors: ${pageErrors.join(' | ')}`);
  await context.close();
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: browserChannel || undefined, headless: true });
  } catch (err) {
    if (!browserChannel) {
      throw new Error(`Could not launch bundled Chromium: ${err.message}`);
    }
    // Fall back to Playwright's bundled Chromium (e.g. on Linux where the
    // default Edge channel is unavailable).
    try {
      return await chromium.launch({ headless: true });
    } catch (fallbackErr) {
      throw new Error(`Could not launch channel "${browserChannel}" (${err.message}) or bundled Chromium (${fallbackErr.message})`);
    }
  }
}

async function main() {
  const browser = await launchBrowser();
  try {
    await runCheck(browser, 'root-hub', '', {
      assert: async (page) => {
        const cards = await page.locator('.game-card').count();
        if (cards !== 6) fail('root-hub', `expected 6 game cards, saw ${cards}`);
        const hrefs = await page.locator('.game-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('href')));
        const expected = ['TurdAnoid.html', 'turdtris.html', 'turdjack.html', 'crapeights.html', 'turdrummy.html', 'turdspades.html'];
        if (JSON.stringify(hrefs) !== JSON.stringify(expected)) {
          fail('root-hub', `expected the six-game lineup, saw ${JSON.stringify(hrefs)}`);
        }
        if ((await page.locator('a[href="neon-arkanoid.html"]').count()) !== 1) {
          fail('root-hub', 'expected one secondary link to the original Neon Arkanoid game');
        }
      }
    });

    await runCheck(browser, 'legacy-hub-redirect', 'hub.html', {
      assert: async (page) => {
        if (!page.url().endsWith('/')) fail('legacy-hub-redirect', `expected redirect to root, saw ${page.url()}`);
        if ((await page.locator('.game-card').count()) !== 6) {
          fail('legacy-hub-redirect', 'legacy hub URL did not land on the six-game lineup');
        }
      }
    });

    await runCheck(browser, 'neon-guide-and-blur', 'neon-arkanoid.html', {
      actions: async (page) => {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        const legacyGuideState = await page.evaluate(() => ({
          guideOpen: document.getElementById('howToPlay')?.style.display !== 'none',
          awaitingLaunch: window.gameInstance.awaitingLaunch,
          paused: window.gameInstance.paused
        }));
        if (legacyGuideState.guideOpen) fail('neon-guide-and-blur', 'Enter should dismiss the opening guide');
        if (!legacyGuideState.awaitingLaunch) fail('neon-guide-and-blur', 'Enter should not launch the ball behind the guide');
        if (legacyGuideState.paused) fail('neon-guide-and-blur', 'Guide dismissal should not leave a fresh game paused');

        const legacyBlurState = await page.evaluate(() => {
          window.gameInstance.controls.left = true;
          window.gameInstance.controls.right = true;
          window.gameInstance.controls.pointerActive = true;
          window.dispatchEvent(new Event('blur'));
          return {
            paused: window.gameInstance.paused,
            loopStopped: window.gameInstance.animationFrameId === null,
            left: window.gameInstance.controls.left,
            right: window.gameInstance.controls.right,
            pointerActive: window.gameInstance.controls.pointerActive
          };
        });
        if (!legacyBlurState.paused) fail('neon-guide-and-blur', 'blur should pause the legacy breakout shell');
        if (!legacyBlurState.loopStopped) fail('neon-guide-and-blur', 'blur should stop the legacy breakout render loop');
        if (legacyBlurState.left || legacyBlurState.right || legacyBlurState.pointerActive) {
          fail('neon-guide-and-blur', 'blur should clear held legacy breakout inputs');
        }

        const legacyRestartState = await page.evaluate(() => {
          restartGame();
          restartGame();
          return {
            awaitingLaunch: window.gameInstance.awaitingLaunch,
            paused: window.gameInstance.paused,
            loopRunning: window.gameInstance.animationFrameId !== null,
            level: window.gameInstance.level,
            score: window.gameInstance.score
          };
        });
        if (!legacyRestartState.awaitingLaunch) fail('neon-guide-and-blur', 'restart churn should leave the legacy game waiting to launch');
        if (legacyRestartState.paused) fail('neon-guide-and-blur', 'restart churn should clear pause state in the legacy game');
        if (!legacyRestartState.loopRunning) fail('neon-guide-and-blur', 'restart churn should restart the legacy render loop');
        if (legacyRestartState.level !== 1 || legacyRestartState.score !== 0) {
          fail('neon-guide-and-blur', `restart churn should reset level/score, saw L${legacyRestartState.level} S${legacyRestartState.score}`);
        }
      }
    });

    await runCheck(browser, 'turdanoid-mobile', 'TurdAnoid.html', {
      mobile: true,
      actions: async (page) => {
        await page.locator('#btnStart').click();
        await page.waitForTimeout(180);
        const canvas = page.locator('canvas');
        if (!(await canvas.isVisible())) fail('turdanoid-mobile', 'canvas not visible after starting the game');
        const started = await page.evaluate(() => window.__turdanoid.state === 'playing');
        if (!started) fail('turdanoid-mobile', 'START FLUSHING should put the game into the playing state');
      }
    });

    await runCheck(browser, 'turdanoid-restart-churn', 'TurdAnoid.html', {
      actions: async (page) => {
        await page.locator('#btnStart').click();
        await page.waitForTimeout(180);
        const turdanoidRestartState = await page.evaluate(() => {
          const g = window.__turdanoid;
          g.doPause();
          // Restart twice to churn state (R key path uses the same function)
          g.startGame();
          g.startGame();
          return {
            state: g.state,
            level: g.level,
            score: g.score,
            waitingLaunch: g.waitingLaunch,
            levelTransition: g.levelTransition,
            bricks: g.bricks.length
          };
        });
        if (turdanoidRestartState.state !== 'playing') fail('turdanoid-restart-churn', `restart churn should leave the game playing, saw ${turdanoidRestartState.state}`);
        if (!turdanoidRestartState.waitingLaunch) fail('turdanoid-restart-churn', 'restart churn should return TurdAnoid to launch-ready state');
        if (turdanoidRestartState.level !== 1 || turdanoidRestartState.score !== 0) {
          fail('turdanoid-restart-churn', `restart churn should reset score/level, saw L${turdanoidRestartState.level} S${turdanoidRestartState.score}`);
        }
        if (turdanoidRestartState.levelTransition) fail('turdanoid-restart-churn', 'restart churn should not leave a level transition pending');
        if (turdanoidRestartState.bricks === 0) fail('turdanoid-restart-churn', 'restart churn should rebuild the brick wall');
      }
    });

    await runCheck(browser, 'turdanoid-blur-pause', 'TurdAnoid.html', {
      actions: async (page) => {
        await page.locator('#btnStart').click();
        await page.waitForTimeout(180);
        const blurState = await page.evaluate(() => {
          const g = window.__turdanoid;
          g.keys.left = true;
          g.keys.right = true;
          g.pointerActive = true;
          window.dispatchEvent(new Event('blur'));
          return {
            state: g.state,
            left: g.keys.left,
            right: g.keys.right,
            pointerActive: g.pointerActive
          };
        });
        if (blurState.state !== 'paused') fail('turdanoid-blur-pause', `blur should pause TurdAnoid, saw ${blurState.state}`);
        if (blurState.left || blurState.right || blurState.pointerActive) {
          fail('turdanoid-blur-pause', `blur should clear held paddle and fire inputs: ${JSON.stringify(blurState)}`);
        }
        const resumeState = await page.evaluate(() => {
          window.__turdanoid.doResume();
          return { state: window.__turdanoid.state };
        });
        if (resumeState.state !== 'playing') fail('turdanoid-blur-pause', 'resume should return to playing after blur pause');
      }
    });

    await runCheck(browser, 'turdtris-mobile', 'turdtris.html', {
      mobile: true,
      actions: async (page) => {
        await page.getByRole('button', { name: 'Review Then Start' }).click();
        const playfield = page.locator('#game');
        if (!(await playfield.isVisible())) fail('turdtris-mobile', 'playfield not visible after guide close');
      }
    });

    await runCheck(browser, 'turdtris-restart-churn', 'turdtris.html', {
      actions: async (page) => {
        await page.getByRole('button', { name: 'Review Then Start' }).click();
        await page.waitForTimeout(180);
        const turdtrisBlurState = await page.evaluate(() => {
          window.dispatchEvent(new Event('blur'));
          return { paused, loopStopped: rAF === null };
        });
        if (!turdtrisBlurState.paused) fail('turdtris-restart-churn', 'blur should pause Turdtris');
        if (!turdtrisBlurState.loopStopped) fail('turdtris-restart-churn', 'blur should stop the Turdtris render loop');

        const turdtrisResumeState = await page.evaluate(() => {
          togglePause();
          return { paused, loopRunning: rAF !== null };
        });
        if (turdtrisResumeState.paused) fail('turdtris-restart-churn', 'unpause should resume Turdtris after blur');
        if (!turdtrisResumeState.loopRunning) fail('turdtris-restart-churn', 'unpause should restart the Turdtris render loop');

        const turdtrisRestartState = await page.evaluate(() => {
          togglePause();
          restartGame();
          restartGame();
          return {
            paused,
            level,
            score,
            linesCleared,
            loopRunning: rAF !== null,
            onboardingOpen,
            gameOver,
            overlayVisible: document.getElementById('pauseOverlay')?.style.display !== 'none'
          };
        });
        if (turdtrisRestartState.paused) fail('turdtris-restart-churn', 'restart churn should clear pause state');
        if (turdtrisRestartState.overlayVisible) fail('turdtris-restart-churn', 'restart churn should hide the pause overlay');
        if (!turdtrisRestartState.loopRunning) fail('turdtris-restart-churn', 'restart churn should restart the Turdtris render loop');
        if (turdtrisRestartState.level !== 1 || turdtrisRestartState.score !== 0 || turdtrisRestartState.linesCleared !== 0) {
          fail('turdtris-restart-churn', `restart churn should reset Tetris state, saw L${turdtrisRestartState.level} S${turdtrisRestartState.score} lines ${turdtrisRestartState.linesCleared}`);
        }
        if (turdtrisRestartState.onboardingOpen || turdtrisRestartState.gameOver) {
          fail('turdtris-restart-churn', 'restart churn should not reopen the guide or leave game-over state set');
        }
      }
    });

    await runCheck(browser, 'turdjack-guide-keyboard', 'turdjack.html', {
      actions: async (page) => {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        const jackState = await page.evaluate(() => ({
          guideOpen: document.getElementById('welcomeGuide')?.style.display !== 'none',
          roundActive,
          currentBet
        }));
        if (jackState.guideOpen) fail('turdjack-guide-keyboard', 'Enter should dismiss the opening guide');
        if (jackState.roundActive) fail('turdjack-guide-keyboard', 'Enter should not start a Crapjack hand behind the guide');
        if (jackState.currentBet !== 0) fail('turdjack-guide-keyboard', `Enter should not alter the starting bet, saw ${jackState.currentBet}`);
      }
    });

    await runCheck(browser, 'turdjack-hidden-hole-count', 'turdjack.html', {
      actions: async (page) => {
        const countStates = await page.evaluate(() => {
          function runHand(hiddenRank, replaceShoeBeforeReveal = false) {
            bankroll = 1000;
            currentBet = 20;
            lastBet = 20;
            splitBet = 0;
            roundActive = false;
            firstDecisionOpen = false;
            splitRound = false;
            activeHandIndex = 0;
            playerHand = [];
            splitHand = [];
            dealerHand = [];
            runningCount = 0;
            dealerHoleHidden = true;
            dealerHoleShoeGeneration = null;
            dealerHoleCountResolved = false;
            cutCardsRemaining = 0;
            decisionStreak = 0;
            hotStreak = 0;
            coldStreak = 0;
            roundHistory = [];
            stats = normalizeStats({});
            rules = normalizeRules({ ...rules, allowSurrender: true });
            shoe = [
              { rank: hiddenRank, suit: 'S' },
              { rank: '9', suit: 'D' },
              { rank: '5', suit: 'H' },
              { rank: '2', suit: 'C' }
            ];

            startRound();
            const before = {
              count: runningCount,
              trueCount: trueCount(),
              display: ui.runningCountText.textContent,
              hint: ui.hintText.textContent,
              hidden: dealerHoleHidden,
              holeResolved: dealerHoleCountResolved
            };

            if (replaceShoeBeforeReveal) createShoe(1);
            playerSurrender();
            const afterReveal = {
              count: runningCount,
              hidden: dealerHoleHidden,
              holeResolved: dealerHoleCountResolved
            };

            revealDealerHole();
            const afterRepeatedReveal = runningCount;

            return { before, afterReveal, afterRepeatedReveal };
          }

          return {
            highHole: runHand('K'),
            lowHole: runHand('3'),
            replacedShoeHole: runHand('3', true)
          };
        });

        const { highHole, lowHole, replacedShoeHole } = countStates;
        if (!highHole.before.hidden || !lowHole.before.hidden) {
          fail('turdjack-hidden-hole-count', 'dealer hole should remain hidden before surrender');
        }
        if (highHole.before.holeResolved || lowHole.before.holeResolved) {
          fail('turdjack-hidden-hole-count', 'hidden dealer hole entered the visible running count');
        }
        if (highHole.before.count !== 2 || lowHole.before.count !== 2) {
          fail('turdjack-hidden-hole-count', `identical exposed cards should count 2, saw ${highHole.before.count}/${lowHole.before.count}`);
        }
        if (
          highHole.before.trueCount !== lowHole.before.trueCount ||
          highHole.before.display !== lowHole.before.display ||
          highHole.before.hint !== lowHole.before.hint
        ) {
          fail('turdjack-hidden-hole-count', 'hidden card changed pre-reveal count or guidance');
        }
        if (highHole.afterReveal.count !== 1 || lowHole.afterReveal.count !== 3) {
          fail('turdjack-hidden-hole-count', `revealed K/3 should move the count to 1/3, saw ${highHole.afterReveal.count}/${lowHole.afterReveal.count}`);
        }
        if (highHole.afterReveal.hidden || lowHole.afterReveal.hidden) {
          fail('turdjack-hidden-hole-count', 'surrender should reveal the dealer hole');
        }
        if (!highHole.afterReveal.holeResolved || !lowHole.afterReveal.holeResolved) {
          fail('turdjack-hidden-hole-count', 'revealed dealer hole was not resolved for counting');
        }
        if (
          highHole.afterRepeatedReveal !== highHole.afterReveal.count ||
          lowHole.afterRepeatedReveal !== lowHole.afterReveal.count
        ) {
          fail('turdjack-hidden-hole-count', 'repeated reveal counted the dealer hole twice');
        }
        if (
          replacedShoeHole.afterReveal.count !== 0 ||
          replacedShoeHole.afterRepeatedReveal !== 0 ||
          !replacedShoeHole.afterReveal.holeResolved
        ) {
          fail('turdjack-hidden-hole-count', 'an old-shoe hole contaminated the fresh shoe count');
        }
      }
    });

    await runCheck(browser, 'turdjack-mobile', 'turdjack.html', {
      mobile: true,
      actions: async (page) => {
        await page.getByRole('button', { name: 'Quick Start' }).click();
        await page.waitForTimeout(200);
        await page.locator('.mobile-menu summary').click();
        const resetButton = page.locator('[data-reset-bank]').last();
        if (!(await resetButton.isVisible())) fail('turdjack-mobile', 'mobile reset control not visible after opening menu');
        if (!(await resetButton.isDisabled())) fail('turdjack-mobile', 'reset control should stay disabled during an active hand');
      }
    });

    await runCheck(browser, 'crapeights-mobile', 'crapeights.html', {
      mobile: true,
      actions: async (page, getDialogCount) => {
        await page.getByRole('button', { name: 'Quick Start' }).click();
        await page.waitForTimeout(200);
        await page.locator('.mobile-menu summary').click();
        const before = getDialogCount();
        await page.getByRole('button', { name: /New Match/ }).last().click();
        await page.waitForTimeout(200);
        const seen = getDialogCount() - before;
        if (seen !== 1) fail('crapeights-mobile', `expected 1 new-match dialog, saw ${seen}`);
      }
    });

    await runCheck(browser, 'crapeights-new-match-recovery', 'crapeights.html', {
      actions: async (page, getDialogCount) => {
        await page.getByRole('button', { name: 'Quick Start' }).click();
        await page.waitForTimeout(200);
        const before = getDialogCount();
        await page.locator('#newMatchBtn').click();
        await page.waitForTimeout(250);
        const seen = getDialogCount() - before;
        if (seen !== 1) fail('crapeights-new-match-recovery', `expected 1 new-match dialog, saw ${seen}`);
        const matchState = await page.evaluate(() => ({
          roundNumber,
          roundActive,
          onboardingOpen,
          scores: players.map((player) => player.score)
        }));
        if (!matchState.roundActive) fail('crapeights-new-match-recovery', 'new match should immediately start a fresh round');
        if (matchState.onboardingOpen) fail('crapeights-new-match-recovery', 'new match should not reopen the guide');
        if (matchState.roundNumber !== 1) fail('crapeights-new-match-recovery', `new match should reset to round 1, saw ${matchState.roundNumber}`);
        if (matchState.scores.some((score) => score !== 0)) fail('crapeights-new-match-recovery', `new match should zero all scores, saw ${matchState.scores.join(',')}`);
      }
    });

    await runCheck(browser, 'turdrummy-mobile', 'turdrummy.html', {
      mobile: true,
      actions: async (page, getDialogCount) => {
        await page.locator('#startRoundBtn').click();
        await page.waitForTimeout(250);
        const before = getDialogCount();
        await page.locator('#resetMatchBtn').click();
        await page.waitForTimeout(200);
        const seen = getDialogCount() - before;
        if (seen !== 1) fail('turdrummy-mobile', `expected 1 reset dialog, saw ${seen}`);
      }
    });

    await runCheck(browser, 'turdrummy-reset-recovery', 'turdrummy.html', {
      actions: async (page, getDialogCount) => {
        await page.evaluate(() => document.getElementById('startRoundBtn')?.click());
        await page.waitForTimeout(220);
        const before = getDialogCount();
        await page.evaluate(() => document.getElementById('resetMatchBtn')?.click());
        await page.waitForTimeout(220);
        const seen = getDialogCount() - before;
        if (seen !== 1) fail('turdrummy-reset-recovery', `expected 1 reset dialog, saw ${seen}`);
        const resetState = await page.evaluate(() => ({
          initialized: state.initialized,
          roundOver: state.roundOver,
          matchOver: state.matchOver,
          round: state.round
        }));
        if (resetState.initialized || resetState.roundOver || resetState.matchOver || resetState.round !== 0) {
          fail('turdrummy-reset-recovery', `reset should return TurdRummy to a pre-start state, saw ${JSON.stringify(resetState)}`);
        }

        await page.evaluate(() => document.getElementById('startRoundBtn')?.click());
        await page.waitForTimeout(220);
        const restartedState = await page.evaluate(() => ({
          initialized: state.initialized,
          roundOver: state.roundOver,
          matchOver: state.matchOver,
          round: state.round,
          playerHand: state.playerHand.length,
          aiHand: state.aiHand.length
        }));
        if (!restartedState.initialized || restartedState.round !== 1) {
          fail('turdrummy-reset-recovery', `start round should recover cleanly after reset, saw ${JSON.stringify(restartedState)}`);
        }
        if (restartedState.roundOver || restartedState.matchOver) {
          fail('turdrummy-reset-recovery', 'recovered round should be live, not marked over');
        }
        if (restartedState.playerHand !== 10 || restartedState.aiHand !== 10) {
          fail('turdrummy-reset-recovery', `recovered round should redeal 10 cards each, saw ${restartedState.playerHand}/${restartedState.aiHand}`);
        }
      }
    });

    await runCheck(browser, 'turdspades-mobile', 'turdspades.html', {
      mobile: true,
      actions: async (page) => {
        await page.locator('#quickStart').click();
        await page.waitForTimeout(250);
        const bidBox = page.locator('#bidBox');
        if (!(await bidBox.isVisible())) fail('turdspades-mobile', 'bid controls not visible after guide close');
        const bidBoxBounds = await bidBox.boundingBox();
        const viewport = page.viewportSize();
        if (!bidBoxBounds || !viewport || bidBoxBounds.y < 0 || bidBoxBounds.y + bidBoxBounds.height > viewport.height + 1) {
          fail('turdspades-mobile', `bid controls should stay inside the mobile viewport, saw ${JSON.stringify(bidBoxBounds)}`);
        }
        const nilButton = page.locator('#bidNil');
        if (!(await nilButton.isVisible())) fail('turdspades-mobile', 'Nil bid choice is not visible on mobile');
        const nilButtonBox = await nilButton.boundingBox();
        if (!nilButtonBox || nilButtonBox.height < 44) {
          fail('turdspades-mobile', `Nil bid touch target should be at least 44px tall, saw ${nilButtonBox?.height ?? 0}`);
        }
      }
    });

    await runCheck(browser, 'turdspades-guide-keyboard', 'turdspades.html', {
      actions: async (page) => {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(250);
        const spadesState = await page.evaluate(() => ({
          guideOpen: document.getElementById('guide')?.classList.contains('show'),
          phase: state.phase,
          bidTurn: state.bidTurn
        }));
        if (spadesState.guideOpen) fail('turdspades-guide-keyboard', 'Enter should dismiss the Spades guide');
        if (spadesState.phase !== 'bidding') fail('turdspades-guide-keyboard', `guide dismissal should keep the game in bidding, saw ${spadesState.phase}`);
        if (spadesState.bidTurn !== 0) fail('turdspades-guide-keyboard', `guide dismissal should not advance bidding, saw turn ${spadesState.bidTurn}`);
      }
    });

    await runCheck(browser, 'turdspades-nil-flow', 'turdspades.html', {
      actions: async (page) => {
        await page.keyboard.press('Enter');
        await page.keyboard.press('n');
        await page.waitForTimeout(120);
        const selected = await page.evaluate(() => ({
          bidChoice: state.bidChoice,
          dial: document.getElementById('bidV')?.textContent,
          pressed: document.getElementById('bidNil')?.getAttribute('aria-pressed'),
          message: state.msg
        }));
        if (selected.bidChoice !== 0 || selected.dial !== 'NIL' || selected.pressed !== 'true') {
          fail('turdspades-nil-flow', `N should visibly select Nil, saw ${JSON.stringify(selected)}`);
        }
        if (!selected.message.includes('Nil selected')) {
          fail('turdspades-nil-flow', 'selecting Nil should explain the risk before it is locked');
        }

        await page.locator('#lockBid').click();
        await page.waitForTimeout(180);
        const locked = await page.evaluate(() => ({
          bid: state.bids[0],
          phase: state.phase,
          playerMeta: document.getElementById('youMeta')?.textContent,
          bidBoxVisible: document.getElementById('bidBox')?.style.display !== 'none'
        }));
        if (locked.bid !== 0 || locked.phase !== 'play' || locked.bidBoxVisible) {
          fail('turdspades-nil-flow', `locking Nil should begin play, saw ${JSON.stringify(locked)}`);
        }
        if (!locked.playerMeta.includes('bid NIL')) {
          fail('turdspades-nil-flow', `locked Nil should remain visible in player status, saw ${locked.playerMeta}`);
        }

        const shippedLogic = await page.evaluate(() => {
          const originalBids = state.bids.slice();
          const originalTricks = state.tricks.slice();
          state.bids = [0, 3, 4, 3];
          state.tricks = [0, 3, 5, 5];
          const made = scoreTeamRound([0, 2], 8);
          state.bids = [0, 3, 4, 3];
          state.tricks = [2, 3, 4, 4];
          const failed = scoreTeamRound([0, 2], 8);
          state.bids = [4, 0, 3, 3];
          state.tricks = [0, 0, 0, 0];
          state.trick = [{ player: 0, card: { id: 'lead', suit: 'H', rank: 10 } }];
          state.hands[1] = [
            { id: 'low', suit: 'H', rank: 2 },
            { id: 'safe-dump', suit: 'H', rank: 9 },
            { id: 'winner', suit: 'H', rank: 11 }
          ];
          const nilDuck = aiCard(1).id;
          const safeHand = [
            { rank: 2, suit: 'S' },
            { rank: 3, suit: 'S' },
            { rank: 4, suit: 'S' },
            { rank: 2, suit: 'H' },
            { rank: 5, suit: 'H' },
            { rank: 8, suit: 'H' },
            { rank: 10, suit: 'H' },
            { rank: 3, suit: 'D' },
            { rank: 6, suit: 'D' },
            { rank: 9, suit: 'D' },
            { rank: 12, suit: 'D' },
            { rank: 2, suit: 'C' },
            { rank: 7, suit: 'C' }
          ];
          const safeBid = aiBid(safeHand);
          state.scores = [0, 0];
          state.bags = [8, 0];
          state.bids = [0, 3, 4, 3];
          state.tricks = [0, 3, 5, 5];
          scoreRound('browser proof');
          const recap = state.summary;
          state.bids = originalBids;
          state.tricks = originalTricks;
          return { made, failed, aiBid: safeBid, nilDuck, recap };
        });
        if (shippedLogic.made.delta !== 141 || shippedLogic.made.bags !== 9) {
          fail('turdspades-nil-flow', `made Nil scoring drifted: ${JSON.stringify(shippedLogic.made)}`);
        }
        if (shippedLogic.failed.delta !== -158 || shippedLogic.failed.bags !== 0 || shippedLogic.failed.bagPenalties !== 1) {
          fail('turdspades-nil-flow', `failed Nil/bag scoring drifted: ${JSON.stringify(shippedLogic.failed)}`);
        }
        if (shippedLogic.aiBid !== 0) fail('turdspades-nil-flow', `safe Nil bot hand should bid 0, saw ${shippedLogic.aiBid}`);
        if (shippedLogic.nilDuck !== 'safe-dump') fail('turdspades-nil-flow', `Nil bot should shed its highest losing card, saw ${shippedLogic.nilDuck}`);
        if (!shippedLogic.recap.includes('You made NIL (+100)') || !shippedLogic.recap.includes('round total +141')) {
          fail('turdspades-nil-flow', `round recap should itemize Nil scoring, saw ${shippedLogic.recap}`);
        }
      }
    });
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }

  console.log('Browser smoke checks passed');
}

main().catch((err) => {
  console.error(err.message || String(err));
  process.exit(1);
});
