/* Desktop / wide viewport playfield sizing (portrait-first theater). */
(function attachTurdanoidLayout(root) {
  'use strict';

  /** Width / height of the reference phone playfield. */
  const REF_WIDTH = 390;
  const REF_HEIGHT = 844;
  const ASPECT = REF_WIDTH / REF_HEIGHT;

  /**
   * @param {number} stageW
   * @param {number} stageH
   * @returns {{ canvasW: number, canvasH: number, wide: boolean }}
   */
  function computePlayfield(stageW, stageH) {
    const sw = Math.max(1, Math.floor(stageW));
    const sh = Math.max(1, Math.floor(stageH));
    const wide = sw >= 720 && sw / sh > 1.12;
    if (!wide) {
      return { canvasW: sw, canvasH: sh, wide: false };
    }
    let canvasH = sh;
    let canvasW = Math.floor(canvasH * ASPECT);
    const maxW = Math.floor(sw * 0.56);
    if (canvasW > maxW) {
      canvasW = maxW;
      canvasH = Math.floor(canvasW / ASPECT);
    }
    canvasW = Math.max(320, canvasW);
    canvasH = Math.max(480, canvasH);
    canvasW -= canvasW % 2;
    canvasH -= canvasH % 2;
    return { canvasW, canvasH, wide: true };
  }

  /**
   * HUD insets so phone chrome clears the suite back pill and stays readable.
   * Tracking is in em; keep labels under 0.12 so words do not mash.
   */
  function hudMetrics(viewportWidth, safeLeft = 0) {
    const vw = Math.max(0, Number(viewportWidth) || 0);
    const narrow = vw > 0 && vw <= 520;
    const pillReserve = narrow ? 68 : 0;
    const left = Math.max(10, Math.floor(safeLeft) + pillReserve);
    return {
      narrow,
      left,
      top: 10,
      minTap: 44,
      trackingHud: 0.02,
      trackingLabel: 0.08,
      trackingButton: 0.06
    };
  }

  root.TurdanoidLayout = {
    REF_WIDTH,
    REF_HEIGHT,
    ASPECT,
    computePlayfield,
    hudMetrics
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
