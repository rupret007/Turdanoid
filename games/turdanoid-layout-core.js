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
    return { canvasW, canvasH, wide: true };
  }

  root.TurdanoidLayout = {
    REF_WIDTH,
    REF_HEIGHT,
    ASPECT,
    computePlayfield
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
