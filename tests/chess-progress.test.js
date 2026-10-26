import { describe, expect, it } from 'vitest';
import { createGame, playMove, restore, snapshot } from '../games/chess-core.js';

describe('chess progress identity preserves existing saved positions', () => {
  it('keeps the separately allocated progress identity through moves and restore', () => {
    const game = createGame({ mode: 'local' });
    game.progressId = 'p1.testnamespace.chess.19';
    playMove(game, 'e2e4');
    const loaded = restore(snapshot(game));
    expect(loaded.progressId).toBe(game.progressId);
    expect(loaded.id).toBe(game.id);
    expect(loaded.chess.fen()).toBe(game.chess.fen());
  });
  it('keeps old saves playable without manufacturing a progress identity', () => {
    const game = createGame({ mode: 'computer' });
    playMove(game, 'e2e4');
    const loaded = restore(snapshot(game));
    expect(loaded.chess.fen()).toBe(game.chess.fen());
    expect(loaded).not.toHaveProperty('progressId');
  });
  it.each(['<script>', 'p1.testnamespace.turdtris.1', 'p1.testnamespace.chess.0', 'p1.testnamespace.chess.9999999999999999'])('ignores damaged optional identity %s without losing the chess game', progressId => {
    const game = createGame({ mode: 'local' });
    playMove(game, 'e2e4');
    const loaded = restore({ ...snapshot(game), progressId });
    expect(loaded.chess.fen()).toBe(game.chess.fen());
    expect(loaded).not.toHaveProperty('progressId');
  });
});
