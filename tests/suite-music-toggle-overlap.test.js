// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hasBrowser = Boolean(process.env.PLAYWRIGHT_CHANNEL) || existsSync(chromium.executablePath());

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 }
];

const SUITE_PAGES = [
  { path: 'index.html', slug: 'hub', prep: prepHub },
  { path: 'TurdAnoid.html', slug: 'turdanoid', prep: prepTurdanoid },
  { path: 'turdtris.html', slug: 'turdtris', prep: prepTurdtris },
  { path: 'turdjack.html', slug: 'turdjack', prep: prepTurdjack },
  { path: 'crapeights.html', slug: 'crapeights', prep: prepCrapeights },
  { path: 'turdrummy.html', slug: 'turdrummy', prep: prepTurdrummy },
  { path: 'turdspades.html', slug: 'turdspades', prep: prepTurdspades },
  { path: 'turdomania.html', slug: 'turdomania', prep: prepTurdomania }
];

const GUARD_SELECTOR = [
  '#btnPause',
  '#btnSound',
  '[data-action="pause"]',
  '[data-sound-toggle]',
  '#soundToggleBtn',
  '#hudLives',
  '#hudScore',
  '#hudLevel',
  '.hud .col',
  '.hud-card',
  '.hud .stat',
  'header.hud .stat',
  '#score',
  '#left',
  '#best'
].join(',');

let server;
let baseUrl;
let browser;

beforeAll(async () => {
  if (!hasBrowser) {
    return;
  }
  server = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const filePath = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filePath.startsWith(`${root}${sep}`)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
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

async function dismissGuides(page) {
  await page.evaluate(() => {
    localStorage.setItem('turdsuite_guides_seen_v1', '1');
  });
}

async function prepHub(page) {
  await dismissGuides(page);
  await page.waitForSelector('#suite-music-toggle');
}

async function prepTurdanoid(page) {
  await page.evaluate(() => {
    localStorage.setItem('turdanoid_v3_coach_v1', '1');
    localStorage.setItem('turdsuite_guides_seen_v1', '1');
  });
  await page.locator('#btnStart').click();
  await page.waitForFunction(() => window.__turdanoid?.state === 'playing', { timeout: 15_000 });
}

async function prepTurdtris(page) {
  await dismissGuides(page);
  const closeGuide = page.getByRole('button', { name: 'Close Guide' });
  if (await closeGuide.isVisible().catch(() => false)) {
    await closeGuide.click();
  }
  await page.waitForSelector('#game', { state: 'visible', timeout: 10_000 });
}

async function prepTurdjack(page) {
  await dismissGuides(page);
  const quick = page.getByRole('button', { name: 'Quick Start' });
  if (await quick.isVisible().catch(() => false)) {
    await quick.click();
  }
  await page.waitForTimeout(200);
}

async function prepCrapeights(page) {
  await dismissGuides(page);
  await page.getByRole('button', { name: 'Quick Start' }).click();
  await page.waitForTimeout(250);
}

async function prepTurdrummy(page) {
  await dismissGuides(page);
  await page.locator('#startRoundBtn').click();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    document.querySelector('.coach')?.remove();
  });
}

async function prepTurdspades(page) {
  await page.evaluate(() => {
    localStorage.setItem('turdsuite_guides_seen_v1', '1');
    const guide = document.getElementById('guide');
    if (guide) {
      guide.classList.remove('show');
    }
    if (window.Suite?.guide) {
      Suite.guide.mark('turdspades.html');
    }
  });
  await page.waitForTimeout(200);
}

async function prepTurdomania(page) {
  await dismissGuides(page);
  await page.waitForFunction(() => window.__turdomania?.state, { timeout: 10_000 });
}

function measureMusicToggleOverlap(page, guardSelector) {
  return page.evaluate((sel) => {
    const toggle = document.getElementById('suite-music-toggle');
    if (!toggle) {
      return { ok: false, reason: 'missing #suite-music-toggle' };
    }
    const style = getComputedStyle(toggle);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return { ok: false, reason: 'music toggle not visible' };
    }
    const rect = toggle.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const minTap = 44;
    if (rect.width < minTap || rect.height < minTap) {
      return {
        ok: false,
        reason: `toggle smaller than ${minTap}px`,
        size: { width: rect.width, height: rect.height }
      };
    }
    if (rect.left < 0 || rect.top < 0 || rect.right > vw || rect.bottom > vh) {
      return {
        ok: false,
        reason: 'toggle outside viewport',
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        viewport: { width: vw, height: vh }
      };
    }

    const overlaps = [];
    const box = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    for (const el of document.querySelectorAll(sel)) {
      if (!(el instanceof Element) || el === toggle || toggle.contains(el) || el.contains(toggle)) {
        continue;
      }
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) {
        continue;
      }
      const other = el.getBoundingClientRect();
      if (other.width < 1 || other.height < 1) {
        continue;
      }
      const otherBox = {
        left: other.left,
        top: other.top,
        right: other.right,
        bottom: other.bottom
      };
      if (
        box.left < otherBox.right &&
        box.right > otherBox.left &&
        box.top < otherBox.bottom &&
        box.bottom > otherBox.top
      ) {
        overlaps.push(el.id || el.getAttribute('class') || el.tagName.toLowerCase());
      }
    }

    return { ok: overlaps.length === 0, overlaps };
  }, guardSelector);
}

(hasBrowser ? describe.sequential : describe.skip)('suite music toggle layout', () => {
  for (const spec of SUITE_PAGES) {
    for (const viewport of VIEWPORTS) {
      it(`#suite-music-toggle clears pause, sound, and HUD chrome on ${spec.slug} at ${viewport.width}×${viewport.height}`, async () => {
        const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
        try {
          await page.goto(`${baseUrl}/${spec.path}`, { waitUntil: 'domcontentloaded' });
          await spec.prep(page);
          await page.waitForTimeout(150);
          const result = await measureMusicToggleOverlap(page, GUARD_SELECTOR);
          expect(result.ok, JSON.stringify(result)).toBe(true);
        } finally {
          await page.close();
        }
      });
    }
  }
});
