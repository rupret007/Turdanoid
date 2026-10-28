// @vitest-environment node
/* global Suite, getComputedStyle */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { chromium } from 'playwright';
import { browserLaunchOptions } from './browser-options.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { COLORBLIND_STORAGE_KEY } from '../games/suite-arcade-a11y.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hasBrowser = Boolean(process.env.PLAYWRIGHT_CHANNEL) || existsSync(chromium.executablePath());

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 }
];

/** Hub arcade/table titles (six games). */
const SUITE_MUSIC_CONTROL = '#suite-music-toggle';

async function closeVisibleGuide(page, selector) {
  const close = page.locator(selector);
  if (await close.isVisible()) {
    // Use the actual control so the dialog restores its inert background too.
    await close.click();
    expect(await close.isVisible()).toBe(false);
  }
}

const SIX_SUITE_GAMES = [
  {
    path: '/TurdAnoid.html',
    hud: ['#hudLives', '#hudScore', '#hudLevel'],
    controls: ['#btnPause', '#btnSound', SUITE_MUSIC_CONTROL],
    quick: [],
    matrixStates: [
      { id: 'title', prepare: async () => {} },
      {
        id: 'play',
        prepare: async (page) => {
          await page.click('#btnStart');
          await page.waitForFunction(
            () => window.__turdanoid && window.__turdanoid.state === 'playing'
          );
        }
      }
    ]
  },
  {
    path: '/turdtris.html',
    hud: ['#hudRail #score', '#hudRail #level', '#hudRail #lines'],
    controls: ['[data-sound-toggle]', '.top-actions button[onclick*="togglePause"]', SUITE_MUSIC_CONTROL],
    quick: ['.welcome-actions button[onclick*="quickStartRun"]', '#quickStartBtn'],
    prepare: async (page) => {
      await page.evaluate(() => {
        if (typeof window.hideWelcomeGuide === 'function') {
          window.hideWelcomeGuide();
        }
      });
    }
  },
  {
    path: '/turdjack.html',
    hud: ['#bankrollText', '#betText', '.hud .card-stat'],
    controls: ['[data-sound-toggle]', SUITE_MUSIC_CONTROL],
    quick: ['#quickGuideBtn'],
    prepare: async (page) => {
      await closeVisibleGuide(page, '#closeGuideBtn');
    }
  },
  {
    path: '/crapeights.html',
    hud: ['.hud-card', '#youCardsText', '#roundText'],
    controls: ['[data-sound-toggle]', SUITE_MUSIC_CONTROL],
    quick: ['#quickStartBtn'],
    prepare: async (page) => {
      await page.evaluate(() => {
        if (typeof window.hideWelcomeGuide === 'function') {
          window.hideWelcomeGuide();
        }
      });
    }
  },
  {
    path: '/turdrummy.html',
    hud: ['.status .stat', '#playerScoreValue', '#deadwoodValue'],
    controls: ['#soundToggleBtn', '#quickGuideBtn', SUITE_MUSIC_CONTROL],
    quick: ['#quickGuideBtn'],
    prepare: async (page) => {
      await page.evaluate(() => {
        const guide = document.getElementById('welcomeGuide');
        if (guide) {
          guide.classList.remove('show');
          guide.setAttribute('aria-hidden', 'true');
        }
      });
      const start = page.locator('#startRoundBtn');
      if (await start.isVisible()) {
        // The bot draws first and a random opening knock can end the round
        // before interactive cards appear. Keep a live deal for layout checks.
        await page.evaluate(() => {
          let seed = 12345;
          window.crypto.getRandomValues = (values) => {
            for (let i = 0; i < values.length; i++) {
              seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
              values[i] = seed;
            }
            return values;
          };
        });
        await start.click();
        await page.waitForSelector('#playerHand .card-button', { timeout: 15000 });
      }
      expect(await page.locator('#playerHand .card-button').count()).toBe(10);
      expect(await page.locator('#drawStockBtn').isEnabled()).toBe(true);
    }
  },
  {
    path: '/turdspades.html',
    hud: ['.ts-score-strip', '.stats .stat', '#roundV'],
    controls: ['#helpBtn', '#nextRoundTop', SUITE_MUSIC_CONTROL],
    quick: ['#quickStart'],
    prepare: async (page) => {
      await closeVisibleGuide(page, '#closeGuide');
    }
  }
];

let server;
let browser;
let baseUrl;

