import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import {
  decorateHubStatBadges,
  parseSafeInt,
  readHubStatBadge
} from '../assets/suite-hub-stats.js';

describe('suite-hub-stats', () => {
  it('parseSafeInt rejects junk', () => {
    expect(parseSafeInt('12')).toBe(12);
    expect(parseSafeInt('<script>1</script>', 0)).toBe(0);
    expect(parseSafeInt(undefined, 3)).toBe(3);
  });

  it('reads TurdAnoid best without writing storage', () => {
    const getItem = (k) => (k === 'turdanoid_v2_best' ? '4200' : null);
    expect(readHubStatBadge(getItem, 'TurdAnoid.html')?.text).toBe('Best 4,200');
    expect(readHubStatBadge(getItem, 'turdspades.html')).toBeNull();
  });

  it('reads TurdAnoid boss best alongside arcade best', () => {
    const getItem = (k) => {
      if (k === 'turdanoid_v2_best') { return '1000'; }
      if (k === 'turdanoid_boss_best_v1') { return '2500'; }
      return null;
    };
    expect(readHubStatBadge(getItem, 'TurdAnoid.html')?.text).toBe('Best 1,000 · Boss 2,500');
  });

  it('tolerates malformed turdrummy_stats_v1', () => {
    const getItem = (k) => (k === 'turdrummy_stats_v1' ? '{not json' : null);
    expect(readHubStatBadge(getItem, 'turdrummy.html')).toBeNull();
  });

  it('reads optional turdspades_stats_v1', () => {
    const getItem = (k) =>
      (k === 'turdspades_stats_v1' ? JSON.stringify({ matchesWon: 1, matchesPlayed: 3 }) : null);
    expect(readHubStatBadge(getItem, 'turdspades.html')?.text).toBe('1 match win');
  });

  it('reads Crapjack bankroll and Eights wins', () => {
    const store = {
      turdjackBankroll: '250',
      turdjackStats: JSON.stringify({ wins: 3 }),
      crapeightsStats: JSON.stringify({ matchesWon: 2, matchesPlayed: 5 })
    };
    const getItem = (k) => store[k] ?? null;
    expect(readHubStatBadge(getItem, 'turdjack.html')?.text).toBe('$250');
    expect(readHubStatBadge(getItem, 'crapeights.html')?.text).toBe('2 match wins');
  });

  it('decorates hub cards with stat chips', () => {
    const dom = new JSDOM(
      '<a href="turdtris.html" class="game-card"><div class="game-info"><h2>T</h2></div></a>'
    );
    const doc = dom.window.document;
    decorateHubStatBadges(doc, {
      getItem: (k) => (k === 'turdtrisHighScore' ? '9001' : null)
    });
    expect(doc.querySelector('.suite-hub-stat')?.textContent).toBe('Classic best 9,001');
    expect(doc.querySelector('.suite-hub-stat').hasAttribute('aria-hidden')).toBe(false);
  });

  it('keeps separate mode and difficulty records visible without altering their storage', () => {
    const records = {
      turdtrisHighScore: '1234567', turdtrisSprint40BestMs_v1: '61234', turdtrisUltra120Best_v1: '98765',
      turdomania_best_v1: JSON.stringify({ v: 1, best: { easy: 7777, normal: 123456, hard: 99 } })
    };
    const read = key => records[key] ?? null;
    expect(readHubStatBadge(read, 'turdtris.html').text).toBe('Classic best 1,234,567 · Sprint best 1:01.2 · Ultra best 98,765');
    expect(readHubStatBadge(read, 'turdomania.html').text).toBe('Easy best 7,777 · Normal best 123,456 · Hard best 99');
    expect(JSON.parse(records.turdomania_best_v1).best.normal).toBe(123456);
  });
});
