import { describe, expect, it } from 'vitest';
import { loadContinue, rememberContinue, validateSnapshot } from '../games/table-continue.js';
import { validEightsSnapshot, validJackSnapshot, validRummySnapshot, validSpadesSnapshot } from './continue-fixtures.js';

const cases = [['crapeights', validEightsSnapshot], ['turdjack', validJackSnapshot],
  ['turdrummy', validRummySnapshot], ['turdspades', validSpadesSnapshot]];
const metadata = game => ({ v: 1, id: `p1.testnamespace.${game}.1`, roundId: `p1.testnamespace.${game}.2`, difficulty: 'mixed',
  pending: [{ id: `p1.testnamespace.${game}.2`, game, mode: 'standard', difficulty: 'mixed', kind: 'round',
    outcome: 'win', history: false, gin: game === 'turdrummy', score: 20, roundWon: true }] });

describe('optional progress identities in existing Continue snapshots', () => {
  it.each(cases)('preserves %s identities and pending outcomes through write/read without changing old game data', (game, fixture) => {
    const original = fixture();
    const snapshot = { ...original, progressMeta: metadata(game) };
    const data = new Map();
    const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
    expect(rememberContinue(storage, `${game}.html`, snapshot)).toBe(true);
    const restored = loadContinue(storage, `${game}.html`);
    expect(restored.progressMeta).toEqual(snapshot.progressMeta);
    const { progressMeta, ...gameData } = restored;
    expect(progressMeta.id).toBe(snapshot.progressMeta.id);
    expect(gameData).toEqual(validateSnapshot(`${game}.html`, original));
  });

  it.each([
    meta => ({ ...meta, id: 'bad' }),
    meta => ({ ...meta, difficulty: '<script>' }),
    meta => ({ ...meta, roundId: 'p1.testnamespace.chess.2' }),
    meta => ({ ...meta, pending: [...meta.pending, ...meta.pending, ...meta.pending] }),
    meta => ({ ...meta, pending: [{ ...meta.pending[0], id: 'p1.testnamespace.crapeights.99' }] }),
    meta => ({ ...meta, pending: [{ ...meta.pending[0], game: 'turdspades' }] }),
    meta => ({ ...meta, pending: [{ ...meta.pending[0], score: Infinity }] }),
    meta => ({ ...meta, pending: [{ ...meta.pending[0], history: 'false' }] }),
    meta => ({ ...meta, pending: [{ ...meta.pending[0], mode: 'not a valid slug' }] }),
    meta => ({ ...meta, startBankroll: Infinity })
  ])('discards corrupt progress metadata while retaining a valid playable game', mutate => {
    const original = validEightsSnapshot();
    const restored = validateSnapshot('crapeights.html', { ...original, progressMeta: mutate(metadata('crapeights')) });
    expect(restored).toEqual(validateSnapshot('crapeights.html', original));
    expect(restored).not.toHaveProperty('progressMeta');
  });
});
