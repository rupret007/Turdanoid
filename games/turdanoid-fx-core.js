/* TurdAnoid FX helpers — reduced-motion gating (classic script for TurdAnoid.html). */
(function attachTurdanoidFx(root) {
  'use strict';

  function isReducedMotion(mediaQuery) {
    return !!(mediaQuery && mediaQuery.matches);
  }

  /** Screen shake translation; zero when reduced motion is on. */
  function shakeOffset(shake, reducedMotion, random = Math.random) {
    if (!shake || shake <= 0 || isReducedMotion(reducedMotion)) {
      return { sx: 0, sy: 0 };
    }
    return {
      sx: (random() - 0.5) * shake,
      sy: (random() - 0.5) * shake
    };
  }

  /** White flash overlay alpha multiplier. */
  function flashStrength(flash, reducedMotion) {
    if (!flash || flash <= 0) {
      return 0;
    }
    const base = flash * 0.35;
    return isReducedMotion(reducedMotion) ? base * 0.35 : base;
  }

  /** Parallax / ambient drift speed multiplier. */
  function parallaxSpeedFactor(reducedMotion) {
    return isReducedMotion(reducedMotion) ? 0.12 : 1;
  }

  /** Cap cosmetic particle spawns when motion is reduced. */
  function clampBurstCount(requested, reducedMotion, floor = 2) {
    const n = Math.max(0, Math.floor(requested));
    if (!isReducedMotion(reducedMotion)) {
      return n;
    }
    return Math.min(n, Math.max(floor, Math.ceil(n * 0.22)));
  }

  /** Danger vignette pulse: steady when reduced motion. */
  function dangerPulse(nowMs, reducedMotion) {
    if (isReducedMotion(reducedMotion)) {
      return 1;
    }
    return 0.72 + 0.28 * Math.sin(nowMs * 0.014);
  }

  /** Full juice (shards, confetti bursts, heavy parallax) when motion is OK. */
  function allowJuiceEffects(reducedMotion) {
    return !isReducedMotion(reducedMotion);
  }

  function confettiCount(requested, reducedMotion) {
    if (!allowJuiceEffects(reducedMotion)) {
      return 0;
    }
    return clampBurstCount(requested, reducedMotion, 4);
  }

  root.TurdanoidFX = {
    isReducedMotion,
    shakeOffset,
    flashStrength,
    parallaxSpeedFactor,
    clampBurstCount,
    dangerPulse,
    allowJuiceEffects,
    confettiCount
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
