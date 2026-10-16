import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const css = readFileSync(resolve(root, 'assets/arcade.css'), 'utf8');
const html = readFileSync(resolve(root, 'TurdAnoid.html'), 'utf8');

describe('Stalemate Arcade kit', () => {
  it('self-hosts its fonts with OFL licenses (no network)', () => {
    for (const f of [
      'barlow-condensed-600.woff2',
      'barlow-condensed-800.woff2',
      'source-sans-3.woff2',
      'OFL-BarlowCondensed.txt',
      'OFL-SourceSans3.txt'
    ]) {
      expect(existsSync(resolve(root, 'assets/fonts', f)), f).toBe(true);
    }
    expect(css).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });

  it('defines the shared palette and a signature color for all seven games', () => {
    for (const t of ['--arc-mint', '--arc-gold', '--arc-orange', '--arc-tap:48px']) {
      expect(css).toContain(t);
    }
    for (const g of [
      'turdanoid',
      'turdtris',
      'turdomania',
      'crapjack',
      'crapeights',
      'turdspades',
      'turdrummy'
    ]) {
      expect(css).toContain(`data-arcade-game="${g}"`);
    }
  });

  it('keeps scanlines on the title screen only', () => {
    const scan = css.split('}').filter((r) => r.includes('repeating-linear-gradient'));
    expect(scan.length).toBe(1);
    expect(scan[0]).toMatch(/#titleScreen/);
  });

  it('Turdanoid opts in after the legacy suite CSS', () => {
    expect(html).toMatch(/turdsuite\.css">\s*<link rel="stylesheet" href="assets\/arcade\.css">/);
    expect(html).toMatch(/<body class="arcade" data-arcade-game="turdanoid"/);
  });

  it('first run never blocks play with the modal coach (ten-second rule)', () => {
    const fn = html.slice(
      html.indexOf('function maybeShowCoach'),
      html.indexOf('function updateCoachCard')
    );
    expect(fn).not.toMatch(/coachOverlay/);
    expect(fn).toMatch(/markCoachSeen/);
    expect(fn).toMatch(/arcHint/);
    expect(html).toMatch(/id="arcHint"[^>]*hidden/);
  });
});
