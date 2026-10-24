// @vitest-environment node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const available = existsSync(chromium.executablePath());
let server, browser, origin;
beforeAll(async () => {
  if (!available) {return;}
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root.replace(/\/$/, '') + sep)) {response.writeHead(403).end(); return;}
    try {
      response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
    } catch {response.writeHead(404).end();}
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  if (server) {await new Promise(done => server.close(done));}
});

describe.skipIf(!available)('recoverable game startup', () => {
  for (const file of ['TurdAnoid', 'turdtris', 'turdomania', 'turdjack', 'crapeights', 'turdrummy', 'turdspades']) {
    it(`${file}: a stalled script offers a keyboard-usable exit, then retires when ready`, async () => {
      const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
      let release;
      const held = new Promise(done => { release = done; });
      await page.route('**/assets/turdsuite.js', async route => { await held; await route.continue(); });
      try {
        await page.clock.install();
        await page.goto(`${origin}/${file}.html`, { waitUntil: 'commit' });
        await page.waitForFunction(() => !!window.SuiteLoading, null, { polling: 100 });
        await page.clock.fastForward(13000);
        const recovery = page.locator('#suite-load-state');
        expect(await recovery.isVisible()).toBe(true);
        expect(await recovery.locator('button').evaluate(el => document.activeElement === el)).toBe(true);
        await page.keyboard.press('Tab');
        expect(await recovery.locator('a').evaluate(el => document.activeElement === el)).toBe(true);
        expect(await recovery.locator('a').getAttribute('href')).toBe('./');
        await page.keyboard.press('Tab');
        // Native dialog focus wraps, including browser chrome on some engines.
        // One further Tab must return to a recovery control, never a game action.
        if (!await recovery.evaluate(el => el.contains(document.activeElement))) {await page.keyboard.press('Tab');}
        expect(await recovery.evaluate(el => el.contains(document.activeElement))).toBe(true);
        release();
        await page.waitForLoadState('load');
        await page.waitForFunction(() => window.SuiteLoading.state === 'ready');
        expect(await recovery.count()).toBe(0);
      } finally {
        release();
        await page.unrouteAll({ behavior: 'wait' });
        await page.close();
      }
    });
  }

  it('retries a failed required module with the same URL and preserved records', async () => {
    const page = await browser.newPage();
    let broken = true;
    await page.route('**/games/turdtris-modes.js', route => broken ? route.abort() : route.continue());
    try {
      await page.goto(`${origin}/turdtris.html?mode=sprint#arcade`);
      await page.waitForFunction(() => window.SuiteLoading.state === 'failed');
      await page.evaluate(() => localStorage.setItem('turdtrisHighScore', '123'));
      const before = page.url();
      broken = false;
      await page.locator('#suite-load-state button').click();
      await page.waitForFunction(() => window.SuiteLoading.state === 'ready');
      expect(page.url()).toBe(before);
      expect(await page.evaluate(() => localStorage.getItem('turdtrisHighScore'))).toBe('123');
      expect(await page.locator('#attractPlay').isEnabled()).toBe(true);
      await page.locator('#attractPlay').click();
      expect(await page.locator('#welcomeGuide').isVisible()).toBe(false);
    } finally {await page.close();}
  });

  it('Escape from failed loading returns to the actual arcade hub', async () => {
    const page = await browser.newPage();
    try {
      await page.route('**/games/turdomania-core.js', route => route.abort());
      await page.goto(`${origin}/turdomania.html`);
      await page.waitForFunction(() => window.SuiteLoading.state === 'failed');
      await page.keyboard.press('Escape');
      await page.waitForURL(origin + '/');
      expect(await page.locator('h1').textContent()).toBe('Stalemate Arcade');
    } finally {await page.close();}
  });
});
