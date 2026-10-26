import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

const core = readFileSync('games/suite-progress-core.js', 'utf8');
const runtime = readFileSync('assets/suite-progress.js', 'utf8');
const pages = [];
function memoryStorage(seed = {}) {
  const data = { ...seed };
  return { data, getItem: key => data[key] ?? null, setItem: (key, value) => { data[key] = String(value); } };
}
function boot(storage = memoryStorage(), deny = false) {
  const dom = new JSDOM('<main><a id="game" href="turdtris.html">Play Turdtris</a><div id="progress"></div></main>', { url: 'https://example.test/project/play/', runScripts: 'outside-only', pretendToBeVisual: true });
  pages.push(dom); const w = dom.window;
  Object.defineProperty(w, 'localStorage', { get() { if (deny) { throw new w.DOMException('Denied', 'SecurityError'); } return storage; } });
  w.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
  w.HTMLDialogElement.prototype.close = function() { this.open = false; };
  w.eval(core); w.eval(runtime);
  return { w, api: w.SuiteProgress, storage };
}
afterEach(() => { pages.splice(0).forEach(page => page.window.close()); });

describe('synchronous optional progress runtime and view', () => {
  it('records synchronously, deduplicates after a fresh document and leaves game stores untouched', () => {
    const storage = memoryStorage({ turdtrisHighScore: '12345', privateGameSave: 'untouched' });
    const first = boot(storage); const id = first.api.newRunId('turdtris');
    const event = { id, game: 'turdtris', kind: 'run', outcome: 'loss', mode: 'classic', lines: 10, score: 500 };
    expect(first.api.record(event)).toMatchObject({ recorded: true, storageAvailable: true, improvement: null });
    expect(storage.data.arcade_progress_v1).toContain(id);
    const second = boot(storage);
    expect(second.api.record(event)).toMatchObject({ recorded: false, newlyEarned: [] });
    expect(second.api.snapshot().history.turdtris).toHaveLength(1);
    expect(storage.data.turdtrisHighScore).toBe('12345'); expect(storage.data.privateGameSave).toBe('untouched');
    expect(second.api.newRunId('turdtris')).not.toBe(id);
  });

  it.each(['getter', 'read', 'write'])('keeps games usable and in-page progress honest when storage %s fails', phase => {
    const storage = memoryStorage();
    if (phase === 'read') { storage.getItem = () => { throw new Error('Denied'); }; }
    if (phase === 'write') { storage.setItem = () => { throw new Error('Quota'); }; }
    const { w, api } = boot(storage, phase === 'getter');
    const id = api.newRunId('turdomania'); expect(id).toMatch(/^p1\./);
    const event = { id, game: 'turdomania', kind: 'run', outcome: 'complete', cleared: true, left: 0, score: 1000 };
    expect(api.record(event)).toMatchObject({ recorded: true, storageAvailable: false });
    expect(api.record(event).newlyEarned).toHaveLength(0);
    const view = api.mountHub({ host: w.document.getElementById('progress') }); view.opener.click();
    expect(view.dialog.textContent).toContain('Progress is kept for this visit only');
    expect(w.document.getElementById('game').href).toBe('https://example.test/project/play/turdtris.html');
  });

  it('shows corrupt-progress recovery without changing existing game records or inventing history', () => {
    const { w, api, storage } = boot(memoryStorage({ arcade_progress_v1: '{broken', turdtrisSprint40BestMs_v1: '60000' }));
    const view = api.mountHub({ host: w.document.getElementById('progress') }); view.opener.click();
    expect(view.dialog.textContent).toContain('Saved progress could not be read');
    expect(view.dialog.textContent).toContain('Earned · from existing records');
    expect(api.snapshot().history).toEqual({});
    expect(storage.data.turdtrisSprint40BestMs_v1).toBe('60000');
  });

  it('never auto-opens a progress view or steals game focus on a completion', () => {
    const { w, api } = boot(); const view = api.mountHub({ host: w.document.getElementById('progress') });
    w.document.getElementById('game').focus();
    api.record({ id: api.newRunId('chess'), game: 'chess', kind: 'match', outcome: 'win', local: true, assisted: true, completed: true, moves: 7 });
    expect(view.dialog.open).toBe(false); expect(w.document.activeElement.id).toBe('game');
    expect(w.document.querySelectorAll('dialog')).toHaveLength(1);
    expect(api.mountHub({ host: w.document.getElementById('progress') })).toBeNull();
  });

  it('chooses and persists a goal with the real Sprint mode link and restores Close focus', () => {
    const { w, api, storage } = boot(); const view = api.mountHub({ host: w.document.getElementById('progress') });
    view.opener.click(); expect(w.document.activeElement.textContent).toBe('Close');
    w.document.getElementById('progress-goal-tt-sprint').click();
    expect(api.snapshot().selectedGoal).toBe('tt-sprint');
    expect(w.document.querySelector('.suite-progress-target a').href).toBe('https://example.test/project/play/turdtris.html?mode=sprint');
    expect(w.document.activeElement.id).toBe('progress-goal-tt-sprint');
    expect(boot(storage).api.snapshot().selectedGoal).toBe('tt-sprint');
    view.dialog.dispatchEvent(new w.Event('cancel', { cancelable: true }));
    expect(view.dialog.open).toBe(false); expect(w.document.activeElement).toBe(view.opener);
  });

  it('uses actual existing record summaries and text nodes for record content', () => {
    const { w, api } = boot(); const view = api.mountHub({ host: w.document.getElementById('progress'), recordFor: id => id === 'turdtris' ? 'Classic best 12,345 · Sprint best 1:00.0' : '<img src=x onerror=alert(1)>' });
    view.opener.click(); w.document.getElementById('progress-panel-records').click();
    expect(view.dialog.textContent).toContain('Classic best 12,345 · Sprint best 1:00.0');
    expect(view.dialog.querySelector('img')).toBeNull();
    expect(view.dialog.querySelectorAll('dl > div')).toHaveLength(8);
  });

  it('lists only real recorded results, labels casual/local/aided chess and filters by game', () => {
    const { w, api } = boot(memoryStorage({ turdjackStats: '{"wins":999}' }));
    api.record({ id: api.newRunId('chess'), game: 'chess', kind: 'match', outcome: 'win', moves: 7, local: true, assisted: true, completed: true });
    api.record({ id: api.newRunId('turdomania'), game: 'turdomania', kind: 'run', outcome: 'loss', mode: 'hard', difficulty: 'hard', score: 20, cleared: false, left: 2 });
    const view = api.mountHub({ host: w.document.getElementById('progress') }); view.opener.click(); w.document.getElementById('progress-panel-recent').click();
    expect(view.dialog.querySelectorAll('.suite-progress-history li')).toHaveLength(2);
    expect(view.dialog.textContent).toContain('Local two-player'); expect(view.dialog.textContent).toContain('Hints / takebacks used');
    const filter = w.document.getElementById('progress-game-filter'); filter.value = 'chess'; filter.dispatchEvent(new w.Event('change'));
    expect(view.dialog.querySelectorAll('.suite-progress-history li')).toHaveLength(1);
    expect(api.snapshot().history.turdjack).toBeUndefined();
    expect(view.dialog.querySelectorAll('svg')).toHaveLength(0);
  });

  it('renders twelve original SVG badge icons with readable names and criteria', () => {
    const { w, api } = boot(); const view = api.mountHub({ host: w.document.getElementById('progress') }); view.opener.click();
    const badges = view.dialog.querySelectorAll('.suite-progress-goals li');
    expect(badges).toHaveLength(12);
    expect([...badges].every(item => item.querySelector('svg[aria-hidden=true] path') && item.querySelector('h4').textContent && item.querySelector('p').textContent)).toBe(true);
    expect(new Set([...badges].map(item => item.querySelector('svg g').innerHTML)).size).toBe(12);
  });

  it('shows accessible partial progress from completed runs in both the badge and selected goal', () => {
    const { w, api } = boot();
    api.record({ id: api.newRunId('turdtris'), game: 'turdtris', kind: 'run', outcome: 'loss', mode: 'classic', lines: 7, score: 200 });
    api.chooseGoal('tt-lines');
    const view = api.mountHub({ host: w.document.getElementById('progress') }); view.opener.click();
    const bar = view.dialog.querySelector('.suite-progress-target progress');
    expect(bar.value).toBe(7); expect(bar.max).toBe(10);
    expect(bar.getAttribute('aria-label')).toBe('Classic lines: 7 / 10, from completed runs');
    expect(view.dialog.textContent).toContain('Best from completed runs');
    expect(view.dialog.textContent).toContain('Not earned');
  });

  it('labels the actual local chess winner or draw and uses singular half-move for one', () => {
    const { api } = boot();
    const result = { game: 'chess', local: true, kind: 'match', outcome: 'complete', moves: 1, completed: true, reason: 'Resignation' };
    const black = api.record({ ...result, id: api.newRunId('chess'), winner: 'b' });
    expect(api.describeEvent(black.entry)).toBe('Local two-player · Black wins · 1 half-move · Resignation');
    expect(api.describeEvent({ ...black.entry, winner: 'w' })).toContain('White wins');
    expect(api.describeEvent({ ...black.entry, winner: null, reason: 'Stalemate', moves: 8 })).toContain('Draw · 8 half-moves · Stalemate');
    const localAided = api.describeEvent({ ...black.entry, difficulty: 'unknown', assisted: true, hints: 1, undos: 1 });
    expect(localAided).toContain('Black wins · 1 half-move · Resignation · Hints / takebacks used');
    expect(localAided).not.toContain('Difficulty');
    expect(api.describeEvent({ ...black.entry, local: false, difficulty: 'friendly' })).toContain('Difficulty: friendly');
    expect(api.describeEvent({ game: 'turdomania', cleared: true, cols: 8, rows: 10, left: 0, score: 1000, difficulty: 'normal' })).toContain('8×10 board');
  });
});
