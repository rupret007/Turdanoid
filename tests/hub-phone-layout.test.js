// @vitest-environment node
/* global getComputedStyle */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import {
  validEightsSnapshot,
  validJackSnapshot,
  validRummySnapshot,
  validSpadesSnapshot
} from './continue-fixtures.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hasBrowser = Boolean(process.env.PLAYWRIGHT_CHANNEL) || existsSync(chromium.executablePath());

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

const PORTRAIT = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 }
];
const LANDSCAPE = [
  { width: 568, height: 320 },
  { width: 667, height: 375 },
  { width: 844, height: 390 }
];

let server;
let baseUrl;
let browser;

beforeAll(async () => {
  if (!hasBrowser) {
    return;
  }
  server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(`${root}${sep}`)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(path);
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
    headless: true
  });
}, 30_000);

afterAll(async () => {
  await browser?.close();
  if (server) {
    await new Promise((done, err) => server.close((e) => (e ? err(e) : done())));
  }
});

async function openHub(page, returning = false) {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
  if (returning) {
    await page.evaluate(
      (games) => {
        localStorage.setItem('turdsuite_continue_v1', JSON.stringify({ v: 1, games }));
        localStorage.setItem('turdsuite_last_game', 'TurdAnoid.html');
      },
      {
        'turdjack.html': { snapshot: validJackSnapshot() },
        'crapeights.html': { snapshot: validEightsSnapshot() },
        'turdrummy.html': { snapshot: validRummySnapshot() },
        'turdspades.html': { snapshot: validSpadesSnapshot() }
      }
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  await page.waitForSelector('.game-card');
}

function measureHub(firstScreen) {
  const box = (node) => {
    const { left, right, top, bottom, width, height } = node.getBoundingClientRect();
    return { left, right, top, bottom, width, height };
  };
  const overlap = (a, b) =>
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  const cards = [...document.querySelectorAll('.game-card')].map((card) => ({
    name: card.querySelector('h2').textContent.trim(),
    href: card.getAttribute('href'),
    rect: box(card),
    title: box(card.querySelector('h2')),
    description: box(card.querySelector('p')),
    action: box(card.querySelector('.play'))
  }));
  const mute = document.getElementById('suite-hub-mute');
  const muteBox = mute ? box(mute) : null;
  const overlaps = [];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (overlap(cards[i].rect, cards[j].rect)) {
        overlaps.push(`${cards[i].name} / ${cards[j].name}`);
      }
    }
    if (muteBox && overlap(cards[i].rect, muteBox)) {
      overlaps.push(`${cards[i].name} / mute`);
    }
  }
  const clipped = cards.filter(
    (card) => card.rect.left < -0.5 || card.rect.right > window.innerWidth + 0.5
  );
  const offFirst = firstScreen
    ? cards.filter((card) => card.rect.top < -0.5 || card.rect.bottom > window.innerHeight + 0.5)
    : [];
  const actionOverlap = cards.filter(
    (card) =>
      card.title.left < card.action.right &&
      card.title.right > card.action.left &&
      card.title.top < card.action.bottom &&
      card.title.bottom > card.action.top
  );
  return {
    scrollWidth: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    cards,
    overlaps,
    clipped: clipped.map((card) => card.name),
    offFirst: offFirst.map((card) => card.name),
    actionOverlap: actionOverlap.map((card) => card.name),
    mute: mute
      ? {
        tabIndex: mute.tabIndex,
        label: mute.getAttribute('aria-label'),
        height: muteBox.height,
        width: muteBox.width
      }
      : null
  };
}

function resumeEdges() {
  const edge = (el) => {
    const before = getComputedStyle(el, '::before');
    const width = parseFloat(before.width);
    const height = parseFloat(before.height);
    return {
      visible:
        before.content !== 'none' &&
        before.display !== 'none' &&
        before.visibility === 'visible' &&
        Number(before.opacity) === 1 &&
        Math.abs(width - 4) < 0.5 &&
        height >= 44,
      color: before.backgroundColor,
      border: getComputedStyle(el).borderLeftWidth,
      width,
      height,
      content: before.content,
      display: before.display,
      visibility: before.visibility,
      opacity: before.opacity
    };
  };
  const probe = document.createElement('span');
  document.body.append(probe);
  const color = (token) => {
    probe.style.color = `var(${token})`;
    return getComputedStyle(probe).color;
  };
  const gold = color('--gold');
  const accent = color('--accent');
  probe.remove();
  return [...document.querySelectorAll('.game-card')].map((card) => ({
    name: card.querySelector('h2').textContent.trim(),
    marked: card.matches('.in-progress, .last-played'),
    expectedColor: card.matches('.in-progress') ? accent : gold,
    ...edge(card)
  }));
}

