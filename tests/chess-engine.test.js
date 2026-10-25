import { describe, it, expect, vi } from 'vitest';
import { ChessEngine } from '../games/chess-engine.js';
import { LEVELS } from '../games/chess-core.js';
const worker = () => ({ postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null });
const send = (target, data) => target.onmessage({ data });
describe('bounded chess worker', () => {
  it.each(Object.keys(LEVELS))('uses real %s settings, then releases its warm worker on cancellation', async level => {
    const target = worker(); const engine = new ChessEngine({ workerFactory: () => target });
    const result = engine.search(['e2e4'], level);
    send(target, 'uciok'); send(target, 'readyok');
    expect(target.postMessage).toHaveBeenCalledWith(`setoption name Skill Level value ${LEVELS[level].skill}`);
    expect(target.postMessage).toHaveBeenCalledWith(`go depth ${LEVELS[level].depth} movetime ${LEVELS[level].ms}`);
    expect(target.postMessage).toHaveBeenCalledWith('position startpos moves e2e4');
    send(target, 'bestmove e7e5 ponder g1f3'); expect(await result).toBe('e7e5'); expect(target.terminate).not.toHaveBeenCalled();
    engine.cancel(); expect(target.terminate).toHaveBeenCalledOnce();
  });
  it('reuses a completed worker for subsequent turns without another download', async () => {
    const target = worker(); const factory = vi.fn(() => target);
    const engine = new ChessEngine({ workerFactory: factory });
    const first = engine.search([]); send(target, 'uciok'); send(target, 'readyok'); send(target, 'bestmove e2e4'); await first;
    const next = engine.search(['e2e4']); send(target, 'uciok'); send(target, 'readyok'); send(target, 'bestmove e7e5');
    expect(await next).toBe('e7e5'); expect(factory).toHaveBeenCalledOnce();
    engine.cancel(); expect(target.terminate).toHaveBeenCalledOnce();
  });
  it('rejects stale output after cancellation and replacement', async () => {
    const first = worker(), second = worker(); let calls = 0;
    const engine = new ChessEngine({ workerFactory: () => calls++ ? second : first });
    const old = engine.search([]); const fresh = engine.search(['d2d4']);
    expect(await old).toBeNull(); expect(first.terminate).toHaveBeenCalledOnce();
    send(first, 'uciok'); send(first, 'bestmove a2a3');
    send(second, 'uciok'); send(second, 'readyok'); send(second, 'bestmove d7d5');
    expect(await fresh).toBe('d7d5'); engine.cancel();
  });
  it('recovers from a load failure or hard timeout without leaving a worker', async () => {
    vi.useFakeTimers();
    const target = worker(); const engine = new ChessEngine({ workerFactory: () => target, timeout: 100 });
    const pending = engine.search([]); const assertion = expect(pending).rejects.toThrow('too long');
    await vi.advanceTimersByTimeAsync(101); await assertion; expect(target.terminate).toHaveBeenCalledOnce();
    const failed = engine.search([]); const failure = expect(failed).rejects.toThrow('could not load'); target.onerror({ preventDefault() {} }); await failure;
    vi.useRealTimers();
  });
});
