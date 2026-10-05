// @vitest-environment node
/* global state, clearAiTimer, closeGuide, render, scoreRound */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactDirectory = resolve(root, 'conductor/reviews/turdanoid-1000x/r5/turdspades');
const viewports = [
  { width: 390, height: 844 },
  { width: 360, height: 780 },
  { width: 320, height: 640 },
  { width: 1280, height: 800 }
];
let server;
let browser;
let baseUrl;

beforeAll(async () => {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
  server = createServer(async (request, response) => {
    const path = resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
    if (!path.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(path);
      response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium', headless: true });
  if (process.env.TURDSPADES_SCREENSHOTS === '1') {
    await mkdir(artifactDirectory, { recursive: true });
  }
}, 30000);

afterAll(async () => {
  await browser?.close();
  if (server) {
    await new Promise((resolveServer, reject) => server.close((error) => error ? reject(error) : resolveServer()));
  }
});

async function capture(page, viewport, phase) {
  if (process.env.TURDSPADES_SCREENSHOTS === '1') {
    await page.screenshot({
      path: resolve(artifactDirectory, `${viewport.width}x${viewport.height}-${phase}.png`),
      fullPage: true,
      animations: 'disabled'
    });
  }
}

async function verifyGeometry(page, viewport, phase) {
  const layout = await page.evaluate(() => {
    const visible = (node) => {
      if (!node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
        return false;
      }
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    };
    const box = (node) => {
      const rect = node.getBoundingClientRect();
      return {
        name: node.id || node.dataset.id || node.dataset.seat || node.textContent.trim().slice(0, 40),
        hand: node.matches('#youCards .card'),
        trick: node.matches('#trickPile .entry[data-seat]'),
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height
      };
    };
    const nodes = [...document.querySelectorAll('button, a, select, #trickPile .entry[data-seat]')].filter(visible);
    const rects = nodes.map(box);
    const overlaps = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        // The hand deliberately overlaps. Its exposed touch strips are checked separately.
        if (a.hand && b.hand) {
          continue;
        }
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) {
          overlaps.push(`${a.name} / ${b.name}`);
        }
      }
    }
    const clipped = rects.filter((r) => r.left < -0.5 || r.right > window.innerWidth + 0.5 ||
      r.top < -0.5 || r.bottom > window.innerHeight + 0.5);
    const mascot = document.querySelector('.ts-boss');
    return {
      width: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
      height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
      clipped, overlaps, rects,
      mascotVisible: !!mascot && visible(mascot)
    };
  });
  expect(layout.width, `${phase}: horizontal page overflow`).toBeLessThanOrEqual(viewport.width);
  expect(layout.clipped, `${phase}: cards and controls outside viewport`).toEqual([]);
  if (viewport.width <= 920) {
    expect(layout.height, `${phase}: table must fit above the dock`).toBeLessThanOrEqual(viewport.height);
    expect(layout.overlaps, `${phase}: controls/trick cards collide`).toEqual([]);
  }
  if (viewport.width <= 390) {
    expect(layout.mascotVisible, `${phase}: mascot must not obscure phone controls`).toBe(false);
  }
  for (const card of layout.rects.filter((r) => r.hand)) {
    expect(card.height, `${phase}: ${card.name} is too short to tap`).toBeGreaterThanOrEqual(44);
  }
}

