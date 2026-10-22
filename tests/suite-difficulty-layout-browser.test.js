// @vitest-environment node
/**
 * Playwright layout checks for the shared difficulty picker (Turdanoid title + play).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hasBrowser = Boolean(process.env.PLAYWRIGHT_CHANNEL) || existsSync(chromium.executablePath());

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '390x844', width: 390, height: 844 },
  { name: '844x390', width: 844, height: 390 }
];

const PAGES = [
  {
    slug: 'turdanoid',
    path: 'TurdAnoid.html',
    picker: '.suite-difficulty',
    states: [
      {
        name: 'title',
        prep: async (page) => {
          await page.evaluate(() => {
            localStorage.setItem('turdanoid_v3_coach_v1', '1');
            localStorage.setItem('turdsuite_guides_seen_v1', '1');
          });
        }
      },
      {
        name: 'playing',
        prep: async (page) => {
          await page.evaluate(() => {
            localStorage.setItem('turdanoid_v3_coach_v1', '1');
            localStorage.setItem('turdsuite_guides_seen_v1', '1');
          });
          await page.locator('#btnStart').click();
          await page.waitForFunction(() => window.__turdanoid?.state === 'playing', { timeout: 15000 });
        }
      }
    ]
  },
  {
    slug: 'turdtris',
    path: 'turdtris.html',
    picker: '.suite-difficulty',
    states: [
      {
        name: 'playing',
        prep: async (page) => {
          await page.evaluate(() => localStorage.setItem('turdsuite_guides_seen_v1', '1'));
          const close = page.getByRole('button', { name: 'Play', exact: true });
          if (await close.isVisible().catch(() => false)) {
            await close.click();
          }
        }
      }
    ],
    targets: [{ name: 'run-menu', selector: '.mobile-menu summary' }],
    minPicker: 44,
    ignoreMusicOverlap: true
  },
  {
    slug: 'turdrummy',
    path: 'turdrummy.html',
    picker: '.suite-difficulty, #difficultyBtn',
    states: [
      {
        name: 'playing',
        prep: async (page) => {
          await page.evaluate(() => localStorage.setItem('turdsuite_guides_seen_v1', '1'));
          await page.locator('#startRoundBtn').click();
          await page.waitForTimeout(300);
        }
      }
    ],
    targets: [
      { name: 'draw-discard', selector: '#drawDiscardBtn' },
      { name: 'discard', selector: '#discardBtn' }
    ],
    minPicker: 44,
    ignoreMusicOverlap: true
  }
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
}, 60_000);

afterAll(async () => {
  await browser?.close();
  if (server) {
    await new Promise((done, err) => server.close((e) => (e ? err(e) : done())));
  }
});

function turdanoidTargets() {
  return [
    { name: 'hud-score', selector: '#hudScore' },
    { name: 'hud-level', selector: '#hudLevel' },
    { name: 'hud-lives', selector: '#hudLives' },
    { name: 'pause', selector: '#btnPause' },
    { name: 'sound', selector: '#btnSound' }
  ];
}

describe('gameplay chrome clearance', () => {
  it.each([[320, 568], [390, 844], [667, 375], [844, 390]])('keeps the brick wall below the entire HUD at %sx%s', async (width, height) => {
    if (!hasBrowser) { return; }
    const page = await browser.newPage({ viewport: { width, height } });
    try {
      await page.addInitScript(() => localStorage.setItem('turdanoid_v3_coach_v1', '1'));
      await page.goto(baseUrl + '/TurdAnoid.html');
      await page.evaluate(() => document.fonts.ready);
      await page.locator('#btnStart').click();
      await page.waitForFunction(() => window.__turdanoid?.state === 'playing');
      const original = await page.evaluate(() => window.__turdanoid.bricks.map(b => [b.hp, b.maxHp]));
      for (const [w, h] of [[width, height], [height, width], [width, height]]) {
        await page.setViewportSize({ width: w, height: h });
        await page.evaluate(() => new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))));
        const layout = await page.evaluate(() => {
          const game = window.__turdanoid;
          const canvas = document.getElementById('game').getBoundingClientRect();
          const hud = document.querySelector('.hud').getBoundingClientRect();
          const top = Math.min(...game.bricks.map(b => canvas.top + b.y * canvas.height / game.H));
          const controls = [...document.querySelectorAll('.suite-back-pill, #btnSound, #btnPause, #suite-music-toggle, #suite-arcade-a11y-toggle')]
            .filter(el => el.checkVisibility()).map(el => el.getBoundingClientRect());
          return { top, hudBottom: hud.bottom, outside: game.bricks.filter(b => b.x < 0 || b.x + b.w > game.W + 0.5 || b.y + b.h >= game.paddle.y).length,
            collisions: controls.filter(r => r.left < hud.right && r.right > hud.left && r.top < hud.bottom && r.bottom > hud.top).length };
        });
        expect(layout.top).toBeGreaterThanOrEqual(layout.hudBottom + 4);
        expect(layout.collisions).toBe(0);
        expect(layout.outside).toBe(0);
        expect(await page.evaluate(() => window.__turdanoid.bricks.map(b => [b.hp, b.maxHp]))).toEqual(original);
      }
    } finally { await page.close(); }
  });

  it.each(['TurdAnoid', 'turdtris', 'turdomania', 'turdjack', 'crapeights', 'turdrummy', 'turdspades'])('keeps the desktop music label clear of the Hub pill in %s', async game => {
    if (!hasBrowser) { return; }
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await page.goto(baseUrl + '/' + game + '.html');
      await page.locator('.suite-music-title').waitFor();
      const pill = await page.locator('.suite-back-pill').boundingBox();
      const label = await page.locator('.suite-music-title').boundingBox();
      expect(label.x).toBeGreaterThanOrEqual(pill.x + pill.width + 4);
    } finally { await page.close(); }
  });
});

describe('shared difficulty picker layout', () => {
  for (const spec of PAGES) {
    for (const state of spec.states) {
      for (const vp of VIEWPORTS) {
        it(`${spec.slug} @ ${vp.name} (${state.name}): picker clear of HUD, bricks, controls`, async () => {
          if (!hasBrowser) {
            return;
          }
          const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
          await page.goto(`${baseUrl}/${spec.path}`, { waitUntil: 'domcontentloaded' });
          await state.prep(page);
          await page.waitForTimeout(200);

          const targets =
            spec.slug === 'turdanoid' ? turdanoidTargets() : spec.targets || [];
          const includeBricks = spec.slug === 'turdanoid' && state.name === 'playing';
          const checkHudLabels = spec.slug === 'turdanoid';

          /* eslint-disable no-undef -- runs in the browser via page.evaluate */
          const layout = await page.evaluate(
            ({ pickerSel, targets, includeBricks, checkHudLabels, ignoreMusicOverlap }) => {
              function rectsOverlap(a, b) {
                return (
                  a.left < b.right &&
                  a.right > b.left &&
                  a.top < b.bottom &&
                  a.bottom > b.top
                );
              }
              function visibleRect(el) {
                if (!el) {
                  return null;
                }
                const style = getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                  return null;
                }
                const rect = el.getBoundingClientRect();
                if (rect.width < 1 || rect.height < 1) {
                  return null;
                }
                return rect;
              }

              const candidates = pickerSel.split(',').map((s) => s.trim());
              let picker = null;
              for (const sel of candidates) {
                const node = document.querySelector(sel);
                const rect = visibleRect(node);
                if (rect) {
                  picker = { node, rect };
                  break;
                }
              }

              const overlaps = [];
              const clippedLabels = [];
              if (!picker) {
                return { missingPicker: true, overlaps, clippedLabels, size: null };
              }
              const pr = picker.rect;
              const size = { width: pr.width, height: pr.height };
              for (const t of targets) {
                const el = document.querySelector(t.selector);
                const r = visibleRect(el);
                if (!r) {
                  continue;
                }
                if (rectsOverlap(pr, r)) {
                  overlaps.push(t.name);
                }
              }
              const pill = document.querySelector('a.suite-back-pill');
              const pillRect = visibleRect(pill);
              if (pillRect && rectsOverlap(pr, pillRect)) {
                overlaps.push('hub-pill');
              }
              if (!ignoreMusicOverlap) {
                const music = document.getElementById('suite-music-toggle');
                const musicRect = visibleRect(music);
                if (musicRect && rectsOverlap(pr, musicRect)) {
                  overlaps.push('music-toggle');
                }
              }
              if (includeBricks && window.__turdanoid && window.__turdanoid.bricks) {
                const canvas = document.getElementById('game');
                const cr = canvas.getBoundingClientRect();
                const scaleX = cr.width / window.__turdanoid.W;
                const scaleY = cr.height / window.__turdanoid.H;
                for (const b of window.__turdanoid.bricks) {
                  const br = {
                    left: cr.left + b.x * scaleX,
                    top: cr.top + b.y * scaleY,
                    right: cr.left + (b.x + b.w) * scaleX,
                    bottom: cr.top + (b.y + b.h) * scaleY
                  };
                  if (rectsOverlap(pr, br)) {
                    overlaps.push('brick');
                    break;
                  }
                }
              }
              if (checkHudLabels) {
                for (const lbl of document.querySelectorAll('.hud .lbl')) {
                  const lr = visibleRect(lbl);
                  if (!lr) {
                    continue;
                  }
                  if (lbl.scrollWidth > lbl.clientWidth + 1) {
                    clippedLabels.push(lbl.textContent || '');
                  }
                }
              }
              return { missingPicker: false, overlaps, clippedLabels, size };
            },
            {
              pickerSel: spec.picker,
              targets,
              includeBricks,
              checkHudLabels,
              ignoreMusicOverlap: Boolean(spec.ignoreMusicOverlap)
            }
          );
          /* eslint-enable no-undef */

          await page.close();

          if (state.name === 'title' || spec.slug !== 'turdanoid') {
            expect(layout.missingPicker, `${spec.slug} picker missing`).toBe(false);
          }
          if (spec.minPicker && layout.size) {
            expect(layout.size.height, `${spec.slug} picker height`).toBeGreaterThanOrEqual(spec.minPicker);
            expect(layout.size.width, `${spec.slug} picker width`).toBeGreaterThanOrEqual(spec.minPicker);
          }
          expect(layout.overlaps, `${spec.slug}@${vp.name}/${state.name}`).toEqual([]);
          expect(layout.clippedLabels, `${spec.slug} HUD labels@${vp.name}/${state.name}`).toEqual([]);
        });
      }
    }
  }
});
