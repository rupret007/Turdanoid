import { describe, expect, it } from 'vitest';
import {
  dealOrderForScenario,
  listTurdjackDevScenarios,
  scenarioPlaybook
} from '../games/turdjack-dev-scenarios.js';

describe('turdjack-dev-scenarios', () => {
  it('lists all QA moments', () => {
    const names = listTurdjackDevScenarios();
    expect(names).toEqual(
      expect.arrayContaining(['blackjack', 'bust', 'push', 'split', 'double', 'insurance'])
    );
  });

  it('provides deal stacks for each scenario', () => {
    for (const name of listTurdjackDevScenarios()) {
      expect(dealOrderForScenario(name).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('maps bust to a hit follow-up', () => {
    expect(scenarioPlaybook('bust').afterDeal).toBe('hit');
  });
});
