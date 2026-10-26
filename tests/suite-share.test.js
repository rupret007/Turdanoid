import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync('assets/suite-share.js', 'utf8');
const windows = [];
function boot(game = 'turdtris') {
  const dom = new JSDOM('<main></main>', { url: 'https://example.test/StalemateSite/play/' + game + '.html?daily=old&seed=private#old', runScripts: 'outside-only' });
  const w = dom.window; windows.push(w);
  const drawings = [], blobs = [];
  w.HTMLCanvasElement.prototype.getContext = () => ({ fillRect() {}, fillText(text) { drawings.push(text); } });
  w.HTMLCanvasElement.prototype.toBlob = callback => blobs.push(callback);
  w.URL.createObjectURL = vi.fn(() => 'blob:result');
  w.URL.revokeObjectURL = vi.fn();
  w.eval(source);
  const control = w.SuiteShare.create({ host: w.document.querySelector('main'), game });
  const button = w.document.querySelector('button');
  const status = w.document.querySelector('[role=status]');
  return { w, control, button, status, drawings, blobs };
}
afterEach(() => { windows.splice(0).forEach(w => w.close()); });
const flush = async () => { for (let i = 0; i < 5; i++) { await Promise.resolve(); } };

describe('completed score sharing', () => {
  it.each([
    ['turdanoid', { outcome: 'loss', mode: 'boss', score: 1200, levelsCleared: 0, maxCombo: 7 }, 'TurdAnoid.html?mode=boss', 'Boss Flush'],
    ['turdjack', { outcome: 'win', kind: 'hand', net: 7.5, natural: true, wins: 1, losses: 0, pushes: 0 }, 'turdjack.html', 'Natural blackjack'],
    ['crapeights', { outcome: 'win', kind: 'match', difficulty: 'normal', playerScore: 16, target: 200, rounds: 8 }, 'crapeights.html', 'Match won'],
    ['turdrummy', { outcome: 'loss', kind: 'match', difficulty: 'mixed', playerScore: 70, opponentScore: 104, target: 100 }, 'turdrummy.html', 'Mixed strength'],
    ['turdspades', { outcome: 'loss', kind: 'match', difficulty: 'hard', playerScore: -30, opponentScore: 270 }, 'turdspades.html', 'Your team -30'],
    ['chess', { outcome: 'complete', mode: 'local', local: true, winner: 'w', hints: 0, undos: 1, moves: 7, assisted: true }, 'chess.html?mode=local', 'White wins']
  ])('shares completed %s with an honest result and clean project destination', (game, run, destination, detail) => {
    const { w, control, drawings } = boot(game);
    const result = w.SuiteShare.describe(game, run, w.location.href);
    expect(result.url).toBe('https://example.test/StalemateSite/play/' + destination);
    expect(result.text).toContain(detail);
    expect(result.url).not.toMatch(/daily|seed|private|#/);
    control.setResult(run);
    expect(drawings).toContain('STALEMATE ARCADE');
    expect(w.document.querySelector('.suite-result-share').hidden).toBe(false);
    control.setResult(null);
    expect(w.document.querySelector('.suite-result-share').hidden).toBe(true);
  });
  it('labels settled card rounds distinctly from completed matches', () => {
    const { w } = boot('crapeights');
    const result = w.SuiteShare.describe('crapeights', { kind: 'round', outcome: 'win', difficulty: 'easy', playerScore: 0 }, w.location.href);
    expect(result.metric).toBe('Round won');
    expect(result.mode).toContain('round');
    expect(result.text).not.toContain('Match won');
  });
  it('keeps computer chess difficulty and aid usage without claiming a rating', () => {
    const { w } = boot('chess');
    const result = w.SuiteShare.describe('chess', { outcome: 'win', mode: 'computer', difficulty: 'club', assisted: true, hints: 1, undos: 2, moves: 25 }, w.location.href);
    expect(result.url).toBe('https://example.test/StalemateSite/play/chess.html?mode=computer&level=club');
    expect(result.mode).toBe('Club computer · Assisted');
    expect(result.detail).toBe('25 half-moves · 1 hint · 2 takebacks');
    expect(result.text).not.toMatch(/Elo|rated/);
  });
  it('requires a terminal outcome for the new sharing adapters', () => {
    const { w } = boot('chess');
    expect(() => w.SuiteShare.describe('chess', { mode: 'local', moves: 2 }, w.location.href)).toThrow('completed');
    expect(() => w.SuiteShare.describe('not-a-game', { outcome: 'win' }, w.location.href)).toThrow('Unsupported');
  });
  it('never invents a zero net result for a legacy Crapjack deal without a starting bankroll', () => {
    const { w } = boot('turdjack');
    const result = w.SuiteShare.describe('turdjack', { outcome: 'complete', kind: 'hand', wins: 1, losses: 0, pushes: 0 }, w.location.href);
    expect(result.metric).toBe('Deal complete');
    expect(result.detail).toContain('Net not recorded');
    expect(result.text).not.toContain('$0');
  });
  it('uses the accepted first-to-200 Eights rules in its shared result', () => {
    const { w } = boot('crapeights');
    expect(w.SuiteShare.describe('crapeights', { outcome: 'win', kind: 'match', target: 200, playerScore: 210 }, w.location.href).outcome).toBe('First to 200 points');
  });
  it('includes the actual responsive puzzle dimensions in a new completed result', () => {
    const { w } = boot('turdomania');
    const result = w.SuiteShare.describe('turdomania', { score: 1200, level: 'easy', cleared: true, left: 0, cols: 6, rows: 8 }, w.location.href);
    expect(result.detail).toBe('0 tiles left · 6×8 board');
  });
  it('includes a compatible personal improvement in the text and image', () => {
    const { control, drawings, w } = boot();
    const run = { mode: 'classic', score: 500, improvement: '100 points above your previous completed best' };
    control.setResult(run);
    expect(drawings).toContain(run.improvement);
    expect(w.SuiteShare.describe('turdtris', run, w.location.href).text).toContain(run.improvement);
  });
  it.each(['classic', 'sprint', 'ultra'])('keeps the actual %s mode and a clean project-path link', mode => {
    const { w } = boot();
    const result = w.SuiteShare.describe('turdtris', { mode, score: 1234567, lines: 40, elapsedMs: 61234, completed: true }, w.location.href);
    expect(result.url).toBe(`https://example.test/StalemateSite/play/turdtris.html?mode=${mode}`);
    expect(result.text).toContain(mode === 'sprint' ? '1:01.23' : '1,234,567 points');
    expect(result.text).toContain({ classic: 'Classic', sprint: 'Sprint 40L', ultra: 'Ultra 2:00' }[mode]);
  });
  it('labels an unfinished Sprint without claiming a completed 40-line time', () => {
    const { w } = boot();
    const result = w.SuiteShare.describe('turdtris', { mode: 'sprint', score: 400, lines: 12, elapsedMs: 30000 }, w.location.href);
    expect(result.metric).toBe('400 points');
    expect(result.outcome).toBe('Sprint unfinished');
    expect(result.detail).toContain('12 lines');
  });
  it.each(['easy', 'normal', 'hard'])('shares the actual puzzle %s difficulty and clear outcome', level => {
    const { w } = boot('turdomania');
    const result = w.SuiteShare.describe('turdomania', { level, score: 12345, left: 0, cleared: true }, w.location.href);
    expect(result.url).toBe(`https://example.test/StalemateSite/play/turdomania.html?level=${level}`);
    expect(result.text).toContain('12,345 points');
    expect(result.outcome).toBe('Board cleared');
  });
  it('uses allowlisted defaults, finite scores and root-path URLs', () => {
    const { w } = boot();
    const result = w.SuiteShare.describe('turdtris', { mode: '<script>', score: Infinity }, 'https://example.test/turdtris.html?score=999');
    expect(result.url).toBe('https://example.test/turdtris.html?mode=classic');
    expect(result.metric).toBe('0 points');
  });
  it('prepares a branded image and shares the file with the destination in its text', async () => {
    const { w, control, button, status, drawings, blobs } = boot();
    w.navigator.canShare = vi.fn(() => true);
    w.navigator.share = vi.fn(() => Promise.resolve());
    control.setResult({ mode: 'ultra', score: 4567, lines: 23, elapsedMs: 120000, completed: true });
    blobs[0](new w.Blob(['image'], { type: 'image/png' }));
    expect(drawings).toContain('STALEMATE ARCADE');
    expect(drawings).toContain('4,567 points');
    expect(drawings).toContain('Ultra 2:00');
    button.click();
    // Native share is called inside the original click, before the first await.
    expect(w.navigator.share).toHaveBeenCalledTimes(1);
    const payload = w.navigator.share.mock.calls[0][0];
    expect(payload.files[0].name).toBe('turdtris-score.png');
    expect(payload.text).toContain('https://example.test/StalemateSite/play/turdtris.html?mode=ultra');
    await flush(); expect(status.textContent).toBe('Shared.');
  });
  it('shares text immediately when the image is not ready and never opens the sheet automatically', async () => {
    const { w, control, button } = boot();
    w.navigator.share = vi.fn(() => Promise.resolve());
    control.setResult({ mode: 'sprint', score: 3 });
    expect(w.navigator.share).not.toHaveBeenCalled();
    button.click();
    expect(w.navigator.share.mock.calls[0][0].url).toContain('?mode=sprint');
    expect(w.navigator.share.mock.calls[0][0].files).toBeUndefined();
    await flush();
  });
  it('keeps cancellation deliberate without copying a cancelled result', async () => {
    const { w, control, button, status } = boot();
    w.navigator.share = vi.fn(() => Promise.reject(new w.DOMException('cancelled', 'AbortError')));
    Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: vi.fn() } });
    control.setResult({ score: 20 }); button.click(); await flush();
    expect(status.textContent).toBe('Sharing cancelled.');
    expect(w.navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
  });
  it('copies the score and mode link when sharing fails', async () => {
    const { w, control, button, status } = boot('turdomania');
    w.navigator.share = () => Promise.reject(new Error('not supported'));
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(w.navigator, 'clipboard', { value: { writeText } });
    control.setResult({ score: 12345, level: 'hard', left: 8 }); button.click(); await flush();
    expect(writeText.mock.calls[0][0]).toContain('Turdomania · Hard: 12,345 points. No moves left. 8 tiles left.');
    expect(writeText.mock.calls[0][0]).toContain('?level=hard');
    expect(status.textContent).toBe('Score and game link copied.');
  });
  it('offers selectable text if clipboard access is denied', async () => {
    const { w, control, button, status } = boot();
    Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) } });
    control.setResult({ score: 123 }); button.click(); await flush();
    const fallback = w.document.querySelector('textarea');
    expect(fallback.hidden).toBe(false);
    expect(fallback.value).toContain('123 points');
    expect(w.document.activeElement).toBe(fallback);
    expect(status.textContent).toContain('Select and copy');
  });
  it('invalidates late image and clipboard results after undo/replay', async () => {
    const { w, control, button, status, blobs } = boot();
    let resolve;
    Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: () => new Promise(r => { resolve = r; }) } });
    control.setResult({ score: 123 }); button.click();
    control.setResult(null);
    blobs[0](new w.Blob(['old image'])); resolve(); await flush();
    expect(w.document.querySelector('.suite-result-share').hidden).toBe(true);
    expect(w.document.querySelector('a').hidden).toBe(true);
    expect(status.textContent).toBe('');
  });
  it('revokes the previous image and does not rebuild an unchanged completed result', () => {
    const { w, control, blobs, status } = boot();
    control.setResult({ score: 5 }); blobs[0](new w.Blob(['image']));
    status.textContent = 'Shared.'; control.setResult({ score: 5 });
    expect(blobs).toHaveLength(1); expect(status.textContent).toBe('Shared.');
    control.setResult({ score: 6 });
    expect(w.URL.revokeObjectURL).toHaveBeenCalledWith('blob:result');
    expect(status.textContent).toBe('');
  });
  it('keeps keyboard activation inside sharing instead of replaying the game', () => {
    const { w, control, button } = boot();
    const replay = vi.fn(); w.document.addEventListener('keydown', replay);
    control.setResult({ score: 1 });
    button.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'Enter', bubbles: true }));
    expect(replay).not.toHaveBeenCalled();
  });
});
