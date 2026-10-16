// @vitest-environment node

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { COLORBLIND_STORAGE_KEY } from '../games/suite-arcade-a11y.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hasBrowser = Boolean(process.env.PLAYWRIGHT_CHANNEL) || existsSync(chromium.executablePath());

let server;
let browser;
let baseUrl;

beforeAll(async () => {
  if (!hasBrowser) return;
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
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium',
    headless: true
  });
}, 30000);

afterAll(async () => {
  await browser?.close();
  if (server) {
    await new Promise((resolveServer, reject) =>
      server.close((error) => (error ? reject(error) : resolveServer()))
    );
  }
});

describe('arcade a11y (Playwright)', () => {
  it('honors prefers-reduced-motion for ambient auto-scroll', async () => {
    if (!hasBrowser) return;
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
        if (!el) return 'missing';
        return getComputedStyle(el).animationName;
      });
      expect(wispAnim === 'none' || wispAnim === '').toBe(true);
    } finally {
      await page.close();
    }
  });

  it('persists colorblind toggle across reload', async () => {
    if (!hasBrowser) return;
    const page = await browser.newPage();
    try {
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#suite-arcade-a11y-toggle');
      await page.click('#suite-arcade-a11y-toggle');
      await page.waitForFunction(() => window.Suite && Suite.isColorblindMode());
      expect(await page.evaluate(() => Suite.isColorblindMode())).toBe(true);
      const stored = await page.evaluate((key) => localStorage.getItem(key), COLORBLIND_STORAGE_KEY);
      expect(stored).toBe('1');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.Suite && Suite.isColorblindMode());
      expect(await page.evaluate(() => Suite.isColorblindMode())).toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.classList.contains('suite-colorblind'))
      ).toBe(true);
    } finally {
      await page.close();
    }
  });
});
