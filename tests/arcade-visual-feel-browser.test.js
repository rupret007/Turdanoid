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
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.m4a': 'audio/mp4', '.wasm': 'application/wasm' };
  server = createServer(async (request, response) => {
    const file = resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
    if (!file.startsWith(root.replace(/\/$/, '') + sep)) {response.writeHead(403).end(); return;}
    try {response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(await readFile(file));}
    catch {response.writeHead(404).end();}
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  if (server) {await new Promise(done => server.close(done));}
});

describe.skipIf(!available)('arcade playfield and primary-action geometry', () => {
  it('Turdomania enlarges the same active puzzle on desktop and keeps progress through rotation', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    try {
      await page.goto(`${origin}/turdomania.html?level=normal&seed=42`);
      await page.waitForFunction(() => window.__turdomania);
      const before = await page.evaluate(() => JSON.stringify(window.__turdomania.state));
      for (const [width, height] of [[1280,720], [1440,1000], [1024,1366], [390,844], [844,390], [1280,720]]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(100);
        const geometry = await page.evaluate(() => {
          const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
          return { board: rect('#boardWrap'), hud: rect('header.hud'), dock: rect('.dock'), cell: parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--cell')), bottom: window.innerHeight - (document.getElementById('suite-music-status')?.getBoundingClientRect().height || 0) };
        });
        expect(await page.evaluate(() => JSON.stringify(window.__turdomania.state))).toBe(before);
        expect(geometry.board.left).toBeGreaterThanOrEqual(0);
        expect(geometry.board.right).toBeLessThanOrEqual(width);
        expect(geometry.board.bottom).toBeLessThanOrEqual(geometry.bottom + 1);
        expect(geometry.dock.bottom).toBeLessThanOrEqual(geometry.bottom + 1);
        if (width > 980) {
          expect(geometry.cell).toBeGreaterThanOrEqual(48);
          expect(geometry.hud.left).toBeGreaterThan(geometry.board.right);
        }
      }
      const group = await page.evaluate(() => {
        const { state, Core } = window.__turdomania;
        for (let c = 0; c < state.cols; c++) {for (let r = 0; r < state.rows; r++) {
          const found = Core.findGroup(state.board, c, r);
          if (found.length >= 3) {return { c, r, count: found.length, points: Core.scoreForGroup(found.length) };}
        }}
      });
      await page.locator(`.tile[data-col="${group.c}"][data-row="${group.r}"]`).hover();
      await expect.poll(() => page.locator('#tagline').textContent()).toBe(`${group.count} matching tiles · ${group.points} points`);
    } finally {await page.close();}
  });

  for (const [game, start, actions] of [
    ['turdjack', '#quickGuideBtn', '.table-pit-rail .pit-primary button'],
    ['crapeights', '#quickStartBtn', '.action-dock button']
  ]) {
    it(`${game}: tall desktop and tablet keep primary decisions inside the usable window`, async () => {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      try {
        for (const [width, height] of [[1440,1000], [1024,1366], [1280,720]]) {
          await page.setViewportSize({ width, height });
          await page.goto(`${origin}/${game}.html`);
          if (await page.locator(start).isVisible()) {await page.locator(start).click();}
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(150);
          const boxes = await page.locator(actions).evaluateAll(elements => elements.filter(e => e.checkVisibility()).map(e => ({ rect: e.getBoundingClientRect().toJSON(), disabled: e.disabled })));
          expect(boxes.length).toBeGreaterThan(2);
          const bottom = await page.evaluate(() => window.innerHeight - (document.getElementById('suite-music-status')?.getBoundingClientRect().height || 0));
          for (const { rect } of boxes) {
            expect(rect.height).toBeGreaterThanOrEqual(44);
            expect(rect.top).toBeGreaterThanOrEqual(0);
            expect(rect.bottom).toBeLessThanOrEqual(bottom + 1);
          }
          if (game === 'turdjack' && height > 920) {
            const betting = await page.locator('.table-bet-zone').evaluate(e => {
              const rect = e.getBoundingClientRect(), stage = e.closest('.table-stage').getBoundingClientRect();
              return { bottom: rect.bottom, top: rect.top, stageTop: stage.top, stageBottom: stage.bottom };
            });
            expect(betting.top).toBeGreaterThanOrEqual(betting.stageTop);
            expect(betting.bottom).toBeLessThanOrEqual(betting.stageBottom + 1);
          }
        }
      } finally {await page.close();}
    });
  }
});
