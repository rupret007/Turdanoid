const { chromium, devices } = require('playwright');

const baseUrl = process.argv[2] || 'http://127.0.0.1:8123';
const browserChannel = process.env.PLAYWRIGHT_CHANNEL || 'msedge';
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
    return await chromium.launch({ channel: browserChannel, headless: true });
  } catch (err) {
    const channelDetail = browserChannel ? `channel "${browserChannel}"` : 'default browser';
    throw new Error(`Could not launch ${channelDetail}: ${err.message}`);
  }
}

async function main() {
  const browser = await launchBrowser();
  try {
    await runCheck(browser, 'hub', 'hub.html', {
      assert: async (page) => {
        const cards = await page.locator('.game-card').count();
        if (cards !== 6) fail('hub', `expected 6 game cards, saw ${cards}`);
      }
    });

    await runCheck(browser, 'index-guide-and-blur', 'index.html', {
      actions: async (page) => {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
        const legacyGuideState = await page.evaluate(() => ({
          guideOpen: document.getElementById('howToPlay')?.style.display !== 'none',
          awaitingLaunch: window.gameInstance.awaitingLaunch,
          paused: window.gameInstance.paused
        }));
        if (legacyGuideState.guideOpen) fail('index-guide-and-blur', 'Enter should dismiss the opening guide');
        if (!legacyGuideState.awaitingLaunch) fail('index-guide-and-blur', 'Enter should not launch the ball behind the guide');
        if (legacyGuideState.paused) fail('index-guide-and-blur', 'Guide dismissal should not leave a fresh game paused');

        const legacyBlurState = await page.evaluate(() => {
          window.gameInstance.controls.left = true;
          window.gameInstance.controls.right = true;
          window.gameInstance.controls.pointerActive = true;
          window.dispatchEvent(new Event('blur'));
          return {
            paused: window.gameInstance.paused,
            left: window.gameInstance.controls.left,
            right: window.gameInstance.controls.right,
            pointerActive: window.gameInstance.controls.pointerActive
          };
        });
        if (!legacyBlurState.paused) fail('index-guide-and-blur', 'blur should pause the legacy breakout shell');
        if (legacyBlurState.left || legacyBlurState.right || legacyBlurState.pointerActive) {
          fail('index-guide-and-blur', 'blur should clear held legacy breakout inputs');
        }
      }
    });

    await runCheck(browser, 'turdanoid-mobile', 'TurdAnoid.html', {
      mobile: true,
      actions: async (page) => {
        await page.getByRole('button', { name: 'Review Then Start' }).click();
        const canvas = page.locator('canvas');
        if (!(await canvas.isVisible())) fail('turdanoid-mobile', 'canvas not visible after guide close');
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

    await runCheck(browser, 'turdspades-mobile', 'turdspades.html', {
      mobile: true,
      actions: async (page) => {
        await page.locator('#quickStart').click();
        await page.waitForTimeout(250);
        const bidBox = page.locator('#bidBox');
        if (!(await bidBox.isVisible())) fail('turdspades-mobile', 'bid controls not visible after guide close');
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
