import { chromium, devices } from 'playwright';
import { validEightsSnapshot, validJackSnapshot, validRummySnapshot, validSpadesSnapshot } from './tests/continue-fixtures.js';

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
    { ...(options.mobile ? devices['iPhone 12'] : { viewport: { width: 1440, height: 900 } }), ...options.context }
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

async function checkPhoneHub(page, name, firstScreen = true) {
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    cards: [...document.querySelectorAll('.game-card')].map(card => {
      const box = element => {
        const { left, right, top, bottom, height } = element.getBoundingClientRect();
        return { left, right, top, bottom, height };
      };
      return {
        name: card.querySelector('h2').textContent,
        rect: box(card),
        title: box(card.querySelector('h2')),
        description: box(card.querySelector('p')),
        action: box(card.querySelector('.play'))
      };
    })
  }));
  if (layout.scrollWidth > layout.width) fail(name, 'hub should not scroll horizontally');
  if (layout.cards.length !== 6) fail(name, 'phone hub must keep exactly six launch links');
  for (const card of layout.cards) {
    if (card.rect.height < 44) fail(name, `${card.name} needs a full-row touch target`);
    if (firstScreen && (card.rect.top < 0 || card.rect.bottom > layout.height)) {
      fail(name, `${card.name} escaped the first screen: ${JSON.stringify(card.rect)}`);
    }
    for (const part of [card.title, card.description, card.action]) {
      if (part.left < card.rect.left || part.right > card.rect.right || part.top < card.rect.top || part.bottom > card.rect.bottom) {
        fail(name, `${card.name} clips its name, genre, or launch action`);
      }
    }
    if ([card.title, card.description].some(part =>
      part.left < card.action.right && part.right > card.action.left &&
      part.top < card.action.bottom && part.bottom > card.action.top)) {
      fail(name, `${card.name} text overlaps the launch action`);
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
        if ((await page.locator('.game-card.last-played').count()) !== 0) {
          fail('root-hub', 'a first visit should not mark a last-played game');
        }
        if ((await page.locator('.game-card.in-progress').count()) !== 0) {
          fail('root-hub', 'a first visit should not mark an in-progress game');
        }
      }
    });

    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
      const name = `hub-phone-${viewport.width}`;
      await runCheck(browser, name, '', {
        mobile: true,
        context: { viewport },
        actions: async page => {
          await checkPhoneHub(page, name);
          const links = await page.locator('.game-card').evaluateAll(cards => cards.map(card => card.getAttribute('href')));
          for (const href of links) {
            await Promise.all([
              page.waitForURL(`${baseUrl}/${href}`),
              page.locator(`.game-card[href="${href}"]`).tap()
            ]);
            await page.goto(`${baseUrl}/`);
          }
          await page.evaluate(games => {
            localStorage.setItem('turdsuite_continue_v1', JSON.stringify({ v: 1, games }));
            localStorage.setItem('turdsuite_last_game', 'TurdAnoid.html');
          }, {
            'turdjack.html': { snapshot: validJackSnapshot() },
            'crapeights.html': { snapshot: validEightsSnapshot() },
            'turdrummy.html': { snapshot: validRummySnapshot() },
            'turdspades.html': { snapshot: validSpadesSnapshot() }
          });
          await page.reload();
          await checkPhoneHub(page, `${name}-returning`);
          if (await page.locator('.game-card.in-progress').count() !== 4) fail(name, 'only the four live card tables should Continue');
          const arcade = await page.locator('.game-card[href="TurdAnoid.html"] .play').textContent();
          if (!arcade.includes('Play again')) fail(name, 'arcade last-played must remain Play again');
          // The badge is hidden on phones; the row edge accent must carry the cue.
          const edges = await page.evaluate(() => {
            const px = el => parseFloat(getComputedStyle(el).borderLeftWidth) || 0;
            const plain = document.querySelector('.game-card:not(.in-progress):not(.last-played)');
            const progress = document.querySelector('.game-card.in-progress');
            const played = document.querySelector('.game-card[href="TurdAnoid.html"].last-played');
            return { plain: px(plain), progress: px(progress), played: px(played) };
          });
          if (!(edges.progress > edges.plain)) fail(name, `an in-progress row needs a visible edge accent, saw ${JSON.stringify(edges)}`);
          if (!(edges.played > edges.plain)) fail(name, `a last-played row needs a visible edge accent, saw ${JSON.stringify(edges)}`);
          await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
          await checkPhoneHub(page, `${name}-large-text`, false);
        }
      });
    }

    await runCheck(browser, 'hub-phone-no-script', '', {
      mobile: true,
      context: { viewport: { width: 320, height: 568 }, javaScriptEnabled: false },
      assert: page => checkPhoneHub(page, 'hub-phone-no-script')
    });

    await runCheck(browser, 'hub-keyboard-launch', '', {
      actions: async page => {
        const links = await page.locator('.game-card').evaluateAll(cards => cards.map(card => card.getAttribute('href')));
        for (const href of links) {
          await page.keyboard.press('Tab');
          const focused = await page.evaluate(() => document.activeElement?.getAttribute('href'));
          if (focused !== href) fail('hub-keyboard-launch', `expected ${href} in keyboard order, saw ${focused}`);
        }
        await Promise.all([
          page.waitForURL(`${baseUrl}/turdspades.html`),
          page.keyboard.press('Enter')
        ]);
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

    await runCheck(browser, 'turdanoid-paddle-size-across-walls', 'TurdAnoid.html', {
      actions: async (page) => {
        await page.locator('#btnStart').click();
        await page.waitForTimeout(180);
        const result = await page.evaluate(() => {
          const g = window.__turdanoid;
          const baseW = g.paddle.baseW;
          g.applyPower({ t: 'enlarge' });
          const wide = g.paddle.w;
          g.newLevel();
          return {
            baseW,
            wide,
            after: g.paddle.w,
            big: g.activePowers.big || 0,
            chip: document.getElementById('powers')?.textContent || '',
            xOk: g.paddle.x >= g.paddle.w / 2 && g.paddle.x <= g.W - g.paddle.w / 2,
            waitingLaunch: g.waitingLaunch
          };
        });
        if (!(result.wide > result.baseW)) {
          fail('turdanoid-paddle-size-across-walls', 'Enlarge should widen the paddle before the wall change');
        }
        if (result.after !== result.wide) {
          fail(
            'turdanoid-paddle-size-across-walls',
            `wall clear stripped paddle width ${result.wide} -> ${result.after}`
          );
        }
        if (!(result.big > 0)) {
          fail('turdanoid-paddle-size-across-walls', 'Enlarge timer should survive the wall');
        }
        if (!result.chip.includes('Big')) {
          fail('turdanoid-paddle-size-across-walls', `HUD should still say Big, saw ${JSON.stringify(result.chip)}`);
        }
        if (!result.xOk) {
          fail('turdanoid-paddle-size-across-walls', 'sized paddle must stay on court after the wall change');
        }
        if (!result.waitingLaunch) {
          fail('turdanoid-paddle-size-across-walls', 'next wall should still wait for launch');
        }
      }
    });

    await runCheck(browser, 'turdanoid-bomb-destroy-score', 'TurdAnoid.html', {
      actions: async (page) => {
        await page.locator('#btnStart').click();
        await page.waitForTimeout(180);
        const result = await page.evaluate(() => {
          const g = window.__turdanoid;
          const near = {
            x: g.W / 2 - 18,
            y: g.H / 2 - 8,
            w: 36,
            h: 16,
            hp: 1,
            c1: '#7af1c4',
            c2: '#2a6644',
            glow: false
          };
          const far = {
            x: -10,
            y: 0,
            w: 36,
            h: 16,
            hp: 1,
            c1: '#ff9d74',
            c2: '#8a4020',
            glow: false
          };
          g.bricks = [near, far];
          const before = g.score;
          g.applyPower({ t: 'bomb' });
          return {
            before,
            after: g.score,
            remaining: g.bricks.length,
            hud: document.getElementById('hudScore')?.textContent || '',
            float: (g.floats || []).some((item) => item.text === '+5'),
            level: g.level,
            transition: g.levelTransition
          };
        });
        if (result.after !== result.before + 5 * result.level) {
          fail(
            'turdanoid-bomb-destroy-score',
            `Bomb should pay the destroy bonus, saw ${result.before} -> ${result.after}`
          );
        }
        if (result.remaining !== 1) {
          fail('turdanoid-bomb-destroy-score', `far brick should survive, remaining ${result.remaining}`);
        }
        if (result.hud !== String(result.after)) {
          fail('turdanoid-bomb-destroy-score', `HUD should show ${result.after}, saw ${result.hud}`);
        }
        if (!result.float) {
          fail('turdanoid-bomb-destroy-score', 'killed brick should float +5');
        }
        if (result.transition) {
          fail('turdanoid-bomb-destroy-score', 'survivor must prevent a fake wall clear');
        }
      }
    });

    await runCheck(browser, 'turdanoid-flush-destroy-score', 'TurdAnoid.html', {
      actions: async (page) => {
        await page.locator('#btnStart').click();
        await page.waitForTimeout(180);
        const result = await page.evaluate(() => {
          const g = window.__turdanoid;
          const bottom = {
            x: 80,
            y: 200,
            w: 36,
            h: 16,
            hp: 1,
            c1: '#7af1c4',
            c2: '#2a6644',
            glow: false
          };
          const upper = {
            x: 80,
            y: 40,
            w: 36,
            h: 16,
            hp: 1,
            c1: '#ff9d74',
            c2: '#8a4020',
            glow: false
          };
          g.bricks = [bottom, upper];
          const before = g.score;
          g.applyPower({ t: 'flush' });
          const goldBefore = g.score;
          g.activePowers.gold = 60 * 6;
          g.bricks = [
            { ...bottom, hp: 3 },
            { ...upper }
          ];
          g.applyPower({ t: 'flush' });
          return {
            before,
            after: goldBefore,
            goldAfter: g.score,
            remaining: g.bricks.length,
            hud: document.getElementById('hudScore')?.textContent || '',
            float: (g.floats || []).some((item) => item.text === '+15'),
            goldFloat: (g.floats || []).some((item) => item.text === '+30'),
            level: g.level,
            transition: g.levelTransition
          };
        });
        if (result.after !== result.before + 15 * result.level) {
          fail(
            'turdanoid-flush-destroy-score',
            `Flush should pay the flush bonus, saw ${result.before} -> ${result.after}`
          );
        }
        if (result.goldAfter !== result.after + 30 * result.level) {
          fail(
            'turdanoid-flush-destroy-score',
            `Gold Rush should double the flush bonus, saw ${result.after} -> ${result.goldAfter}`
          );
        }
        if (result.remaining !== 1) {
          fail('turdanoid-flush-destroy-score', `upper brick should survive, remaining ${result.remaining}`);
        }
        if (result.hud !== String(result.goldAfter)) {
          fail('turdanoid-flush-destroy-score', `HUD should show ${result.goldAfter}, saw ${result.hud}`);
        }
        if (!result.float) {
          fail('turdanoid-flush-destroy-score', 'flushed brick should float +15');
        }
        if (!result.goldFloat) {
          fail('turdanoid-flush-destroy-score', 'Gold Rush flush should float +30');
        }
        if (result.transition) {
          fail('turdanoid-flush-destroy-score', 'upper brick must prevent a fake wall clear');
        }
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

        await page.evaluate(() => window.scrollTo(0, 480));
        await page.waitForTimeout(100);
        const dockState = await page.evaluate(() => {
          const dock = document.getElementById('mobileControls');
          const hub = document.querySelector('.suite-back-pill');
          const progress = document.getElementById('mobileLevelProgressBar');
          const queue = document.getElementById('mobilePieceQueue');
          const mobileHold = document.getElementById('mobileHold');
          const mobileNext = document.getElementById('mobileNext');
          const extra = dock?.querySelector('details, .mobile-extra');
          const buttons = [...document.querySelectorAll('#mobileControls [data-action]')];
          const actions = buttons.map((button) => button.getAttribute('data-action'));
          if (!dock || !hub || !progress || !queue || !mobileHold || !mobileNext || buttons.length !== 7) return null;
          const dockRect = dock.getBoundingClientRect();
          const hubRect = hub.getBoundingClientRect();
          const inViewport = (el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight + 1;
          };
          return {
            position: getComputedStyle(dock).position,
            dockTop: dockRect.top,
            dockBottom: dockRect.bottom,
            viewportHeight: window.innerHeight,
            hubBottom: hubRect.bottom,
            progressVisible: getComputedStyle(progress).display !== 'none',
            queueVisible: getComputedStyle(queue).display !== 'none' && inViewport(mobileHold) && inViewport(mobileNext),
            buriedExtra: !!extra,
            actions,
            buttonsVisible: buttons.every((button) => {
              const rect = button.getBoundingClientRect();
              const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
              return rect.top >= 0 && rect.bottom <= window.innerHeight && (hit === button || button.contains(hit));
            })
          };
        });
        if (!dockState) fail('turdtris-mobile', 'mobile play dock or Hub escape is missing');
        if (dockState.position !== 'fixed') fail('turdtris-mobile', `play dock should stay fixed during the run, saw ${dockState.position}`);
        if (dockState.dockTop < 0 || dockState.dockBottom > dockState.viewportHeight + 1) {
          fail('turdtris-mobile', `play dock escaped the viewport: ${JSON.stringify(dockState)}`);
        }
        if (!dockState.buttonsVisible) fail('turdtris-mobile', 'a primary thumb control is hidden or covered');
        if (!dockState.progressVisible) fail('turdtris-mobile', 'next-flush progress is hidden during mobile play');
        if (!dockState.queueVisible) fail('turdtris-mobile', 'Hold and Next must stay visible on the thumb dock');
        if (dockState.hubBottom > dockState.dockTop - 4) fail('turdtris-mobile', 'Hub escape overlaps the fixed play dock');
        if (dockState.buriedExtra) fail('turdtris-mobile', 'Hold, Down, and Pause must stay on the dock, not behind More Controls');
        if (!['left', 'rotate', 'right', 'drop', 'down', 'hold', 'pause'].every((action) => dockState.actions.includes(action))) {
          fail('turdtris-mobile', `play dock is missing a live control: ${JSON.stringify(dockState.actions)}`);
        }

        const beforeCol = await page.evaluate(() => tetromino.col);
        await page.getByRole('button', { name: 'Right', exact: true }).click();
        const afterCol = await page.evaluate(() => tetromino.col);
        if (afterCol !== beforeCol + 1) fail('turdtris-mobile', `visible Right control did not move the active piece: ${beforeCol} -> ${afterCol}`);

        const holdState = await page.evaluate(() => tetromino.name);
        await page.getByRole('button', { name: 'Hold', exact: true }).click();
        const afterHold = await page.evaluate(() => ({
          holdName,
          current: tetromino && tetromino.name,
          canHold,
          holdUsed: document.querySelector('#mobileControls [data-action="hold"]')?.classList.contains('is-used'),
          holdBoxUsed: document.getElementById('mobileHoldBox')?.classList.contains('is-used'),
          holdDisabled: document.querySelector('#mobileControls [data-action="hold"]')?.getAttribute('aria-disabled')
        }));
        if (afterHold.holdName !== holdState) {
          fail('turdtris-mobile', `visible Hold control did not store the active piece: ${JSON.stringify({ holdState, afterHold })}`);
        }
        if (afterHold.canHold || !afterHold.holdUsed || !afterHold.holdBoxUsed || afterHold.holdDisabled !== 'true') {
          fail('turdtris-mobile', `used Hold must dim on the dock: ${JSON.stringify(afterHold)}`);
        }
        const refusedHold = await page.evaluate(() => {
          stopLoop();
          dropAccumulator = 0;
          lastFrameTime = 0;
          holdCurrentPiece();
          return {
            holdName,
            current: tetromino && tetromino.name,
            canHold,
            statusText
          };
        });
        if (refusedHold.holdName !== holdState || refusedHold.current !== afterHold.current || refusedHold.canHold) {
          fail('turdtris-mobile', `a second Hold tap must not swap this piece: ${JSON.stringify({ holdState, afterHold, refusedHold })}`);
        }
        if (refusedHold.statusText !== 'Hold already used this piece.') {
          fail('turdtris-mobile', `used Hold must say why it refused: ${refusedHold.statusText}`);
        }

        await page.getByRole('button', { name: 'Pause', exact: true }).click();
        const pausedState = await page.evaluate(() => ({
          paused,
          overlay: document.getElementById('pauseOverlay')?.style.display
        }));
        if (!pausedState.paused || pausedState.overlay !== 'grid') {
          fail('turdtris-mobile', `visible Pause control did not pause the run: ${JSON.stringify(pausedState)}`);
        }
        await page.getByRole('button', { name: 'Resume', exact: true }).click();

        const progress = await page.evaluate(() => {
          level = 3;
          levelLines = 4;
          levelGoal = 8;
          updateScore();
          const bar = document.getElementById('levelProgressBar');
          const mobileBar = document.getElementById('mobileLevelProgressBar');
          return {
            text: document.getElementById('levelProgressText')?.textContent,
            preview: document.getElementById('nextLevelPreview')?.textContent,
            width: document.getElementById('levelProgressFill')?.style.width,
            now: bar?.getAttribute('aria-valuenow'),
            max: bar?.getAttribute('aria-valuemax'),
            mobileText: document.getElementById('mobileLevelProgressText')?.textContent,
            mobileWidth: document.getElementById('mobileLevelProgressFill')?.style.width,
            mobileNow: mobileBar?.getAttribute('aria-valuenow'),
            mobileMax: mobileBar?.getAttribute('aria-valuemax')
          };
        });
        if (progress.text !== '4 / 8 lines' || progress.width !== '50%' || progress.now !== '4' || progress.max !== '8') {
          fail('turdtris-mobile', `next-level pulse is not bound to the recorded run: ${JSON.stringify(progress)}`);
        }
        if (!/Level 4/.test(progress.preview || '') || !/1 garbage line/.test(progress.preview || '')) {
          fail('turdtris-mobile', `next modifier is not previewed honestly: ${progress.preview}`);
        }
        if (progress.mobileText !== '4 / 8' || progress.mobileWidth !== '50%' || progress.mobileNow !== '4' || progress.mobileMax !== '8') {
          fail('turdtris-mobile', `mobile next-flush pulse is not bound to the recorded run: ${JSON.stringify(progress)}`);
        }
      }
    });

    await runCheck(browser, 'turdtris-held-input-pause', 'turdtris.html', {
      mobile: true,
      actions: async (page) => {
        await page.getByRole('button', { name: 'Review Then Start' }).click();
        await page.keyboard.down('ArrowDown');
        await page.keyboard.press('p');
        await page.getByRole('button', { name: 'Resume', exact: true }).click();
        if (await page.evaluate(() => softDrop)) {
          fail('turdtris-held-input-pause', 'released soft drop must not accelerate the resumed run');
        }
        await page.keyboard.up('ArrowDown');

        const left = await page.locator('[data-action="left"]').boundingBox();
        await page.mouse.move(left.x + left.width / 2, left.y + left.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(100);
        if (!(await page.evaluate(() => holdInterval !== null))) {
          fail('turdtris-held-input-pause', 'held phone movement did not start');
        }
        await page.keyboard.press('p');
        const state = await page.evaluate(() => ({ softDrop, holdInterval, col: tetromino.col }));
        if (state.softDrop || state.holdInterval !== null) {
          fail('turdtris-held-input-pause', 'pausing must release held phone movement');
        }
        await page.keyboard.press('p');
        await page.waitForTimeout(180);
        if ((await page.evaluate(() => tetromino.col)) !== state.col) {
          fail('turdtris-held-input-pause', 'resume moved sideways without a fresh press');
        }
        await page.mouse.up();

        await page.keyboard.press('p');
        await page.locator('[data-action="down"]').click();
        if (await page.evaluate(() => softDrop || holdInterval !== null)) {
          fail('turdtris-held-input-pause', 'paused dock input must not queue a drop');
        }
        await page.locator('[data-action="pause"]').click();
        if (await page.evaluate(() => paused)) {
          fail('turdtris-held-input-pause', 'phone Pause control must still resume');
        }
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

        const slamState = await page.evaluate(() => {
          const startRow = tetromino.row;
          lastFrameTime = 1000;
          loop(1000 + 5000);
          return {
            startRow,
            row: tetromino.row,
            dropAccumulator,
            clamped: clampFrameDelta(5000)
          };
        });
        if (slamState.clamped !== 33) {
          fail('turdtris-restart-churn', `a hitch must clamp to one frame, saw ${slamState.clamped}`);
        }
        if (slamState.row !== slamState.startRow || slamState.dropAccumulator > 33) {
          fail('turdtris-restart-churn', `a 5s frame hitch must not dump gravity: ${JSON.stringify(slamState)}`);
        }

        await page.evaluate(() => {
          score = 240;
          runBestAtStart = 100;
          showGameOver(false);
        });
        const overState = await page.evaluate(() => ({
          gameOver,
          bestLabel: document.getElementById('endBestLabel')?.textContent,
          best: document.getElementById('endBest')?.textContent
        }));
        if (!overState.gameOver) fail('turdtris-restart-churn', 'forced wipeout should open game over');
        if (overState.bestLabel !== 'New best' || overState.best !== '240') {
          fail('turdtris-restart-churn', `game over must show an honest new-best receipt: ${JSON.stringify(overState)}`);
        }
        await page.keyboard.press('Space');
        const replayState = await page.evaluate(() => ({
          gameOver,
          score,
          overlay: document.getElementById('gameOverOverlay')?.style.display,
          loopRunning: rAF !== null
        }));
        if (replayState.gameOver || replayState.score !== 0 || replayState.overlay !== 'none' || !replayState.loopRunning) {
          fail('turdtris-restart-churn', `Space must replay after game over: ${JSON.stringify(replayState)}`);
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
        const debugHook = await page.evaluate(() => window._crapjackBoss);
        if (debugHook) fail('turdjack-guide-keyboard', 'Pages should not expose the leftover Crapjack debug hook');
      }
    });

    for (const mobile of [false, true]) {
      const name = mobile ? 'turdjack-soft-smart-mobile-continue' : 'turdjack-soft-smart-keyboard';
      await runCheck(browser, name, 'turdjack.html', {
        mobile,
        actions: async (page) => {
          await page.keyboard.press('Enter'); // Dismiss the guide, not a deal.
          await page.evaluate(() => {
            rules = normalizeRules({ ...rules, decks: 1, allowSurrender: true, allowInsurance: false });
            createShoe(1);
            const pull = (rank, suit) => {
              const index = shoe.findIndex(card => card.rank === rank && card.suit === suit);
              if (index < 0) throw new Error(`Missing physical fixture card ${rank}${suit}`);
              return shoe.splice(index, 1)[0];
            };
            const nextHit = pull('2', 'C');
            const hole = pull('8', 'S');
            const second = pull('5', 'C');
            const up = pull('9', 'D');
            const first = pull('A', 'H');
            shoe.push(nextHit, hole, second, up, first);
            bankroll = 1000;
            currentBet = 100;
            lastBet = 100;
            stats = normalizeStats({});
            decisionStreak = 0;
            hotStreak = 0;
            coldStreak = 0;
            startRound();
          });

          // The phone path also proves that Continue recomputes live advice;
          // no persisted recommendation or new public debug hook is involved.
          if (mobile) await page.reload({ waitUntil: 'load' });
          const before = await page.evaluate(() => ({
            active: roundActive,
            bankroll,
            total: handValue(playerHand),
            soft: isSoftHand(playerHand),
            hint: ui.hintText.textContent,
            surrenderAvailable: !ui.surrenderBtn.disabled,
            cards: [...shoe, ...discard, ...playerHand, ...dealerHand, ...splitHand]
              .map(card => card.rank + card.suit)
          }));
          if (!before.active || before.bankroll !== 900 || before.total !== 16 || !before.soft
            || before.cards.length !== 52 || new Set(before.cards).size !== 52) {
            throw new Error(`Expected a real single-deck soft16 fixture: ${JSON.stringify(before)}`);
          }
          if (!before.hint.startsWith('Hint: Hit.') || !before.hint.includes('Soft 16')) {
            fail(name, `soft16 must recommend Hit and explain the soft total, saw ${before.hint}`);
          }
          if (!before.surrenderAvailable) fail(name, 'manual surrender must remain an available choice');
          if (mobile) await page.locator('#mobilePit [data-mobile-action="smart"]').click();
          else await page.keyboard.press('Enter');

          const after = await page.evaluate(() => ({
            active: roundActive,
            bankroll,
            cards: playerHand.map(card => card.rank + card.suit),
            total: handValue(playerHand),
            hidden: dealerHoleHidden,
            surrenderCount: stats.surrenders,
            losses: stats.losses,
            decisions: stats.decisions,
            correct: stats.correctDecisions,
            discipline: ui.disciplineText.textContent,
            bankrollLabel: ui.bankrollText.textContent,
            firstDecisionOpen
          }));
          if (!after.active || after.bankroll !== 900 || after.total !== 18
            || JSON.stringify(after.cards) !== JSON.stringify(['AH', '5C', '2C'])
            || !after.hidden || after.surrenderCount !== 0 || after.losses !== 0
            || after.decisions !== 1 || after.correct !== 1 || after.discipline !== '100%'
            || after.bankrollLabel !== '$900' || after.firstDecisionOpen) {
            fail(name, `Smart should draw once and retain the live hand, not forfeit half the bet: ${JSON.stringify(after)}`);
          }
        }
      });
    }

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
        await page.evaluate(() => {
          createShoe(4);
          const pull = (rank, suit) => {
            const index = shoe.findIndex((card) => card.rank === rank && card.suit === suit);
            return shoe.splice(index, 1)[0];
          };
          const hole = pull('K', 'S');
          const playerTwo = pull('9', 'D');
          const dealerUp = pull('5', 'H');
          const playerOne = pull('2', 'C');
          shoe = shoe.concat([hole, playerTwo, dealerUp, playerOne]);
          bankroll = 1000;
          currentBet = 20;
          lastBet = 20;
          startRound();
        });
        await page.waitForFunction(() => roundActive && playerHand.length === 2, undefined, { timeout: 3000 });
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

    for (const mobile of [false, true]) {
      const name = `turdrummy-chain-layoff-${mobile ? 'phone' : 'desktop'}`;
      await runCheck(browser, name, 'turdrummy.html', {
        mobile,
        actions: async (page) => {
          const fixture = await page.evaluate(() => {
            closeGuide();
            resetMatch();
            const deck = createDeck();
            const hand = (spec) => spec.split(' ').map((value) => deck.find((card) =>
              card.suit === value[0] && card.rank === Number(value.slice(1))));
            state.playerHand = hand('H3 H4 H5 C9 D9 S9 C10 D10 H10 D1 C13');
            state.aiHand = hand('H6 H7 C1 C2 C3 S4 S5 S6 S7 S8');
            const used = new Set([...state.playerHand, ...state.aiHand].map(card => card.id));
            state.stock = deck.filter(card => !used.has(card.id));
            state.discard = [state.stock.pop()];
            const discard = state.playerHand.at(-1);
            Object.assign(state, {
              initialized: true, round: 1, turn: 'player', phase: 'discard',
              selectedCardId: discard.id, drawnCardId: discard.id, drawnCardSource: 'stock',
              roundOver: false, matchOver: false, message: 'Fixture: knock with one deadwood.'
            });
            renderAll();
            return {
              unique: new Set([...state.playerHand, ...state.aiHand, ...state.stock, ...state.discard].map(card => card.id)).size,
              knocker: analyzeHand(handAfterDiscard(state.playerHand, discard.id)).deadwoodScore,
              defender: analyzeHand(state.aiHand).deadwoodScore
            };
          });
          if (fixture.unique !== 52 || fixture.knocker !== 1 || fixture.defender !== 13) {
            fail(name, `invalid deterministic full-deck fixture: ${JSON.stringify(fixture)}`);
          }
          await page.locator('#knockBtn').click();
          const result = await page.evaluate(() => ({
            player: state.playerScore, ai: state.aiScore, undercuts: state.stats.undercuts,
            roundOver: state.roundOver, summary: state.roundSummary,
            receipt: document.getElementById('messageBox').textContent,
            playerLabel: document.getElementById('playerScoreValue').textContent,
            aiLabel: document.getElementById('aiScoreValue').textContent
          }));
          if (result.player !== 0 || result.ai !== 26 || result.undercuts !== 1 || !result.roundOver) {
            fail(name, `H6 then H7 must undercut a one-deadwood knock: ${JSON.stringify(result)}`);
          }
          if (result.playerLabel !== '0' || result.aiLabel !== '26'
            || !result.receipt.includes('Undercut!') || !result.receipt.includes('defender deadwood: 0')
            || !result.summary.includes('6♥') || !result.summary.includes('7♥')) {
            fail(name, `visible score and layoff receipt must match the awarded round: ${JSON.stringify(result)}`);
          }
          await page.locator('#newRoundBtn').click();
          const next = await page.evaluate(() => {
            clearAiTurnTimeout();
            return { round: state.round, player: state.playerScore, ai: state.aiScore,
              undercuts: state.stats.undercuts, roundOver: state.roundOver };
          });
          if (next.round !== 2 || next.player !== 0 || next.ai !== 26 || next.undercuts !== 1 || next.roundOver) {
            fail(name, `next round must preserve the single correct award: ${JSON.stringify(next)}`);
          }
        }
      });
    }

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
          if (typeof clearAiTimer === 'function') clearAiTimer();
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

    await runCheck(browser, 'turdspades-pace-cover-blur', 'turdspades.html', {
      actions: async (page) => {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(120);
        await page.locator('#lockBid').click();
        const atLock = await page.evaluate(() => {
          if (typeof clearAiTimer === 'function') clearAiTimer();
          return {
            phase: state.phase,
            currentPlayer: state.currentPlayer,
            trick: state.trick.length,
            timerArmed: typeof scheduleAiIfNeeded === 'function'
          };
        });
        if (atLock.phase !== 'play') fail('turdspades-pace-cover-blur', `locking a bid should start play, saw ${atLock.phase}`);
        if (atLock.currentPlayer === 0) fail('turdspades-pace-cover-blur', 'round-1 lead should belong to a bot so pacing is visible');
        if (atLock.trick !== 0) fail('turdspades-pace-cover-blur', 'bot cards should not dump onto the trick in the same turn as lock');

        await page.evaluate(() => {
          focusSuspendedPlay = false;
          scheduleAiIfNeeded(40);
        });
        await page.waitForFunction((lead) => (
          state.trick.length >= 1 || state.currentPlayer !== lead || aiTurnTimeoutId === null
        ), atLock.currentPlayer, { timeout: 2000 });
        const afterOne = await page.evaluate(() => ({
          trick: state.trick.length,
          currentPlayer: state.currentPlayer,
          pending: aiTurnTimeoutId !== null
        }));
        if (afterOne.trick < 1 && afterOne.currentPlayer === atLock.currentPlayer) {
          fail('turdspades-pace-cover-blur', `first paced bot card never appeared, saw ${JSON.stringify(afterOne)}`);
        }

        const cover = await page.evaluate(() => {
          if (typeof clearAiTimer === 'function') clearAiTimer();
          focusSuspendedPlay = false;
          state.phase = 'play';
          state.currentPlayer = 1;
          state.bids = [4, 3, 4, 0];
          state.tricks = [0, 0, 0, 0];
          state.spadesBroken = false;
          state.trick = [{ player: 3, card: { id: 'east-win', suit: 'H', rank: 9 } }];
          state.hands[1] = [
            { id: 'low', suit: 'H', rank: 3 },
            { id: 'cover', suit: 'H', rank: 12 },
            { id: 'ace', suit: 'H', rank: 14 }
          ];
          return aiCard(1)?.id;
        });
        if (cover !== 'cover') fail('turdspades-pace-cover-blur', `West should overtake East's Nil winner with Q♥, saw ${cover}`);

        const blurState = await page.evaluate(() => {
          if (typeof clearAiTimer === 'function') clearAiTimer();
          focusSuspendedPlay = false;
          state.phase = 'play';
          state.currentPlayer = 1;
          state.hands[1] = [{ id: 'wait', suit: 'C', rank: 2 }];
          state.trick = [];
          scheduleAiIfNeeded(10000);
          const armed = aiTurnTimeoutId !== null;
          window.dispatchEvent(new Event('blur'));
          return {
            armed,
            suspended: focusSuspendedPlay,
            timer: aiTurnTimeoutId,
            message: state.msg
          };
        });
        if (!blurState.armed) fail('turdspades-pace-cover-blur', 'pending bot turn should arm a timer before blur');
        if (!blurState.suspended) fail('turdspades-pace-cover-blur', 'blur should suspend a pending bot turn');
        if (blurState.timer !== null) fail('turdspades-pace-cover-blur', 'blur should cancel the pending bot timer');
        if (!String(blurState.message).includes('paused')) {
          fail('turdspades-pace-cover-blur', `blur should tell the player the table paused, saw ${blurState.message}`);
        }

        const resumeState = await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, value: false });
          document.dispatchEvent(new Event('visibilitychange'));
          return {
            suspended: focusSuspendedPlay,
            timerArmed: aiTurnTimeoutId !== null
          };
        });
        if (resumeState.suspended) fail('turdspades-pace-cover-blur', 'returning to the tab should clear the focus suspend flag');
        if (!resumeState.timerArmed) fail('turdspades-pace-cover-blur', 'returning to the tab should rearm the pending bot turn');
        await page.evaluate(() => { if (typeof clearAiTimer === 'function') clearAiTimer(); });
      }
    });

    for (const game of ['turdspades', 'turdrummy', 'crapeights']) {
      await runCheck(browser, `${game}-window-return`, `${game}.html`, {
        actions: async (page) => {
          const paused = await page.evaluate((game) => {
            if (game === 'turdspades') {
              closeGuide();
              document.getElementById('lockBid').click();
              scheduleAiIfNeeded(10000);
            } else if (game === 'turdrummy') {
              closeGuide();
              startFirstRoundIfNeeded();
              state.turn = 'ai';
              queueAiTurn(10000);
            } else {
              hideWelcomeGuide();
              startFreshMatch();
              currentPlayer = 1;
              scheduleTurnIfNeeded();
            }
            const armed = aiTurnTimeoutId !== null;
            window.dispatchEvent(new Event('blur'));
            return { armed, timerCleared: aiTurnTimeoutId === null, hidden: document.hidden };
          }, game);
          if (!paused.armed || !paused.timerCleared || paused.hidden) {
            fail(`${game}-window-return`, `visible window blur should pause a pending turn: ${JSON.stringify(paused)}`);
          }

          const resumed = await page.evaluate((game) => {
            Object.defineProperty(document, 'hidden', { configurable: true, value: true });
            window.dispatchEvent(new Event('focus'));
            const hiddenStayedPaused = aiTurnTimeoutId === null;
            Object.defineProperty(document, 'hidden', { configurable: true, value: false });
            // A visible window returning from another app need not emit visibilitychange.
            window.dispatchEvent(new Event('focus'));
            const timer = aiTurnTimeoutId;
            window.dispatchEvent(new Event('focus'));
            document.dispatchEvent(new Event('visibilitychange'));
            const sameTimer = timer !== null && aiTurnTimeoutId === timer;
            const cards = game === 'turdspades'
              ? [state.hands, state.trick, state.currentPlayer]
              : game === 'turdrummy'
                ? [state.aiHand, state.stock, state.discard, state.turn]
                : [players.map((player) => player.hand), deck, discard, currentPlayer];
            return { hiddenStayedPaused, sameTimer, before: JSON.stringify(cards) };
          }, game);
          if (!resumed.hiddenStayedPaused) fail(`${game}-window-return`, 'a focus event while hidden must not restart the bot');
          if (!resumed.sameTimer) fail(`${game}-window-return`, 'visible focus must arm exactly one timer even with repeated focus/visibility events');
          await page.waitForFunction(({ game, before }) => {
            const cards = game === 'turdspades'
              ? [state.hands, state.trick, state.currentPlayer]
              : game === 'turdrummy'
                ? [state.aiHand, state.stock, state.discard, state.turn]
                : [players.map((player) => player.hand), deck, discard, currentPlayer];
            return JSON.stringify(cards) !== before;
          }, { game, before: resumed.before }, { timeout: 3000 });
          await page.evaluate((game) => {
            // Stop the fixture after proving an actual bot move, before the next turn.
            if (game === 'turdrummy') clearAiTurnTimeout();
            else clearAiTimer();
          }, game);
        }
      });
    }

    await runCheck(browser, 'hub-last-played', 'turdspades.html', {
      actions: async (page) => {
        await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
        await page.waitForTimeout(250);
        const marked = await page.evaluate(() => {
          const card = document.querySelector('.game-card.last-played');
          return {
            cards: document.querySelectorAll('.game-card').length,
            href: card?.getAttribute('href') || '',
            play: card?.querySelector('.play')?.textContent || '',
            label: card?.getAttribute('aria-label') || '',
            neon: document.querySelectorAll('a[href="neon-arkanoid.html"]').length
          };
        });
        if (marked.cards !== 6) fail('hub-last-played', `hub should still show six games, saw ${marked.cards}`);
        if (marked.href !== 'turdspades.html') {
          fail('hub-last-played', `last opened game should be marked, saw ${marked.href}`);
        }
        if (!marked.play.includes('Continue')) {
          fail('hub-last-played', `an opened Spades table should say Continue, saw ${marked.play}`);
        }
        // The badge is hidden on phones; the label must still carry blurb + action + state.
        if (!marked.label.includes('bid tricks or Nil') || !marked.label.includes('Continue — in progress')) {
          fail('hub-last-played', `marked card needs a full accessible name, saw "${marked.label}"`);
        }
        if (marked.neon !== 1) fail('hub-last-played', 'last-played mark must not replace the Neon secondary link');
        const inProgress = await page.locator('.game-card.in-progress').count();
        if (inProgress !== 1) fail('hub-last-played', `expected one in-progress table, saw ${inProgress}`);

        await page.evaluate(() => localStorage.setItem('turdsuite_last_game', 'not-a-game.html'));
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(200);
        const afterJunk = await page.evaluate(() => ({
          cards: document.querySelectorAll('.game-card').length,
          last: document.querySelectorAll('.game-card.last-played').length,
          continuing: document.querySelector('.game-card.in-progress')?.getAttribute('href') || '',
          play: document.querySelector('.game-card.in-progress .play')?.textContent || '',
          hrefs: Array.from(document.querySelectorAll('.game-card')).map((card) => card.getAttribute('href'))
        }));
        if (afterJunk.cards !== 6 || afterJunk.last !== 0) {
          fail('hub-last-played', `malformed last-played data should not invent a mark, saw ${JSON.stringify(afterJunk)}`);
        }
        if (afterJunk.continuing !== 'turdspades.html' || !afterJunk.play.includes('Continue')) {
          fail('hub-last-played', `junk last-played data should not wipe a real table, saw ${JSON.stringify(afterJunk)}`);
        }
        const expected = ['TurdAnoid.html', 'turdtris.html', 'turdjack.html', 'crapeights.html', 'turdrummy.html', 'turdspades.html'];
        if (JSON.stringify(afterJunk.hrefs) !== JSON.stringify(expected)) {
          fail('hub-last-played', `six-game door drifted, saw ${JSON.stringify(afterJunk.hrefs)}`);
        }
      }
    });

    await runCheck(browser, 'turdanoid-local-debug-hook', 'TurdAnoid.html', {
      actions: async (page) => {
        const exposed = await page.evaluate(() => !!window.__turdanoid);
        if (!exposed) fail('turdanoid-local-debug-hook', 'localhost smoke should still expose the TurdAnoid test hook');
        if ((await page.locator('.suite-back-pill').count()) !== 1) {
          fail('turdanoid-local-debug-hook', 'TurdAnoid should now load the suite runtime so the hub pill and last-played mark work');
        }
      }
    });

    await runCheck(browser, 'table-continue-restore', 'turdspades.html', {
      actions: async (page) => {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(120);
        const before = await page.evaluate(() => ({
          round: state.round,
          phase: state.phase,
          scores: state.scores.slice(),
          you: state.hands[0].map((card) => card.id).sort().join(','),
          north: state.hands[2].length
        }));
        if (before.round < 1 || before.you === '') {
          fail('table-continue-restore', `Spades should deal a live table before leaving, saw ${JSON.stringify(before)}`);
        }
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(250);
        const after = await page.evaluate(() => ({
          guide: document.getElementById('guide')?.classList.contains('show'),
          round: state.round,
          phase: state.phase,
          scores: state.scores.slice(),
          you: state.hands[0].map((card) => card.id).sort().join(','),
          north: state.hands[2].length
        }));
        if (after.guide) fail('table-continue-restore', 'returning to a saved Spades table should skip the welcome guide');
        if (after.round !== before.round || after.phase !== before.phase || after.you !== before.you || after.north !== before.north) {
          fail('table-continue-restore', `Spades should restore the same table, saw ${JSON.stringify({ before, after })}`);
        }
        if (JSON.stringify(after.scores) !== JSON.stringify(before.scores)) {
          fail('table-continue-restore', `Spades should restore the same scores, saw ${JSON.stringify({ before, after })}`);
        }

        const played = await page.evaluate(() => {
          if (state.phase === 'bidding' && state.bidTurn === 0) {
            const beforeBid = state.bids[0];
            document.getElementById('lockBid')?.click();
            return { acted: 'bid', beforeBid, afterBid: state.bids[0], phase: state.phase };
          }
          if (state.phase === 'play' && state.currentPlayer === 0) {
            const legal = typeof legalCards === 'function' ? legalCards(0)[0] : null;
            if (!legal) return { acted: 'none' };
            state.selected = legal.id;
            playSelected();
            return { acted: 'play', remaining: state.hands[0].length };
          }
          return { acted: 'wait', phase: state.phase, turn: state.currentPlayer };
        });
        if (played.acted === 'bid' && played.afterBid === null) {
          fail('table-continue-restore', `restored Spades should accept a bid, saw ${JSON.stringify(played)}`);
        }
        if (played.acted === 'play' && !(played.remaining < before.you.split(',').filter(Boolean).length)) {
          fail('table-continue-restore', `restored Spades should play a card, saw ${JSON.stringify(played)}`);
        }
        if (played.acted === 'none') {
          fail('table-continue-restore', `restored Spades should have a legal card, saw ${JSON.stringify(played)}`);
        }

        await page.evaluate(() => { if (typeof clearAiTimer === 'function') clearAiTimer(); });
        await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
        await page.evaluate(() => {
          localStorage.setItem('turdsuite_continue_v1', JSON.stringify({
            v: 1,
            games: {
              'turdspades.html': {
                snapshot: { kind: 'turdspades', v: 1, msg: '<img src=x onerror=alert(1)>' }
              }
            }
          }));
        });
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(200);
        const dirtyHub = await page.evaluate(() => document.querySelectorAll('.game-card.in-progress').length);
        if (dirtyHub !== 0) fail('table-continue-restore', 'script-bearing continue data must not mark a hub card');
      }
    });

    await runCheck(browser, 'turdrummy-continue-restore', 'turdrummy.html', {
      actions: async (page) => {
        await page.evaluate(() => document.getElementById('startRoundBtn')?.click());
        await page.waitForFunction(() => (
          typeof state !== 'undefined'
          && state.initialized
          && state.turn === 'player'
          && state.playerHand.length === 10
        ), undefined, { timeout: 4000 });
        const before = await page.evaluate(() => ({
          round: state.round,
          phase: state.phase,
          turn: state.turn,
          cards: state.playerHand.map((card) => card.id).sort().join(','),
          stock: state.stock.length
        }));
        if (!before.round || before.cards === '' || before.turn !== 'player') {
          fail('turdrummy-continue-restore', `Rummy should wait on the player before leaving, saw ${JSON.stringify(before)}`);
        }
        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(() => (
          typeof state !== 'undefined'
          && state.initialized
          && state.playerHand.length === 10
          && !document.getElementById('guideOverlay')?.classList.contains('show')
        ), undefined, { timeout: 4000 });
        const after = await page.evaluate(() => ({
          guide: document.getElementById('guideOverlay')?.classList.contains('show'),
          initialized: state.initialized,
          round: state.round,
          phase: state.phase,
          turn: state.turn,
          cards: state.playerHand.map((card) => card.id).sort().join(','),
          stock: state.stock.length
        }));
        if (after.guide) {
          fail('turdrummy-continue-restore', 'returning to a saved Rummy table should skip the welcome guide');
        }
        if (!after.initialized || after.round !== before.round || after.cards !== before.cards || after.stock !== before.stock || after.turn !== before.turn) {
          fail('turdrummy-continue-restore', `Rummy should restore the same table, saw ${JSON.stringify({ before, after })}`);
        }
        if (after.phase === 'draw' && after.turn === 'player') {
          await page.locator('#drawStockBtn').click();
          await page.waitForFunction(() => state.phase === 'discard' && state.playerHand.length === 11, undefined, { timeout: 3000 });
        }
      }
    });

    await runCheck(browser, 'crapeights-continue-restore', 'crapeights.html', {
      actions: async (page) => {
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => (
          typeof isHumanTurn === 'function'
          && isHumanTurn()
          && Array.isArray(players)
          && players[0]
          && players[0].hand.length > 0
        ), undefined, { timeout: 5000 });
        const before = await page.evaluate(() => ({
          round: roundNumber,
          you: players[0].hand.map((card) => card.id).sort().join(','),
          discard: discard.map((card) => card.id).join(','),
          current: currentPlayer
        }));
        if (!before.round || before.you === '') {
          fail('crapeights-continue-restore', `Eights should deal before leaving, saw ${JSON.stringify(before)}`);
        }
        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction((expectedYou) => (
          Array.isArray(players)
          && players[0]
          && players[0].hand.map((card) => card.id).sort().join(',') === expectedYou
          && document.getElementById('welcomeGuide')?.style.display !== 'flex'
        ), before.you, { timeout: 4000 });
        const after = await page.evaluate(() => ({
          guide: document.getElementById('welcomeGuide')?.style.display === 'flex',
          round: roundNumber,
          you: players[0].hand.map((card) => card.id).sort().join(','),
          discard: discard.map((card) => card.id).join(','),
          current: currentPlayer
        }));
        if (after.guide) {
          fail('crapeights-continue-restore', 'returning to a saved Eights table should skip the welcome guide');
        }
        if (after.round !== before.round || after.you !== before.you || after.discard !== before.discard) {
          fail('crapeights-continue-restore', `Eights should restore the same table, saw ${JSON.stringify({ before, after })}`);
        }
        const canAct = await page.evaluate(() => ({
          human: typeof isHumanTurn === 'function' && isHumanTurn(),
          playable: typeof isPlayable === 'function' && players[0].hand.some((card) => isPlayable(card))
        }));
        if (!canAct.human) {
          fail('crapeights-continue-restore', `restored Eights should still be the human turn, saw ${JSON.stringify(canAct)}`);
        }
      }
    });

    await runCheck(browser, 'turdrummy-continue-no-round-skip', 'turdrummy.html', {
      actions: async (page) => {
        await page.evaluate(() => {
          localStorage.setItem('turdrummy_stats_v1', JSON.stringify({
            playerScore: 45,
            aiScore: 30,
            round: 3,
            stats: { roundsPlayed: 2, playerRoundWins: 1, aiRoundWins: 1, playerGins: 0, aiGins: 0, undercuts: 0 }
          }));
        });
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(220);
        await page.evaluate(() => document.getElementById('startRoundBtn')?.click());
        await page.waitForTimeout(220);
        const dealt = await page.evaluate(() => ({
          round: state.round,
          playerScore: state.playerScore,
          aiScore: state.aiScore,
          initialized: state.initialized,
          cards: state.playerHand.length
        }));
        if (dealt.round !== 1) {
          fail('turdrummy-continue-no-round-skip', `old score ghosts must not skip a round, saw ${JSON.stringify(dealt)}`);
        }
        if (dealt.playerScore !== 0 || dealt.aiScore !== 0) {
          fail('turdrummy-continue-no-round-skip', `old match scores without a table must not restore a zombie match, saw ${JSON.stringify(dealt)}`);
        }
        if (!dealt.initialized || dealt.cards !== 10) {
          fail('turdrummy-continue-no-round-skip', `starting after dropping a ghost save should deal a real round, saw ${JSON.stringify(dealt)}`);
        }
      }
    });

    await runCheck(browser, 'turdjack-continue-restore', 'turdjack.html', {
      actions: async (page) => {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(120);
        const before = await page.evaluate(() => {
          createShoe(4);
          const pull = (rank, suit) => {
            const index = shoe.findIndex((card) => card.rank === rank && card.suit === suit);
            return shoe.splice(index, 1)[0];
          };
          const hole = pull('K', 'S');
          const playerTwo = pull('9', 'D');
          const dealerUp = pull('5', 'H');
          const playerOne = pull('2', 'C');
          shoe = shoe.concat([hole, playerTwo, dealerUp, playerOne]);
          bankroll = 1000;
          currentBet = 20;
          lastBet = 20;
          startRound();
          const nextHit = pull('4', 'C');
          shoe.push(nextHit);
          persistTable();
          return {
            active: roundActive,
            you: playerHand.map((card) => card.rank + card.suit).join(','),
            dealerUp: dealerHand[0] ? dealerHand[0].rank + dealerHand[0].suit : '',
            holeHidden: dealerHoleHidden,
            count: runningCount,
            bankroll,
            storedBankroll: localStorage.getItem('turdjackBankroll')
          };
        });
        if (!before.active || before.you === '' || !before.holeHidden) {
          fail('turdjack-continue-restore', `Crapjack should deal a live hand before leaving, saw ${JSON.stringify(before)}`);
        }
        if (before.storedBankroll === '980') {
          fail('turdjack-continue-restore', 'mid-hand bankroll must not be written to lifetime storage');
        }
        await page.reload({ waitUntil: 'load' });
        await page.waitForFunction(() => (
          typeof roundActive !== 'undefined'
          && roundActive
          && playerHand.length === 2
          && document.getElementById('welcomeGuide')?.style.display !== 'flex'
        ), undefined, { timeout: 4000 });
        const after = await page.evaluate(() => ({
          guide: document.getElementById('welcomeGuide')?.style.display === 'flex',
          active: roundActive,
          you: playerHand.map((card) => card.rank + card.suit).join(','),
          dealerUp: dealerHand[0] ? dealerHand[0].rank + dealerHand[0].suit : '',
          holeHidden: dealerHoleHidden,
          count: runningCount,
          bankroll,
          hitDisabled: document.getElementById('hitBtn')?.disabled
        }));
        if (after.guide) fail('turdjack-continue-restore', 'returning to a live Crapjack hand should skip the welcome guide');
        if (!after.active || after.you !== before.you || after.dealerUp !== before.dealerUp || after.count !== before.count) {
          fail('turdjack-continue-restore', `Crapjack should restore the same live hand, saw ${JSON.stringify({ before, after })}`);
        }
        if (!after.holeHidden) {
          fail('turdjack-continue-restore', 'restored Crapjack must keep the dealer hole hidden');
        }
        if (after.hitDisabled) {
          fail('turdjack-continue-restore', 'restored Crapjack should let the player hit');
        }
        const staged = await page.evaluate(() => {
          const index = shoe.findIndex((card) => card.rank === '4');
          if (index >= 0) shoe.push(shoe.splice(index, 1)[0]);
          return {
            next: shoe[shoe.length - 1],
            value: typeof handValue === 'function' ? handValue(playerHand) : 0
          };
        });
        if (!staged.next || staged.next.rank !== '4' || staged.value !== 11) {
          fail('turdjack-continue-restore', `restored hand should stay live for a low hit, saw ${JSON.stringify(staged)}`);
        }
        await page.locator('#hitBtn').click();
        await page.waitForTimeout(150);
        const hitState = await page.evaluate(() => ({
          cards: playerHand.length,
          value: typeof handValue === 'function' ? handValue(playerHand) : 0,
          stillHidden: dealerHoleHidden,
          active: roundActive
        }));
        if (hitState.cards < 3 || hitState.value !== 15 || !hitState.active) {
          fail('turdjack-continue-restore', `Continue must be playable: hit should add a 4, saw ${JSON.stringify(hitState)}`);
        }
        if (!hitState.stillHidden) {
          fail('turdjack-continue-restore', 'hitting after Continue must not flash the dealer hole');
        }

        await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
        await page.waitForTimeout(200);
        const hub = await page.evaluate(() => ({
          cards: document.querySelectorAll('.game-card').length,
          href: document.querySelector('.game-card.in-progress')?.getAttribute('href') || '',
          play: document.querySelector('.game-card.in-progress .play')?.textContent || ''
        }));
        if (hub.cards !== 6 || hub.href !== 'turdjack.html' || !hub.play.includes('Continue')) {
          fail('turdjack-continue-restore', `hub should mark the live Crapjack hand Continue, saw ${JSON.stringify(hub)}`);
        }
      }
    });

    await runCheck(browser, 'hub-turdanoid-last-played', 'TurdAnoid.html', {
      actions: async (page) => {
        await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
        await page.waitForTimeout(220);
        const marked = await page.evaluate(() => {
          const card = document.querySelector('.game-card.last-played');
          return {
            href: card?.getAttribute('href') || '',
            play: card?.querySelector('.play')?.textContent || '',
            continuing: document.querySelectorAll('.game-card.in-progress').length,
            cards: document.querySelectorAll('.game-card').length
          };
        });
        if (marked.cards !== 6 || marked.href !== 'TurdAnoid.html') {
          fail('hub-turdanoid-last-played', `TurdAnoid should record last-played now that it loads the suite, saw ${JSON.stringify(marked)}`);
        }
        if (!marked.play.includes('Play again')) {
          fail('hub-turdanoid-last-played', `arcade last-played should stay Play again, saw ${marked.play}`);
        }
        if (marked.continuing !== 0) {
          fail('hub-turdanoid-last-played', 'TurdAnoid must not invent a mid-run continue');
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