async function verifyHandIndexRegions(page, phase, selectedId = null) {
  const result = await page.evaluate(({ selected, phase }) => {
    const IW = 18;
    const IH = 28;
    const LIFT = 6;
    const cards = [...document.querySelectorAll('#youCards .card')];
    const rects = cards.map((card, index) => {
      const box = card.getBoundingClientRect();
      const parent = document.getElementById('youCards').getBoundingClientRect();
      return {
        id: card.dataset.id,
        index,
        left: box.left - parent.left,
        top: box.top - parent.top,
        width: box.width,
        height: box.height,
        z: parseInt(card.style.zIndex, 10) || index + 1,
        selected: card.classList.contains('selected')
      };
    });
    const selectedIndex = selected
      ? rects.findIndex((card) => card.id === selected)
      : rects.findIndex((card) => card.selected);
    const liftFor = (index) => (selectedIndex === index ? LIFT : 0);
    for (let i = 0; i < rects.length; i++) {
      const card = rects[i];
      const idx = {
        left: card.left,
        top: card.top - liftFor(i),
        right: card.left + IW,
        bottom: card.top - liftFor(i) + IH
      };
      for (let j = 0; j < rects.length; j++) {
        if (i === j) { continue; }
        const other = rects[j];
        if (other.z <= card.z) { continue; }
        const body = {
          left: other.left,
          top: other.top - liftFor(j),
          right: other.left + other.width,
          bottom: other.top - liftFor(j) + other.height
        };
        const overlapX = Math.min(idx.right, body.right) - Math.max(idx.left, body.left);
        const overlapY = Math.min(idx.bottom, body.bottom) - Math.max(idx.top, body.top);
        if (overlapX > 0.5 && overlapY > 0.5) {
          return { ok: false, card: card.id, by: other.id, phase };
        }
      }
      if (selectedIndex < 0) {
        const screen = cards[i].getBoundingClientRect();
        for (let dx = 4; dx < IW - 2; dx += 5) {
          for (let dy = 4; dy < IH - 2; dy += 5) {
            const hit = document.elementFromPoint(screen.left + dx, screen.top + dy)?.closest('#youCards .card');
            if (hit && hit !== cards[i]) {
              return { ok: false, card: card.id, by: hit.dataset.id, phase, via: 'elementFromPoint' };
            }
          }
        }
      }
    }
    const dock = document.querySelector('.dock').getBoundingClientRect();
    const handBottom = Math.max(...cards.map((card) => card.getBoundingClientRect().bottom));
    if (handBottom > dock.top - 2) {
      return { ok: false, phase, dockOverlap: handBottom - dock.top };
    }
    return { ok: true };
  }, { selected: selectedId, phase });
  expect(result.ok, `${phase}: hand index layout ${JSON.stringify(result)}`).toBe(true);
}

async function handHitStrips(page) {
  return page.evaluate(() => [...document.querySelectorAll('#youCards .card:not(:disabled)')].map((card) => {
    const rect = card.getBoundingClientRect();
    let best = { height: 0, x: 0, y: 0 };
    // Check actual hit testing, including transformed fan cards and overlapping rows.
    for (let x = Math.ceil(rect.left + 2); x < rect.right - 2; x += 3) {
      let runStart = null;
      for (let y = Math.ceil(rect.top + 1); y <= rect.bottom - 1; y++) {
        const hit = document.elementFromPoint(x, y)?.closest('#youCards .card') === card;
        if (hit && runStart === null) {
          runStart = y;
        }
        if (!hit || y + 1 > rect.bottom - 1) {
          if (runStart !== null && y - runStart > best.height) {
            best = { height: y - runStart, x, y: (runStart + y) / 2 };
          }
          runStart = null;
        }
      }
    }
    return { id: card.dataset.id, top: rect.top, ...best };
  }));
}

