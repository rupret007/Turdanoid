// @vitest-environment node
/* global getComputedStyle, currentBet */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, webkit } from 'playwright';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { URL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const engines = Object.entries({ chromium, webkit });
let server, origin;
beforeAll(async () => {
  if (!engines.some(([, engine]) => existsSync(engine.executablePath()))) { return; }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  server = createServer(async (request, response) => {
    const file = resolve(root, `.${new URL(request.url, 'http://localhost').pathname}`);
    if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    try { response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(await readFile(file)); }
    catch { response.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => { if (server) { await new Promise(done => server.close(done)); } });

describe('Crapjack visible betting denominations', () => {
  for (const [name, engine] of engines) {
    for (const [width, height] of [[390, 844], [568, 320], [844, 390], [1280, 620]]) {
      it.skipIf(!existsSync(engine.executablePath()))(`${name} shows chip values at ${width}x${height} and bets the labeled amount`, async () => {
        const browser = await engine.launch();
        try {
          const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 1000, reducedMotion: 'reduce' });
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.addInitScript(() => localStorage.setItem('turdsuite_muted', '1'));
          await page.goto(origin + '/turdjack.html');
          await page.waitForFunction(() => globalThis.SuiteLoading?.state === 'ready');
          // Close the guide without automatically dealing a random opening hand.
          await page.locator('#closeGuideBtn').click();
          const labels = await page.locator('.chip-btn[data-chip]').evaluateAll(buttons => buttons
            .filter(button => button.checkVisibility())
            .map(button => {
              const style = getComputedStyle(button), box = button.getBoundingClientRect();
              const range = document.createRange(); range.selectNodeContents(button);
              return { amount: button.dataset.chip, text: button.textContent, font: parseFloat(style.fontSize), color: style.color,
                box: box.toJSON(), textBox: range.getBoundingClientRect().toJSON() };
            }));
          expect(new Set(labels.map(label => label.amount))).toEqual(new Set(['10', '25', '50', '100']));
          for (const label of labels) {
            expect(label.text).toContain(`$${label.amount}`);
            expect(label.font, `visible $${label.amount} text`).toBeGreaterThanOrEqual(11);
            expect(label.color).not.toMatch(/transparent|rgba\([^)]*,\s*0\)/);
            expect(label.textBox.width).toBeGreaterThan(10);
            expect(label.textBox.height).toBeGreaterThan(8);
            expect(label.textBox.left).toBeGreaterThanOrEqual(label.box.left);
            expect(label.textBox.right).toBeLessThanOrEqual(label.box.right);
          }
          const before = await page.evaluate(() => currentBet);
          await page.locator('.chip-btn[data-chip="10"]:visible').first().click();
          expect(await page.evaluate(() => currentBet)).toBe(before + 10);
          await page.locator('.chip-btn[data-chip="25"]:visible').first().click();
          expect(await page.evaluate(() => currentBet)).toBe(before + 35);
          expect(errors).toEqual([]);
        } finally { await browser.close(); }
      }, 20000);
    }
  }
});
