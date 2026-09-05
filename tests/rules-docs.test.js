import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function readRepoFile(path) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function section(document, heading) {
  const marker = `## ${heading}`;
  const start = document.indexOf(marker);
  expect(start, `${heading} section is present`).toBeGreaterThanOrEqual(0);
  const next = document.indexOf('\n## ', start + marker.length);
  return document.slice(start, next === -1 ? document.length : next);
}

function numericConstant(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)`));
  expect(match, `${name} is a numeric constant`).not.toBeNull();
  return Number(match[1]);
}

function numericProperty(source, name) {
  const match = source.match(new RegExp(`${name}:\\s*(\\d+)`));
  expect(match, `${name} is a numeric property`).not.toBeNull();
  return Number(match[1]);
}

const rules = readRepoFile('RULES.md');

describe('RULES.md follows the shipped games', () => {
  it('records the real Turdtris cap and bounded lock resets', () => {
    const game = readRepoFile('turdtris.html');
    const documented = section(rules, 'Turdtris (Tetris Clone)');
    const maxLevel = numericConstant(game, 'MAX_LEVEL');
    const maxMoveResets = numericConstant(game, 'maxMoveResets');

    expect(documented).toContain(`Max level is ${maxLevel}`);
    expect(documented).toContain(`up to ${maxMoveResets} times per piece`);
    expect(documented).toContain('Levels 1-5 require 8 lines each');
    expect(documented).toContain('none of them hide behind More Controls');
    expect(documented).toContain('capped to one 33ms step');
    expect(documented).toContain('Space or Enter starts the next run');
    expect(game).toContain('clampFrameDelta');
    expect(game).toContain('data-action="hold"');
    expect(game).toContain('data-action="down"');
    expect(game).toContain('data-action="pause"');
    expect(game).not.toContain('More Controls');
    expect(game).not.toContain('Infinity Rotation');
    expect(documented).not.toContain('Infinity Rotation');
  });

  it('records the four-player Crappy Eights action match', () => {
    const game = readRepoFile('crapeights.html');
    const documented = section(rules, 'Crapeights (Crazy Eights)');
    const matchTarget = numericConstant(game, 'MATCH_TARGET');

    for (const opponent of ['oppCard1', 'oppCard2', 'oppCard3']) {
      expect(game).toContain(`id="${opponent}"`);
    }
    expect(documented).toContain('three bot opponents');
    expect(documented).toContain(`first player to ${matchTarget} points`);
    expect(documented).toContain('**2**: Next player draws 2 cards');
    expect(documented).toContain('**J**: Skips the next player');
    expect(documented).toContain('**Q**: Reverses play direction');
    expect(documented).toContain("Leaving for the hub saves this device's match");
    expect(documented).not.toContain('simplified: just win/lose');
  });

  it('records TurdRummy layoffs, bonuses, and match target', () => {
    const game = readRepoFile('turdrummy.html');
    const documented = section(rules, 'Turdrummy (Gin Rummy)');
    const ginBonus = numericProperty(game, 'ginBonus');
    const undercutBonus = numericProperty(game, 'undercutBonus');
    const matchTarget = numericProperty(game, 'matchTarget');

    expect(documented).toContain(`First to ${matchTarget} points wins`);
    expect(documented).toContain(`Gin | ${ginBonus} + defender deadwood`);
    expect(documented).toContain(`Undercut | ${undercutBonus} +`);
    expect(documented).toContain('defender may add deadwood cards');
    expect(documented).toContain('Match scores without a table are not restored');
  });

  it('records the shipped TurdSpades target, contract score, Nil, and bags', () => {
    const game = readRepoFile('turdspades.html');
    const documented = section(rules, 'Turdspades');
    const target = numericConstant(game, 'TARGET');

    expect(game).toContain('contractBid * 10 + overtricks');
    expect(game).toContain('-contractBid * 10');
    expect(game).toContain('bagPenalties * 100');
    expect(game).toContain('succeeded ? 100 : -100');
    expect(documented).toContain(`First team to ${target} points wins`);
    expect(documented).toContain('10 × team bid + 1 per overtrick');
    expect(documented).toContain('Make Nil (take zero tricks) | +100 points');
    expect(documented).toContain('Miss Nil (take one or more tricks) | -100 points');
    expect(documented).toContain('Nil tricks still count toward the team contract');
    expect(documented).toContain('overtakes that Nil winner when a cheaper cover exists');
    expect(documented).toContain('returning continues the same bids, tricks, and score');
    expect(documented).toContain('10 accumulated bags | -100 points');
    expect(documented).not.toContain('First team to 500 points wins');
  });

  it('records Crapjack live-hand continue and hidden-hole counting', () => {
    const game = readRepoFile('turdjack.html');
    const documented = section(rules, 'Turdjack (Blackjack)');

    expect(game).toContain("Suite.table.remember('turdjack.html'");
    expect(game).toContain('if (roundActive) return;');
    expect(documented).toContain('A live hand is saved on this device');
    expect(documented).toContain('lifetime bankroll is not rewritten until the hand settles');
    expect(documented).toContain('Hidden dealer holes stay out of the count');
  });
});
