import { describe, expect, it } from 'vitest';
import { TUNING, act, advance, createRun, pauseRun, resumeRun, startRun } from '../games/turdrush-core.js';

function clearRun(seed = 1) {
  const state = createRun(seed);
  startRun(state);
  state.entities = [];
  state._nextChunk = 1e9;
  return state;
}

function tick(state, seconds, hz = 120) {
  const events = [];
  for (let index = 0; index < Math.round(seconds * hz); index++) {
    events.push(...advance(state, 1 / hz));
  }
  return events;
}

function fixture(state, kind, lane = 1, at = state.distance + 3) {
  state.entities.push({ id: state._nextId++, kind, lane, at });
}

describe('Turd Rush fixed-step lifecycle', () => {
  it('starts deliberately, ignores actions/time outside play and cannot resurrect a finished run', () => {
    const state = createRun(42);
    const ready = globalThis.structuredClone(state);
    expect(advance(state, 4)).toEqual([]);
    expect(act(state, 'jump')).toEqual([]);
    expect(state).toEqual(ready);
    startRun(state);
    pauseRun(state);
    const paused = globalThis.structuredClone(state);
    advance(state, 20);
    act(state, 'left');
    expect(state).toEqual(paused);
    resumeRun(state);
    expect(state.phase).toBe('running');
    state.phase = 'over';
    const ended = globalThis.structuredClone(state);
    startRun(state);
    resumeRun(state);
    act(state, 'slide');
    advance(state, 1);
    expect(state).toEqual(ended);
  });

  it('produces identical positions, scores, power expiry and entities at30/60/120Hz', () => {
    const runs = [30, 60, 120].map(hz => {
      const state = clearRun('frame-equivalence');
      act(state, 'left');
      tick(state, 0.5, hz);
      act(state, 'jump');
      tick(state, 1, hz);
      act(state, 'right');
      tick(state, 0.5, hz);
      act(state, 'slide');
      tick(state, 8, hz);
      return state;
    });
    expect(runs[0]).toEqual(runs[1]);
    expect(runs[1]).toEqual(runs[2]);
  });

  it('caps stalled-frame catch-up and ignores invalid deltas without poisoning state', () => {
    const state = clearRun();
    const before = globalThis.structuredClone(state);
    for (const dt of [NaN, Infinity, -Infinity, -1, 0]) {
      expect(advance(state, dt)).toEqual([]);
    }
    expect(state).toEqual(before);
    advance(state, 1200);
    expect(state.elapsed).toBeLessThanOrEqual(TUNING.maxFrame + TUNING.fixedStep);
    expect(state.distance).toBeLessThan(2);
  });

  it('keeps the first six seconds free of hazards for every tested seed', () => {
    for (let seed = 0; seed < 100; seed++) {
      const state = createRun(seed);
      startRun(state);
      const events = tick(state, 6, 30);
      expect(state.phase).toBe('running');
      expect(events.some(event => event.type === 'hit')).toBe(false);
      expect(state.picks).toBe(3);
      expect(state.entities.filter(entity => ['crate', 'beam', 'barrier'].includes(entity.kind)).every(entity => entity.at >= 100)).toBe(true);
    }
  });
});

