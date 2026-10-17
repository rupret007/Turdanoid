import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio, meetsContrast, TOKENS } from '../games/turdanoid-theme.js';
import { hudMetrics } from '../games/turdanoid-layout.js';

const html = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'TurdAnoid.html'),
  'utf8'
);

function tracking(selectorFragment) {
  const re = new RegExp(`${selectorFragment}[^\\{]*\\{[^}]*letter-spacing:([0-9.]+)em`);
  const m = html.match(re);
  return m ? Number(m[1]) : null;
}

describe('Turdanoid HUD and menu chrome', () => {
  it('keeps HUD and button tracking readable', () => {
    expect(tracking('\\.hud')).toBeLessThanOrEqual(0.04);
    expect(tracking('\\.hud \\.lbl')).toBeLessThanOrEqual(0.1);
    expect(tracking('\\.overlay button')).toBeLessThanOrEqual(0.08);
    expect(html).toContain('@media (max-width:520px)');
    expect(html).toContain('calc(env(safe-area-inset-left, 0px) + 68px)');
  });

  it('uses brass primary buttons with dark ink that still contrast', () => {
    expect(html).toContain('var(--ta-brass,#e8c56a)');
    expect(meetsContrast('#1a1408', TOKENS.brass, 4.5)).toBe(true);
    expect(contrastRatio(TOKENS.inkText, TOKENS.inkDeep)).toBeGreaterThanOrEqual(7);
  });

  it('matches CSS reserves to hudMetrics on phones and desktop', () => {
    expect(hudMetrics(320).left).toBeGreaterThanOrEqual(68);
    expect(hudMetrics(390).minTap).toBe(44);
    expect(hudMetrics(1280).left).toBe(10);
  });

  it('does not restore an inner lives margin under the 420px or 360px rules', () => {
    const block = (max) => {
      const re = new RegExp(`@media \\(max-width:${max}px\\)\\{([\\s\\S]*?)\\n  \\}`);
      const m = html.match(re);
      return m ? m[1] : '';
    };
    const phone = block(520);
    const compact = block(420);
    const tiny = block(360);
    expect(phone).toMatch(/\.hud\{[^}]*right:108px/);
    expect(phone).toMatch(/\.hud \.right[^{]*\{[^}]*margin-right:0/);
    expect(compact).toMatch(/\.hud \.right[^{]*\{[^}]*margin-right:0/);
    expect(tiny).toMatch(/\.hud \.right[^{]*\{[^}]*margin-right:0/);
    expect(compact).not.toMatch(/\.hud \.right\{margin-right:(?:9|10)\d+px/);
    expect(tiny).not.toMatch(/\.hud \.right\{margin-right:(?:9|10)\d+px/);
    for (const width of [360, 390, 430]) {
      expect(hudMetrics(width).innerRightMargin).toBe(0);
      expect(hudMetrics(width).right).toBe(108);
    }
  });

  it('stages the title as a poster with a kicker and staggered entrance', () => {
    expect(html).toContain('title-poster');
    expect(html).toContain('title-kicker');
    expect(html).toContain('Midnight Porcelain Arcade');
    expect(html).toContain('@keyframes riseIn');
    expect(html).toContain('@keyframes ctaPulse');
    expect(html).toContain('#playShell:has(#titleScreen.show) .hud');
    expect(html).toMatch(/prefers-reduced-motion:reduce[\s\S]*\.overlay\.show > \*/);
  });

  it('fades overlays with inert hidden screens so focus cannot leak', () => {
    expect(html).toMatch(/\.overlay\{[^}]*visibility:hidden/);
    expect(html).toContain('id="pauseScreen" inert');
    expect(html).toContain('id="howScreen" inert');
    expect(html).toContain('id="endScreen" inert');
  });

  it('keeps phone HUD labels visible and uses porcelain life pips', () => {
    expect(html).toContain('class="life-pip"');
    expect(html).toContain('data-count="3"');
    expect(html).toContain('#playShell:has(#pauseScreen.show) .hud');
    expect(html).toContain('.hype-kicker');
    expect(html).toContain('.life-pip{');
    expect(html).not.toMatch(/\.hud \.lbl\{position:absolute;width:1px/);
    expect(html).toMatch(/prefers-reduced-motion:reduce[\s\S]*#hype[\s\S]*#toast/);
  });

  it('keeps the play field clean: no stage props between paddle and bricks', () => {
    expect(html).toContain("const introDecor = state === 'title';");
    expect(html).toContain('if(!introDecor) paintCleanField(W, H);');
    expect(html).not.toContain('playWallTint');
    const decor = html.slice(
      html.indexOf('  if(introDecor){'),
      html.indexOf('// Sludge surface along the bottom edge')
    );
    for (const prop of [
      'paintWorldStage',
      'paintAtmosphere(',
      'TSPRITE.paintPipe(',
      'fillStyle = wallPattern',
      'worldBubbleColor'
    ]) {
      expect(decor).toContain(prop);
      expect(html.split(prop).length - 1).toBe(decor.split(prop).length - 1);
    }
    expect(html).toContain('worldBasinColors');
    expect(html).toContain('worldDripColors');
    expect(html).toContain('qaJumpLevel');
    expect(html).not.toContain('rgba(158,255,200,.55)');
    expect(html).not.toContain("ctx.strokeStyle = 'rgba(158,255,200,0.16)'");
  });

  it('glazes HUD chips with a brass hairline', () => {
    expect(html).toContain('0 0 0 1px rgba(232,197,106,.26)');
    expect(html).toContain('rgba(255,248,220,.12)');
    expect(html).toContain('inset 0 1px 0 rgba(255,255,255,.85)');
  });

  it('stages result, tally, and how-to screens as porcelain posters', () => {
    expect(html).toContain('result-kicker');
    expect(html).toContain('id="endKicker"');
    expect(html).toContain('#endScreen.is-win');
    expect(html).toContain('#endScreen.is-loss');
    expect(html).toContain('tally-card');
    expect(html).toContain('Stage bonus');
    expect(html).toContain('how-grid');
    expect(html).toContain('House rules');
    expect(html).toContain('#playShell:has(#endScreen.show) .hud');
    expect(html).toContain('#playShell:has(#clearTally.show) .hud');
    expect(html).toContain('#playShell:has(#howScreen.show) .hud');
  });
});