describe.sequential('TurdSpades table browser geometry', () => {
  for (const viewport of viewports) {
    it(`keeps bids, a complete trick, the full fan and receipt usable at ${viewport.width}×${viewport.height}`, async () => {
      const context = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      });
      try {
        await page.clock.install({ time: new Date('2026-10-05T12:00:00Z') });
        await page.clock.pauseAt(new Date('2026-10-05T12:00:01Z'));
        await page.goto(`${baseUrl}/turdspades.html`);
        await page.waitForFunction(() => typeof window.__tsAfterRender === 'function');
        if (viewport.width <= 920) {
          await page.waitForFunction(() => typeof window.__tsPhoneHand === 'function');
        }
        await page.evaluate(() => {
          closeGuide();
          clearAiTimer();
          const deck = ['C', 'D', 'H', 'S'].flatMap((suit) =>
            Array.from({ length: 13 }, (_, i) => ({ id: `${suit}-${i + 2}`, suit, rank: i + 2 })));
          const ordered = deck.map((_, i) => deck[(i * 17) % 52]);
          Object.assign(state, {
            round: 4, phase: 'bidding', bidTurn: 0, bidChoice: 4,
            scores: [121, 103], bags: [2, 3], bids: [null, 3, 3, 3],
            tricks: [0, 0, 0, 0], trick: [], selected: null,
            hands: Array.from({ length: 4 }, (_, p) => ordered.slice(p * 13, (p + 1) * 13)),
            msg: 'Choose your bid. North has your back.', summary: '', playedThisRound: []
          });
          render();
        });
        await page.clock.runFor(5000);
        await capture(page, viewport, 'bidding');
        await verifyGeometry(page, viewport, 'bidding');
        expect(await page.locator('#youCards .card').count()).toBe(13);
        if (viewport.width <= 920) {
          await verifyHandIndexRegions(page, 'bidding');
          const initialStrips = await handHitStrips(page);
          expect(initialStrips).toHaveLength(13);
          for (const strip of initialStrips) {
            expect(strip.height, `bidding: ${strip.id} lacks an exposed 44px touch strip`).toBeGreaterThanOrEqual(44);
          }
        }

        await page.evaluate(() => {
          clearAiTimer();
          state.phase = 'play';
          state.bids[0] = 4;
          state.currentPlayer = 0;
          state.spadesBroken = true;
          state.msg = 'Your turn. Follow the lead suit.';
          // Freeze all four seat positions before collection to test the fullest trick well.
          state.trick = [1, 2, 3, 0].map((player) => ({ player, card: state.hands[player].pop() }));
          render();
        });
        await page.clock.runFor(1000);
        await verifyGeometry(page, viewport, 'mid-trick');
        expect(await page.locator('#trickPile .entry[data-seat]').count()).toBe(4);
        if (viewport.width <= 920) {
          await verifyHandIndexRegions(page, 'mid-trick');
          const legalStrips = await handHitStrips(page);
          expect(legalStrips.length).toBeGreaterThan(0);
          for (const strip of legalStrips) {
            expect(strip.height, `play: ${strip.id} lacks an exposed 44px touch strip`).toBeGreaterThanOrEqual(44);
          }
          const target = legalStrips[0];
          await page.mouse.click(target.x, target.y);
          await page.mouse.move(0, 0);
          await page.clock.runFor(300);
          const selected = page.locator('#youCards .card.selected');
          expect(await selected.getAttribute('data-id')).toBe(target.id);
          expect((await selected.boundingBox()).y, 'selection should lift the tapped card').toBeLessThan(target.top);
          await verifyHandIndexRegions(page, 'selected card', target.id);
          expect(await page.locator('#playBtn').isEnabled()).toBe(true);
        } else {
          await page.locator('#youCards .card:not([disabled])').first().click();
          await page.clock.runFor(300);
          expect(await page.locator('#playBtn').isEnabled()).toBe(true);
        }
        await verifyGeometry(page, viewport, 'selected card');
        await capture(page, viewport, 'mid-trick');

        await page.evaluate(() => {
          clearAiTimer();
          state.bids = [3, 3, 3, 3];
          state.tricks = [4, 3, 3, 3];
          state.trick = [];
          state.hands = [[], [], [], []];
          state.selected = null;
          scoreRound('North takes the final trick with A♠.');
          render();
        });
        await page.clock.runFor(400);
        expect(await page.locator('#tsReceiptOverlay').evaluate((node) => node.classList.contains('show'))).toBe(true);
        expect(await page.locator('.ts-receipt-lines').textContent()).toContain('made contract');
        const receipt = await page.locator('.ts-receipt-card').boundingBox();
        expect(receipt.x).toBeGreaterThanOrEqual(0);
        expect(receipt.y).toBeGreaterThanOrEqual(0);
        expect(receipt.x + receipt.width).toBeLessThanOrEqual(viewport.width);
        expect(receipt.y + receipt.height).toBeLessThanOrEqual(viewport.height);
        const receiptOverflow = await page.locator('.ts-receipt-card').evaluate((node) => node.scrollWidth > node.clientWidth);
        expect(receiptOverflow, 'receipt text must wrap within the card').toBe(false);
        await capture(page, viewport, 'round-end');
        await verifyGeometry(page, viewport, 'round-end');
        await page.clock.runFor(3000);
        expect(await page.locator('#nextRoundDock').isEnabled()).toBe(true);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    }, 30000);
  }
});