describe('Turd Rush deliberate controls and forgiving collision rules', () => {
  it('moves one lane smoothly, rejects same-tick duplicate inputs and clamps outside lanes', () => {
    const state = clearRun();
    expect(act(state, 'left')).toEqual([{ type: 'lane', lane: 0 }]);
    expect(act(state, 'left')).toEqual([]);
    expect(state.player.lane).toBe(0);
    expect(state.player.x).toBe(0);
    tick(state, 0.1);
    expect(state.player.x).toBeLessThan(0);
    expect(state.player.x).toBeGreaterThan(-TUNING.laneWidth);
    tick(state, 0.1);
    expect(state.player.x).toBe(-TUNING.laneWidth);
    act(state, 'left');
    expect(state.player.lane).toBe(0);
    act(state, 'right');
    act(state, 'right');
    expect(state.player.lane).toBe(1);
  });

  it('uses physical lateral position, so a late target-lane change is not a teleport', () => {
    const state = clearRun();
    fixture(state, 'barrier', 1, 0.5);
    act(state, 'left');
    const events = advance(state, 1 / 120);
    expect(state.phase).toBe('over');
    expect(events.filter(event => event.type === 'over')).toHaveLength(1);
  });

  it('allows an early side-step past full-height obstacles', () => {
    const state = clearRun();
    fixture(state, 'barrier', 1, 4);
    act(state, 'left');
    tick(state, 0.6);
    expect(state.phase).toBe('running');
  });

  it('clears crates with a well-timed jump, never with an unstarted/double jump', () => {
    const state = clearRun();
    fixture(state, 'crate', 1, 3.8);
    expect(act(state, 'jump')).toEqual([{ type: 'jump' }]);
    expect(act(state, 'jump')).toEqual([]);
    tick(state, 0.6);
    expect(state.phase).toBe('running');
    expect(state.player.y).toBeGreaterThan(0);
    tick(state, 0.3);
    expect(state.player.y).toBe(0);
    const walking = clearRun();
    fixture(walking, 'crate');
    tick(walking, 0.5);
    expect(walking.reason).toBe('crate');
  });

  it('slides beneath beams, will not extend on repeats, and can cancel into a jump', () => {
    const state = clearRun();
    fixture(state, 'beam');
    expect(act(state, 'slide')).toEqual([{ type: 'slide' }]);
    tick(state, 0.2);
    const remaining = state.player.slide;
    expect(act(state, 'slide')).toEqual([]);
    expect(state.player.slide).toBe(remaining);
    tick(state, 0.3);
    expect(state.phase).toBe('running');
    expect(act(state, 'jump')).toEqual([{ type: 'jump' }]);
    expect(state.player.slide).toBe(0);
    tick(state, 0.1);
    expect(state.player.y).toBeGreaterThan(0);
    const upright = clearRun();
    fixture(upright, 'beam');
    tick(upright, 0.5);
    expect(upright.reason).toBe('beam');
  });

  it('down-swipe during a jump lands in a slide rather than granting aerial beam immunity', () => {
    const state = clearRun();
    act(state, 'jump');
    tick(state, 0.2);
    act(state, 'slide');
    const high = state.player.y;
    tick(state, 0.1);
    expect(state.player.y).toBeLessThan(high);
    tick(state, 0.15);
    expect(state.player.y).toBe(0);
    expect(state.player.slide).toBeGreaterThan(0);
  });
});

