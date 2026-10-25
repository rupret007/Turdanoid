// @vitest-environment node
/* global state, getComputedStyle */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, webkit } from 'playwright';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engines = Object.entries({ chromium, webkit });
let server;
let origin;

beforeAll(async () => {
  if (!engines.some(([, type]) => existsSync(type.executablePath()))) { return; }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  server = createServer(async (request, response) => {
    const file = resolve(root, `.${new URL(request.url, 'http://localhost').pathname}`);
    if (!file.startsWith(root + sep)) { return response.writeHead(403).end(); }
    try {
      response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  if (server) { await new Promise(done => server.close(done)); }
});

async function bidVisibility(page) {
  return page.evaluate(() => {
    const bubble = document.querySelector('.ts-bubble');
    const style = getComputedStyle(bubble);
    const decoration = style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0
      ? bubble.getBoundingClientRect() : null;
    const overlap = rect => !decoration ? 0
      : Math.max(0, Math.min(rect.right, decoration.right) - Math.max(rect.left, decoration.left))
        * Math.max(0, Math.min(rect.bottom, decoration.bottom) - Math.max(rect.top, decoration.top));
    return [...document.querySelectorAll('#bidDown,#bidUp,#bidNil,#lockBid,#bidChips button')]
      .filter(button => button.checkVisibility() && !button.disabled)
      .map(button => {
        const rect = button.getBoundingClientRect();
        const label = document.createRange();
        label.selectNodeContents(button);
        return { id: button.id || button.dataset.bid, width: rect.width, height: rect.height, overlap: overlap(rect), labelOverlap: overlap(label.getBoundingClientRect()) };
      });
  });
}

describe('Spades bid decision visibility during native partner banter', () => {
  for (const [engine, type] of engines) {
    for (const width of [1024, 1280]) {
      it.skipIf(!existsSync(type.executablePath()))(`${engine} keeps all bid labels clear at ${width}px and preserves Lock/play`, async () => {
        const browser = await type.launch();
        const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'no-preference' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto(`${origin}/turdspades.html`);
          await page.locator('#quickStart').click();
          await page.waitForFunction(() => document.body.dataset.turn === 'bid');
          // The actual intro starts after700ms and lasts2600ms. Keep normal
          // motion/timers; inspect its opaque interval rather than suppressing it.
          await page.waitForFunction(() => document.querySelector('.ts-bubble')?.classList.contains('show'));
          for (const delay of [300, 800, 800]) {
            await page.waitForTimeout(delay);
            const controls = await bidVisibility(page);
            expect(controls.length).toBeGreaterThanOrEqual(4);
            for (const control of controls) {
              expect(control.width, control.id).toBeGreaterThanOrEqual(44);
              expect(control.height, control.id).toBeGreaterThanOrEqual(44);
              expect(control.overlap, `${control.id} complete target`).toBe(0);
              expect(control.labelOverlap, `${control.id} visible label`).toBe(0);
            }
          }
          await page.locator('[data-bid="4"]').click();
          expect(await page.locator('#bidV').textContent()).toBe('4');
          await page.locator('#lockBid').click();
          expect(await page.evaluate(() => getComputedStyle(document.querySelector('.ts-bubble')).display)).not.toBe('none');
          await page.waitForFunction(() => state.phase === 'play' && state.currentPlayer === 0);
          const count = await page.locator('#youCards .card').count();
          await page.locator('#youCards .card:not([disabled])').first().click();
          await page.locator('#playBtn').click();
          expect(await page.locator('#youCards .card').count()).toBe(count - 1);
          expect(errors).toEqual([]);
        } finally { await browser.close(); }
      }, 20000);
    }
  }
});
