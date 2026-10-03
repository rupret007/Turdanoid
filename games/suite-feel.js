/**
 * Cross-suite feel tuning (gameplay helpers, not save formats).
 * HTML pages mirror these numbers inline; keep tests here in sync.
 */

export const TURDANOID_FEEL = {
  comboWindowFrames: 105,
  /** Pointer follow smoothing at 60 FPS (frame-rate independent via scaleLerp). */
  pointerLerpPerFrame: 0.4,
  minBallSpeed: 4.25,
  /** Max radians from vertical for paddle english (wider = more control). */
  paddleEnglish: 1.12
};

export const CARD_TABLE_FEEL = {
  crapeightsAiMs: 600,
  turdrummyQuickAiMs: 180,
  turdrummyAiMs: 540,
  turdspadesAiMs: 400
};

/** Frame-rate-independent exponential smoothing factor for `ts` game steps. */
export function scaleLerp(perFrameAt60, ts) {
  const base = Math.max(0, Math.min(1, perFrameAt60));
  const steps = Math.max(0, ts);
  return 1 - Math.pow(1 - base, steps);
}

export function lerpToward(current, target, t) {
  const f = Math.max(0, Math.min(1, t));
  return current + (target - current) * f;
}

export function clampMinBallSpeed(vx, vy, minSpeed = TURDANOID_FEEL.minBallSpeed) {
  const sp = Math.hypot(vx, vy);
  if (sp <= 0 || sp >= minSpeed) {
    return { vx, vy };
  }
  const f = minSpeed / sp;
  return { vx: vx * f, vy: vy * f };
}