beforeAll(async () => {
  if (!hasBrowser) {
    throw new Error(
      'Playwright Chromium is required. Run npx playwright install chromium or set PLAYWRIGHT_CHANNEL.'
    );
  }
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml'
  };
  server = createServer(async (request, response) => {
    const path = resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
    if (!path.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(path);
      response
        .writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' })
        .end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolveServer) => server.listen(0, '127.0.0.1', resolveServer));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch(browserLaunchOptions());
}, 30000);

afterAll(async () => {
  await browser?.close();
  if (server) {
    await new Promise((resolveServer, reject) =>
      server.close((error) => (error ? reject(error) : resolveServer()))
    );
  }
});

function layoutPhases(game) {
  if (game.matrixStates) {
    return game.matrixStates;
  }
  return [{ id: 'play', prepare: game.prepare }];
}

async function assertA11yToggleLayout(page, game) {
  const selectors = [...new Set([...game.hud, ...game.controls, ...game.quick, SUITE_MUSIC_CONTROL])];
  const report = await page.evaluate((sels) => {
    const overlap = (a, b) =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
      Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
    const box = (el) => {
      if (!el) {
        return null;
      }
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return null;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) {
        return null;
      }
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    };
    const toggleEl = document.getElementById('suite-arcade-a11y-toggle');
    const toggle = box(toggleEl);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const inViewport =
      toggle &&
      toggle.left >= -1 &&
      toggle.top >= -1 &&
      toggle.right <= vw + 1 &&
      toggle.bottom <= vh + 1;
    const hits = [];
    for (const sel of sels) {
      document.querySelectorAll(sel).forEach((el) => {
        const rect = box(el);
        if (rect && toggle && overlap(toggle, rect)) {
          hits.push(sel);
        }
      });
    }
    const floating = toggleEl?.classList.contains('suite-arcade-a11y-toggle--floating');
    return { inViewport, hits, floating };
  }, selectors);

  expect(report.inViewport).toBe(true);
  expect(report.hits).toEqual([]);
  expect(report.floating).toBe(false);
}

