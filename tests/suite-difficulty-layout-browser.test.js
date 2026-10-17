// @vitest-environment node
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
    prep: async (page) => {
      await page.evaluate(() => {
        localStorage.setItem('turdanoid_v3_coach_v1', '1');
        localStorage.setItem('turdsuite_guides_seen_v1', '1');
      });
      await page.locator('#btnStart').click();
      await page.waitForFunction(() => window.__turdanoid?.state === 'playing', { timeout: 15000 });
    },
    targets: [
      { name: 'hud-score', selector: '#hudScore' },
      { name: 'hud-level', selector: '#hudLevel' },
      { name: 'hud-lives', selector: '#hudLives' },
      { name: 'pause', selector: '#btnPause' },
      { name: 'sound', selector: '#btnSound' }
    ],
    picker: '.suite-difficulty',
    ignoreMusicOverlap: true
  },
  {
    slug: 'turdtris',
    path: 'turdtris.html',
    prep: async (page) => {
      await page.evaluate(() => localStorage.setItem('turdsuite_guides_seen_v1', '1'));
      const close = page.getByRole('button', { name: 'Close Guide' });
      if (await close.isVisible().catch(() => false)) {await close.click();}
    },
    targets: [{ name: 'run-menu', selector: '.mobile-menu summary' }],
    picker: '.suite-difficulty',
    minPicker: 44,
    ignoreMusicOverlap: true
  },
  {
    slug: 'turdrummy',
    path: 'turdrummy.html',
    prep: async (page) => {
      await page.evaluate(() => localStorage.setItem('turdsuite_guides_seen_v1', '1'));
      await page.locator('#startRoundBtn').click();
      await page.waitForTimeout(300);
    },
    targets: [
      { name: 'draw-discard', selector: '#drawDiscardBtn' },
      { name: 'discard', selector: '#discardBtn' }
    ],
    picker: '.suite-difficulty, #difficultyBtn',
    minPicker: 44
  }
];

let server;
let baseUrl;
let browser;

beforeAll(async () => {
  if (!hasBrowser) {return;}
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

describe('shared difficulty picker layout', () => {
  for (const spec of PAGES) {
    for (const vp of VIEWPORTS) {
      it(`${spec.slug} @ ${vp.name}: picker does not overlap HUD/controls`, async () => {
        if (!hasBrowser) {return;}
        const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
        await page.goto(`${baseUrl}/${spec.path}`, { waitUntil: 'domcontentloaded' });
        await spec.prep(page);
        await page.waitForSelector(spec.picker, { timeout: 12000, state: 'attached' });

        /* eslint-disable no-undef -- runs in the browser via page.evaluate */
        const layout = await page.evaluate(
          ({ pickerSel, targets, ignoreMusicOverlap }) => {
            const candidates = pickerSel.split(',').map((s) => s.trim());
            let picker = null;
            for (const sel of candidates) {
              const node = document.querySelector(sel);
              if (!node) {continue;}
              const style = getComputedStyle(node);
              if (style.display === 'none' || style.visibility === 'hidden') {continue;}
              const rect = node.getBoundingClientRect();
              if (rect.width < 1 || rect.height < 1) {continue;}
              picker = node;
              break;
            }
            if (!picker) {
              return { missingPicker: true, overlaps: [], size: null };
            }
            const pr = picker.getBoundingClientRect();
            const size = { width: pr.width, height: pr.height };
            const overlaps = [];
            for (const t of targets) {
              const el = document.querySelector(t.selector);
              if (!el) {continue;}
              const r = el.getBoundingClientRect();
              if (r.width < 1 || r.height < 1) {continue;}
              const a = { left: pr.left, top: pr.top, right: pr.right, bottom: pr.bottom };
              const b = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
              const hit =
                a.left < b.right &&
                a.right > b.left &&
                a.top < b.bottom &&
                a.bottom > b.top;
              if (hit) {overlaps.push(`${t.name}`);}
            }
            const pill = document.querySelector('a.suite-back-pill');
            if (pill) {
              const br = pill.getBoundingClientRect();
              const a = { left: pr.left, top: pr.top, right: pr.right, bottom: pr.bottom };
              const b = { left: br.left, top: br.top, right: br.right, bottom: br.bottom };
              if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
                overlaps.push('hub-pill');
              }
            }
            const music = document.getElementById('suite-music-toggle');
            if (music && !ignoreMusicOverlap) {
              const mr = music.getBoundingClientRect();
              const a = { left: pr.left, top: pr.top, right: pr.right, bottom: pr.bottom };
              const b = { left: mr.left, top: mr.top, right: mr.right, bottom: mr.bottom };
              if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
                overlaps.push('music-toggle');
              }
              if (document.querySelector('#btnPause')) {
                const pause = document.querySelector('#btnPause').getBoundingClientRect();
                const pm = { left: pause.left, top: pause.top, right: pause.right, bottom: pause.bottom };
                const mm = { left: mr.left, top: mr.top, right: mr.right, bottom: mr.bottom };
                if (pm.left < mm.right && pm.right > mm.left && pm.top < mm.bottom && pm.bottom > mm.top) {
                  overlaps.push('music-pause');
                }
              }
            }
            return { missingPicker: false, overlaps, size };
          },
          {
            pickerSel: spec.picker,
            targets: spec.targets,
            minPicker: spec.minPicker || 0,
            ignoreMusicOverlap: Boolean(spec.ignoreMusicOverlap)
          }
        );
        /* eslint-enable no-undef */

        await page.close();

        expect(layout.missingPicker, `${spec.slug} picker missing`).toBe(false);
        if (spec.minPicker) {
          expect(layout.size.height, `${spec.slug} picker height`).toBeGreaterThanOrEqual(spec.minPicker);
          expect(layout.size.width, `${spec.slug} picker width`).toBeGreaterThanOrEqual(spec.minPicker);
        }
        expect(layout.overlaps, `${spec.slug}@${vp.name}`).toEqual([]);
      });
    }
  }
});
