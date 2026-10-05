/* WebAudio pitch helpers — combo ladder matches TurdAnoid.html sfx.combo. */
(function attachTurdanoidAudio(root) {
  'use strict';

  function comboHitFrequency(comboHits, baseHz = 440, stepHz = 30) {
    const hits = Math.max(0, Math.floor(comboHits || 0));
    return baseHz + hits * stepHz;
  }

  function brickBreakFrequency(level, comboHits = 0) {
    const lv = Math.max(1, Math.floor(level || 1));
    return 300 + lv * 8 + comboHitFrequency(comboHits, 0, 12);
  }

  root.TurdanoidAudio = {
    comboHitFrequency,
    brickBreakFrequency
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