(hasBrowser ? describe.sequential : describe.skip)('arcade a11y (Playwright)', () => {
  for (const state of ['title', 'playing', 'paused']) {
    for (const key of ['Enter', 'Space']) {
      it(`${key} on the toggle changes colors without leaving Turdanoid ${state}`, async () => {
        const page = await browser.newPage();
        try {
          await page.goto(`${baseUrl}/TurdAnoid.html`, { waitUntil: 'domcontentloaded' });
          const toggle = page.locator('#suite-arcade-a11y-toggle');
          await toggle.waitFor();
          await page.evaluate((targetState) => {
            const game = window.__turdanoid;
            if (targetState !== 'title') {
              game.startGame();
            }
            if (targetState === 'paused') {
              game.doPause();
            }
          }, state);
          await toggle.focus();
          for (const pressed of ['true', 'false']) {
            await page.keyboard.press(key);
            expect(await toggle.getAttribute('aria-pressed')).toBe(pressed);
            expect(await page.evaluate(() => ({
              state: window.__turdanoid.state,
              waitingLaunch: window.__turdanoid.waitingLaunch
            }))).toEqual({ state, waitingLaunch: true });
          }
        } finally {
          await page.close();
        }
      });
    }
  }

  for (const viewport of VIEWPORTS) {
    for (const decision of ['accept', 'decline', 'escape']) {
      it(`hides Clr during insurance and restores it after ${decision} at ${viewport.width}x${viewport.height}`, async () => {
        const page = await browser.newPage({ viewport });
        try {
          await page.goto(`${baseUrl}/turdjack.html`, { waitUntil: 'domcontentloaded' });
          const toggle = page.locator('#suite-arcade-a11y-toggle');
          await toggle.waitFor();
          await page.waitForFunction(() => window.__turdjackDev);
          await page.evaluate(() => {
            window.__turdjackDev.prepare('insurance');
            window.__turdjackDev._autoInsurance = null;
          });
          await toggle.click();
          expect(await toggle.getAttribute('aria-pressed')).toBe('true');
          await page.locator('#dealBtn:visible, [data-mobile-action="deal"]:visible').first().click();
          const overlay = page.locator('#jackConfirmOverlay');
          await overlay.waitFor({ state: 'visible' });
          expect(await page.locator('#jackConfirmTitle').textContent()).toBe('Insurance');
          expect(await toggle.isVisible()).toBe(false);
          await page.waitForFunction(() => document.activeElement.id === 'jackConfirmNo');
          await page.keyboard.press('Tab');
          expect(await page.evaluate(() => document.activeElement.id)).toBe('jackConfirmYes');
          if (decision === 'escape') {
            await page.keyboard.press('Escape');
          } else {
            await page.click(decision === 'accept' ? '#jackConfirmYes' : '#jackConfirmNo');
          }
          await overlay.waitFor({ state: 'hidden' });
          expect(await toggle.isVisible()).toBe(true);
          expect(await toggle.getAttribute('aria-pressed')).toBe('true');
          await toggle.click();
          expect(await toggle.getAttribute('aria-pressed')).toBe('false');
        } finally {
          await page.close();
        }
      });
    }
  }

  for (const game of SIX_SUITE_GAMES) {
    for (const viewport of VIEWPORTS) {
      it(`${game.path} Clr receives taps at ${viewport.width}x${viewport.height}`, async () => {
        const page = await browser.newPage({ viewport, hasTouch: true });
        try {
          await page.goto(`${baseUrl}${game.path}`, { waitUntil: 'domcontentloaded' });
          const toggle = page.locator('#suite-arcade-a11y-toggle');
          await toggle.waitFor();
          for (const phase of layoutPhases(game)) {
            await phase.prepare(page);
            await assertA11yToggleLayout(page, game);
            const hitTest = await toggle.evaluate((control) => {
              const r = control.getBoundingClientRect();
              // Check the center and inset corners: a box alone misses clipping and overlays.
              const points = [
                [r.left + r.width / 2, r.top + r.height / 2],
                [r.left + 10, r.top + 10],
                [r.right - 10, r.top + 10],
                [r.left + 10, r.bottom - 10],
                [r.right - 10, r.bottom - 10]
              ];
              return {
                width: r.width,
                height: r.height,
                hits: points.map(([x, y]) => {
                  const hit = document.elementFromPoint(x, y);
                  return hit === control ? 'control' : hit?.id || hit?.className || null;
                })
              };
            });
            expect(hitTest.width).toBeGreaterThanOrEqual(44);
            expect(hitTest.height).toBeGreaterThanOrEqual(44);
            expect(hitTest.hits, phase.id).toEqual(Array(5).fill('control'));
            expect(await toggle.textContent()).toBe('Clr');
            await toggle.tap();
            expect(await toggle.getAttribute('aria-pressed')).toBe('true');
            expect(await page.evaluate(() => Suite.isColorblindMode())).toBe(true);
            await toggle.tap();
            expect(await toggle.getAttribute('aria-pressed')).toBe('false');
          }
        } finally {
          await page.close();
        }
      });
    }
  }

  it('honors prefers-reduced-motion for ambient auto-scroll', async () => {
    const page = await browser.newPage();
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`${baseUrl}/turdjack.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.Suite && typeof Suite.prefersReducedMotion === 'function');
      expect(await page.evaluate(() => Suite.prefersReducedMotion())).toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.classList.contains('suite-motion-reduce'))
      ).toBe(true);
      const wispAnim = await page.evaluate(() => {
        const el = document.querySelector('.suite-bg-wisp');
        if (!el) {
          return 'missing';
        }
        return getComputedStyle(el).animationName;
      });
      expect(wispAnim === 'none' || wispAnim === '').toBe(true);
    } finally {
      await page.close();
    }
  });

  it('fails overlap detection when the toggle is moved onto HUD chrome', async () => {
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: 320, height: 568 });
      await page.goto(`${baseUrl}/TurdAnoid.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#suite-arcade-a11y-toggle');
      await page.click('#btnStart');
      await page.waitForFunction(() => window.__turdanoid && window.__turdanoid.state === 'playing');
      const wouldOverlap = await page.evaluate(() => {
        const overlap = (a, b) =>
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        const box = (el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        };
        const toggleEl = document.getElementById('suite-arcade-a11y-toggle');
        const lives = document.getElementById('hudLives');
        if (!toggleEl || !lives) {
          return false;
        }
        const anchor = lives.getBoundingClientRect();
        toggleEl.style.position = 'fixed';
        toggleEl.style.left = `${anchor.left}px`;
        toggleEl.style.top = `${anchor.top}px`;
        toggleEl.style.right = 'auto';
        toggleEl.style.bottom = 'auto';
        return overlap(box(toggleEl), box(lives));
      });
      expect(wouldOverlap).toBe(true);
    } finally {
      await page.close();
    }
  });

  it('keeps the colorblind toggle on-screen and clear of HUD controls (six games)', async () => {
    for (const game of SIX_SUITE_GAMES) {
      for (const viewport of VIEWPORTS) {
        const page = await browser.newPage();
        try {
          await page.setViewportSize(viewport);
          await page.goto(`${baseUrl}${game.path}`, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('#suite-arcade-a11y-toggle');
          for (const phase of layoutPhases(game)) {
            await phase.prepare(page);
            await assertA11yToggleLayout(page, game);
          }
        } finally {
          await page.close();
        }
      }
    }
  });

  it('freezes Turdanoid title parallax under prefers-reduced-motion', async () => {
    const page = await browser.newPage();
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 390, height: 700 });
      await page.goto(`${baseUrl}/TurdAnoid.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__turdanoid && typeof window.__turdanoid.sampleBgStar === 'function');
      const drift = await page.evaluate(() => {
        const sample = () => window.__turdanoid.sampleBgStar();
        const start = sample();
        for (let i = 0; i < 48; i++) {
          window.__turdanoid.render();
        }
        const end = sample();
        return { start, end };
      });
      expect(drift.end.x).toBeCloseTo(drift.start.x, 5);
      expect(drift.end.y).toBeCloseTo(drift.start.y, 5);
    } finally {
      await page.close();
    }
  });

  it('persists colorblind toggle across reload', async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${baseUrl}/turdjack.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.Suite && typeof Suite.isColorblindMode === 'function');
      await page.waitForSelector('#suite-arcade-a11y-toggle');
      await closeVisibleGuide(page, '#closeGuideBtn');
      await page.click('#suite-arcade-a11y-toggle');
      await page.waitForFunction(() => window.Suite && Suite.isColorblindMode());
      expect(await page.evaluate(() => Suite.isColorblindMode())).toBe(true);
      const stored = await page.evaluate((key) => localStorage.getItem(key), COLORBLIND_STORAGE_KEY);
      expect(stored).toBe('1');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.Suite && typeof Suite.isColorblindMode === 'function');
      await page.waitForFunction(() => window.Suite && Suite.isColorblindMode());
      expect(await page.evaluate(() => Suite.isColorblindMode())).toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.classList.contains('suite-colorblind'))
      ).toBe(true);
    } finally {
      await page.close();
    }
  });

  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    it(`Clr toggle clears title menu buttons on Turdanoid at ${viewport.width}x${viewport.height}`, async () => {
      const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
      try {
        await page.goto(`${baseUrl}/TurdAnoid.html`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#suite-arcade-a11y-toggle');
        await page.waitForSelector('#titleScreen.show');
        // The shared back pill replaces the inline Game Hub button.
        await page.waitForSelector('.suite-back-pill');
        await page.waitForSelector('#titleScreen #btnHub', { state: 'hidden' });
        for (const id of ['btnBoss', 'btnHowTo']) {
          await page.waitForSelector(`#titleScreen .menu-secondary #${id}`, { state: 'visible' });
        }
        const result = await page.evaluate(() => {
          const overlap = (a, b) =>
            Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
          const box = (el) => {
            if (!el) {
              return null;
            }
            const style = getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
              return null;
            }
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) {
              return null;
            }
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
          };
          const inViewport = (rect) =>
            Boolean(
              rect &&
              rect.left >= 0 &&
              rect.top >= 0 &&
              rect.right <= window.innerWidth &&
              rect.bottom <= window.innerHeight
            );
          const toggle = document.getElementById('suite-arcade-a11y-toggle');
          const toggleBox = box(toggle);
          const menuBtns = document.querySelectorAll('#titleScreen .menu-secondary button');
          const menuButtons = [];
          const hits = [];
          for (const btn of menuBtns) {
            const btnBox = box(btn);
            menuButtons.push({ id: btn.id, inViewport: inViewport(btnBox) });
            if (toggleBox && btnBox && overlap(toggleBox, btnBox)) {
              hits.push(btn.id || btn.textContent.trim());
            }
          }
          return { toggleInViewport: inViewport(toggleBox), menuButtons, hits };
        });
        expect(result.toggleInViewport).toBe(true);
        expect(result.menuButtons).toEqual([
          { id: 'btnBoss', inViewport: true },
          { id: 'btnHowTo', inViewport: true },
          { id: 'btnHub', inViewport: false }
        ]);
        expect(result.hits).toEqual([]);
      } finally {
        await page.close();
      }
    });
  }
});
