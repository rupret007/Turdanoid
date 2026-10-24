import { describe, it, expect } from 'vitest';
import { Chess, createGame, playMove, automaticResult, claimReason, intendedClaims, claimDraw, repetitions,
  resign, undoTurn, restore, snapshot, saveGame, loadGame, recordResult, readResults, SAVE_KEY, exportPgn } from '../games/chess-core.js';
const memory = () => { const map = new Map(); return { getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value) }; };
const sequence = (game, moves) => { for (const move of moves.split(' ')) { playMove(game, move); } return game; };
const perft = (chess, depth) => {
  if (!depth) { return 1; }
  let nodes = 0;
  for (const move of chess.moves({ verbose: true })) { chess.move(move); nodes += perft(chess, depth - 1); chess.undo(); }
  return nodes;
};
describe('chess rule integration', () => {
  it('matches start and Kiwipete perft, including castling and pins', () => {
    const start = new Chess();
    expect(perft(start, 1)).toBe(20); expect(perft(start, 2)).toBe(400); expect(perft(start, 3)).toBe(8902);
    const kiwi = new Chess('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    expect(perft(kiwi, 1)).toBe(48); expect(perft(kiwi, 2)).toBe(2039);
  });
  it('rejects impossible moves and castling through check', () => {
    expect(() => playMove(createGame(), 'e2e5')).toThrow();
    const game = createGame({ fen: 'r3k2r/8/8/8/2b5/8/8/R3K2R w KQkq - 0 1' });
    expect(game.chess.moves()).not.toContain('O-O');
    expect(game.chess.moves()).toContain('O-O-O');
  });
  it('enforces immediate en passant and king safety', () => {
    const game = sequence(createGame(), 'e2e4 a7a6 e4e5 d7d5');
    expect(game.chess.moves()).toContain('exd6');
    sequence(game, 'h2h3 a6a5'); expect(game.chess.moves()).not.toContain('exd6');
    const pinned = new Chess('4r1k1/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    expect(pinned.moves()).not.toContain('exd6');
  });
  it.each(['q', 'r', 'b', 'n'])('supports promotion to %s', piece => {
    const game = createGame({ fen: '7k/P7/8/8/8/8/8/7K w - - 0 1' });
    playMove(game, 'a7a8' + piece); expect(game.chess.get('a8').type).toBe(piece);
  });
  it('distinguishes checkmate, stalemate and standard material draws', () => {
    const mate = sequence(createGame(), 'f2f3 e7e5 g2g4 d8h4');
    expect(mate.result).toEqual({ winner: 'b', reason: 'Checkmate' });
    expect(automaticResult(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).reason).toBe('Stalemate');
    expect(automaticResult(new Chess('7k/8/8/8/8/8/8/KB6 w - - 0 1')).reason).toBe('Insufficient material');
    // Two knights can deliver a cooperative mate, so don't call it insufficient.
    expect(automaticResult(new Chess('7k/8/8/8/8/8/8/KNN5 w - - 0 1'))).toBeNull();
  });
  it('keeps a third repetition claimable, allows an intended claim, stops at five', () => {
    const game = sequence(createGame(), 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1');
    const before = game.chess.fen();
    expect(intendedClaims(game.chess)).toContainEqual({ move: 'f6g8', san: 'Ng8', reason: 'Threefold repetition' });
    expect(game.chess.fen()).toBe(before);
    const claiming = createGame(); sequence(claiming, game.chess.history({ verbose: true }).map(move => move.lan).join(' '));
    expect(claimDraw(claiming, 'f6g8')).toBe(true); expect(claiming.chess.fen()).toBe(before);
    playMove(game, 'f6g8'); expect(game.result).toBeNull(); expect(claimReason(game.chess)).toBe('Threefold repetition');
    expect(repetitions(game.chess)).toBe(3);
    sequence(game, 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1 f6g8');
    expect(game.result).toEqual({ winner: null, reason: 'Fivefold repetition' });
  });
  it('distinguishes 50/75 moves and gives checkmate precedence', () => {
    const game = createGame({ fen: '7k/8/8/8/8/8/R7/K7 w - - 99 51' });
    expect(intendedClaims(game.chess).length).toBeGreaterThan(0); playMove(game, 'a2b2');
    expect(game.result).toBeNull(); expect(claimReason(game.chess)).toBe('50-move rule'); expect(claimDraw(game)).toBe(true);
    const automatic = createGame({ fen: '7k/8/8/8/8/8/R7/K7 w - - 149 76' });
    playMove(automatic, 'a2b2'); expect(automatic.result.reason).toBe('75-move rule');
    const mate = createGame({ fen: '7k/5K2/6Q1/8/8/8/8/8 w - - 149 76' });
    playMove(mate, 'g6g7'); expect(mate.result.reason).toBe('Checkmate');
  });
  it('does not merge positions with different castling or en passant rights', () => {
    const game = sequence(createGame(), 'h2h4 h7h5 h1h3 h8h6 h3h1 h6h8');
    expect(repetitions(game.chess)).toBe(1);
  });
});
describe('practice and persistence', () => {
  it('undoes an answered turn, a pending move, or one local move', () => {
    const game = sequence(createGame(), 'e2e4 e7e5'); expect(undoTurn(game)).toBe(2);
    playMove(game, 'd2d4'); expect(undoTurn(game)).toBe(1);
    const local = sequence(createGame({ mode: 'local' }), 'e2e4 e7e5'); expect(undoTurn(local)).toBe(1);
  });
  it('roundtrips legal moves, settings and aids without touching old keys', () => {
    const store = memory(); store.setItem('turdsuite_continue_v1', 'old');
    const game = sequence(createGame({ side: 'b', level: 'club' }), 'e2e4 e7e5'); game.hints = 2; game.flipped = true;
    expect(saveGame(store, game)).toBe(true);
    const continued = loadGame(store); expect(snapshot(continued)).toEqual(snapshot(game));
    expect(store.getItem('turdsuite_continue_v1')).toBe('old');
  });
  it('rejects corrupt, oversized and invalid or post-terminal move sequences', () => {
    expect(restore('{')).toBeNull(); expect(restore('x'.repeat(240001))).toBeNull();
    const data = snapshot(createGame()); data.moves = ['e2e5']; expect(restore(data)).toBeNull();
    data.moves = ['f2f3', 'e7e5', 'g2g4', 'd8h4', 'a2a3']; expect(restore(data)).toBeNull();
    data.moves = []; data.result = { winner: 'w', reason: 'Checkmate' }; expect(restore(data)).toBeNull();
  });
  it('handles denied storage and records each result once across reload', () => {
    const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    expect(loadGame(denied)).toBeNull(); expect(saveGame(denied, createGame())).toBe(false);
    const store = memory(); const game = sequence(createGame(), 'f2f3 e7e5 g2g4 d8h4'); game.hints = 1;
    saveGame(store, game); expect(recordResult(store, game)).toBe(true); recordResult(store, loadGame(store));
    expect(readResults(store)).toMatchObject({ wins: 0, losses: 1, assisted: 1 });
    expect(recordResult(denied, game)).toBe(false);
    expect(store.getItem(SAVE_KEY)).toBeTruthy();
  });
  it('does not award a resignation win to a bare king', () => {
    const game = createGame({ fen: '7k/8/8/8/8/8/R7/K7 w - - 0 1' });
    resign(game); expect(game.result.winner).toBeNull();
  });
  it('restores claimed/resigned games and exports honest result headers', () => {
    const game = sequence(createGame(), 'e2e4 e7e5'); resign(game);
    expect(restore(snapshot(game)).result.reason).toBe('Resignation'); expect(undoTurn(game)).toBe(0);
    expect(exportPgn(game)).toContain('[Result "0-1"]'); expect(exportPgn(game)).toContain('1. e4 e5');
    expect(exportPgn(game)).not.toContain('Elo');
  });
});
