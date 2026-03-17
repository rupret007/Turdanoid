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