(hasBrowser ? describe.sequential : describe.skip)('hub phone first-screen layout', () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 414, height: 896 }]) {
    for (const returning of [false, true]) {
      it(`centers the ${returning ? 'returning' : 'new'} player hub at ${viewport.width}×${viewport.height}`, async () => {
        const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
        try {
          await openHub(page, returning);
          const shell = await page.locator('.shell').boundingBox();
          const topSpace = shell.y;
          const bottomSpace = viewport.height - shell.y - shell.height;
          expect(topSpace).toBeGreaterThan(10);
          expect(bottomSpace).toBeGreaterThan(10);
          expect(Math.abs(topSpace - bottomSpace), 'balanced space above and below the hub').toBeLessThanOrEqual(2);
          const layout = await page.evaluate(measureHub, true);
          expect(layout.cards).toHaveLength(6);
          expect(layout.offFirst).toEqual([]);
          expect(layout.scrollWidth).toBeLessThanOrEqual(viewport.width);
        } finally {
          await page.close();
        }
      });
    }
  }

  it('keeps expanded content reachable by keyboard in a short portrait viewport', async () => {
    const viewport = { width: 320, height: 480 };
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    try {
      await openHub(page);
      await page.locator('.changelog summary').focus();
      await page.keyboard.press('Enter');
      expect(await page.locator('.changelog').getAttribute('open')).not.toBeNull();
      await page.evaluate(() => window.scrollTo(0, 0));
      const shell = await page.locator('.shell').boundingBox();
      expect(shell.y).toBeGreaterThanOrEqual(6);
      expect(shell.height).toBeGreaterThan(viewport.height);
      const layout = await page.evaluate(measureHub, false);
      expect(layout.scrollWidth).toBeLessThanOrEqual(viewport.width);
      expect(layout.clipped).toEqual([]);

      await page.locator('.changelog summary').focus();
      await page.keyboard.press('Tab');
      const footerLink = page.locator('.footer-note a');
      expect(await footerLink.evaluate((link) => link === document.activeElement)).toBe(true);
      const footer = await footerLink.boundingBox();
      expect(footer.y).toBeGreaterThanOrEqual(0);
      expect(footer.y + footer.height).toBeLessThanOrEqual(viewport.height);
    } finally {
      await page.close();
    }
  });

  for (const viewport of PORTRAIT) {
    it(`fits all six returning-player rows in the first screen at ${viewport.width}×${viewport.height}`, async () => {
      const page = await browser.newPage({ viewport });
      try {
        await openHub(page, true);
        const layout = await page.evaluate(measureHub, true);
        expect(layout.cards).toHaveLength(6);
        expect(layout.scrollWidth).toBeLessThanOrEqual(viewport.width);
        expect(layout.clipped).toEqual([]);
        expect(layout.offFirst).toEqual([]);
        expect(layout.overlaps).toEqual([]);
        expect(layout.actionOverlap).toEqual([]);
        for (const card of layout.cards) {
          expect(card.rect.height, `${card.name} tap target`).toBeGreaterThanOrEqual(44);
        }
        expect(layout.mute.tabIndex).toBeGreaterThanOrEqual(0);
        expect(layout.mute.height).toBeGreaterThanOrEqual(44);
        expect(layout.mute.label).toMatch(/mute/i);

        const edges = await page.evaluate(resumeEdges);
        for (const edge of edges) {
          if (edge.marked) {
            expect(edge.visible, `${edge.name} resume edge ${JSON.stringify(edge)}`).toBe(true);
            expect(edge.color).toBe(edge.expectedColor);
          } else {
            expect(edge.visible, `${edge.name} must stay plain`).toBe(false);
          }
          expect(edge.border).toBe('1px');
        }
      } finally {
        await page.close();
      }
    });
  }

  for (const viewport of LANDSCAPE) {
    it(`keeps landscape hub usable at ${viewport.width}×${viewport.height}`, async () => {
      const page = await browser.newPage({ viewport });
      try {
        await openHub(page, true);
        const layout = await page.evaluate(measureHub, false);
        expect(layout.cards).toHaveLength(6);
        expect(layout.scrollWidth).toBeLessThanOrEqual(viewport.width);
        expect(layout.clipped).toEqual([]);
        expect(layout.overlaps).toEqual([]);
        expect(layout.actionOverlap).toEqual([]);
        for (const card of layout.cards) {
          expect(card.rect.height, `${card.name} tap target`).toBeGreaterThanOrEqual(44);
        }
        expect(layout.mute.tabIndex).toBeGreaterThanOrEqual(0);
        expect(layout.mute.height).toBeGreaterThanOrEqual(44);
      } finally {
        await page.close();
      }
    });
  }
});