describe('Turd Rush pickups, powers and terminal accounting', () => {
  it('collects once, accounts distance/picks once and emits one terminal result', () => {
    const state = clearRun();
    fixture(state, 'pick', 1, 1);
    fixture(state, 'barrier', 1, 3);
    const events = tick(state, 1);
    expect(events.filter(event => event.type === 'pickup')).toHaveLength(1);
    expect(events.filter(event => event.type === 'hit')).toHaveLength(1);
    expect(events.filter(event => event.type === 'over')).toHaveLength(1);
    expect(state.picks).toBe(1);
    expect(state.score).toBe(Math.floor(state.distance * 10) + 50);
    expect(events.find(event => event.type === 'over').score).toBe(state.score);
    const ended = globalThis.structuredClone(state);
    expect(tick(state, 1)).toEqual([]);
    expect(state).toEqual(ended);
  });

  it('one shield absorbs one hit and a later obstacle ends the run', () => {
    const state = clearRun();
    fixture(state, 'shield', 1, 1);
    fixture(state, 'barrier', 1, 5);
    fixture(state, 'crate', 1, 18);
    const first = tick(state, 0.6);
    expect(state.phase).toBe('running');
    expect(state.player.shield).toBe(0);
    expect(first.filter(event => event.type === 'shield')).toHaveLength(1);
    const last = tick(state, 1);
    expect(state.phase).toBe('over');
    expect(last.filter(event => event.type === 'over')).toHaveLength(1);
  });

  it('magnet attracts nearby outside-lane picks but not unrelated power-ups', () => {
    const state = clearRun();
    fixture(state, 'magnet', 1, 0.5);
    fixture(state, 'pick', 0, 4);
    fixture(state, 'pick', 2, 6);
    fixture(state, 'shield', 0, 4);
    tick(state, 0.7);
    expect(state.picks).toBe(2);
    expect(state.player.shield).toBe(0);
    expect(state.player.magnet).toBeGreaterThan(0);
  });

  it('expires powers on active time only and never queues them while paused', () => {
    const state = clearRun();
    state.player.shield = 8;
    state.player.magnet = 8;
    tick(state, 3);
    pauseRun(state);
    const remaining = state.player.shield;
    tick(state, 40);
    expect(state.player.shield).toBe(remaining);
    resumeRun(state);
    tick(state, 5);
    expect(state.player.shield).toBe(0);
    expect(state.player.magnet).toBe(0);
  });

  it('bounds catch-up event payloads even with overlapping diagnostic pickup fixtures', () => {
    const state = clearRun();
    for (let index = 0; index < 100; index++) {
      fixture(state, 'pick', 1, 0.1);
    }
    const events = advance(state, 0.1);
    expect(events).toHaveLength(TUNING.maxEvents);
    expect(state.picks).toBe(100);
    expect(advance(state, 0.1)).toEqual([]);
    fixture(state, 'barrier', 1, state.distance + 0.1);
    for (let index = 0; index < 100; index++) {
      state.entities.unshift({ id: state._nextId++, kind: 'pick', lane: 1, at: state.distance + 0.1 });
    }
    const terminal = advance(state, 0.1);
    expect(terminal).toHaveLength(TUNING.maxEvents);
    expect(terminal.filter(event => event.type === 'over')).toHaveLength(1);
  });
});

describe('Turd Rush seeded fair world', () => {
  it('reproduces a seed exactly, varies other seeds and keeps stable unique entity identities', () => {
    expect(createRun('Jeff')).toEqual(createRun('Jeff'));
    expect(createRun('Sean').entities).not.toEqual(createRun('Jeff').entities);
    const state = createRun(0);
    expect(new Set(state.entities.map(entity => entity.id)).size).toBe(state.entities.length);
  });

  it('has an independent action-aware reachable path over100 seeded kilometres at maximum speed', () => {
    const flight = 2 * TUNING.jumpVelocity / TUNING.gravity;
    const crossingWindow = 2 * TUNING.collisionDepth / TUNING.maxSpeed;
    const discriminant = TUNING.jumpVelocity ** 2 - 2 * TUNING.gravity * TUNING.crateClearance;
    expect(discriminant).toBeGreaterThan(0);
    const clearsFrom = (TUNING.jumpVelocity - Math.sqrt(discriminant)) / TUNING.gravity;
    const clearsUntil = (TUNING.jumpVelocity + Math.sqrt(discriminant)) / TUNING.gravity;
    // Independent ballistic oracle: a jump started.35s before row centre is
    // safely above the crate for its entire collision window, even at base speed.
    const slowCrossing = TUNING.collisionDepth / TUNING.baseSpeed;
    expect(0.35 - slowCrossing).toBeGreaterThan(clearsFrom);
    expect(0.35 + slowCrossing).toBeLessThan(clearsUntil);
    expect(TUNING.slideSeconds).toBeGreaterThan(0.35 + slowCrossing);
    for (let seed = 0; seed < 100; seed++) {
      const state = createRun(seed);
      startRun(state);
      const allRows = new Map();
      for (let distance = 0; distance < 1000; distance += 100) {
        state.distance = distance;
        state.entities = state.entities.filter(entity => entity.at >= distance - 5);
        state._invulnerable = 999;
        advance(state, TUNING.fixedStep);
        for (const entity of state.entities.filter(entity => ['crate', 'beam', 'barrier'].includes(entity.kind))) {
          if (!allRows.has(entity.at)) {
            allRows.set(entity.at, new Map());
          }
          allRows.get(entity.at).set(entity.lane, entity.kind);
        }
      }
      let reachable = new Set([1]);
      let lastAt = 0;
      let lastRequired = -Infinity;
      let lastSkillKind = null;
      let skills = 0;
      for (const [at, blocked] of [...allRows].sort((a, b) => a[0] - b[0])) {
        const next = new Set();
        const availableSeconds = (at - lastAt) / TUNING.maxSpeed;
        const skill = blocked.size === 3;
        if (skill) {
          const kinds = new Set(blocked.values());
          expect(kinds.size).toBe(1);
          expect(['crate', 'beam']).toContain([...kinds][0]);
          expect(at).toBeGreaterThanOrEqual(250);
          expect(at - lastRequired).toBeGreaterThanOrEqual(4 * TUNING.rowGap);
          if (lastSkillKind) {
            expect([...kinds][0]).not.toBe(lastSkillKind);
          }
          lastSkillKind = [...kinds][0];
          lastRequired = at;
          skills++;
        }
        expect(availableSeconds).toBeGreaterThanOrEqual(Math.max(flight, TUNING.slideSeconds) + crossingWindow + 0.2);
        for (let lane = 0; lane < 3; lane++) {
          // Ordinary rows can be crossed on foot; full rows require the proven
          // jump/slide window. Lateral travel includes a.2s reaction allowance.
          if ((!blocked.has(lane) || skill) && [...reachable].some(from => Math.abs(lane - from) * TUNING.laneChangeSeconds + 0.2 <= availableSeconds)) {
            next.add(lane);
          }
        }
        expect(next.size, `seed${seed} at${at}`).toBeGreaterThan(0);
        reachable = next;
        lastAt = at;
      }
      expect(allRows.size).toBeGreaterThan(40);
      expect(skills).toBeGreaterThan(5);
    }
  });

  it('places richer optional rewards on jumpable/slideable obstacle lanes, never full barriers', () => {
    const state = createRun('skill-rewards');
    const hazards = state.entities.filter(entity => ['crate', 'beam', 'barrier'].includes(entity.kind));
    const rewarded = hazards.filter(hazard => state.entities.some(entity => entity.kind === 'pick' && entity.lane === hazard.lane && entity.at === hazard.at));
    expect(rewarded.length).toBeGreaterThan(0);
    expect(rewarded.every(entity => entity.kind !== 'barrier')).toBe(true);
  });

  it('survives240s with genuine required jumps/slides and keeps speed/world memory bounded', () => {
    const state = createRun('endurance');
    startRun(state);
    let maxEntities = 0;
    let jumps = 0;
    let slides = 0;
    const actedRows = new Set();
    for (let frame = 0; frame < 60 * 240; frame++) {
      const next = state.entities.filter(entity => ['crate', 'beam', 'barrier'].includes(entity.kind) && entity.at >= state.distance - TUNING.collisionDepth).sort((a, b) => a.at - b.at)[0];
      if (next && next.at - state.distance < 20) {
        const hazards = state.entities.filter(entity => entity.at === next.at && ['crate', 'beam', 'barrier'].includes(entity.kind));
        const safe = [0, 1, 2].find(lane => !hazards.some(entity => entity.lane === lane));
        if (safe !== undefined && state.player.lane !== safe) {
          act(state, safe < state.player.lane ? 'left' : 'right');
        } else if (safe === undefined && !actedRows.has(next.at) && (next.at - state.distance) / state.speed <= 0.35) {
          const action = next.kind === 'crate' ? 'jump' : 'slide';
          const events = act(state, action);
          expect(events.map(event => event.type)).toContain(action);
          if (action === 'jump') {
            jumps++;
          } else {
            slides++;
          }
          actedRows.add(next.at);
        }
      }
      const events = advance(state, 1 / 60);
      expect(events.some(event => event.type === 'hit')).toBe(false);
      expect(state.phase).toBe('running');
      maxEntities = Math.max(maxEntities, state.entities.length);
    }
    expect(jumps).toBeGreaterThan(10);
    expect(slides).toBeGreaterThan(10);
    expect(state.elapsed).toBeCloseTo(240, 6);
    expect(state.speed).toBe(TUNING.maxSpeed);
    expect(maxEntities).toBeLessThan(100);
    expect(Number.isSafeInteger(state.score)).toBe(true);
  });
});
