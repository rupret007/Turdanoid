/**
 * Thumb-friendly segmented difficulty control (mobile-first, non-blocking).
 */

const LABELS = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

export function mountDifficultyPicker(document, api) {
  if (!document || !document.body || document.querySelector('.suite-difficulty')) {
    return null;
  }
  if (document.body.dataset && document.body.dataset.suiteNoDifficulty === '1') {
    return null;
  }

  const wrap = document.createElement('div');
  wrap.className = 'suite-difficulty';
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', 'Game difficulty');

  const fieldset = document.createElement('div');
  fieldset.className = 'suite-difficulty-seg';

  const buttons = {};
  for (const id of ['easy', 'normal', 'hard']) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suite-difficulty-btn';
    btn.dataset.level = id;
    btn.textContent = LABELS[id];
    btn.setAttribute('aria-pressed', id === api.get() ? 'true' : 'false');
    btn.addEventListener('click', () => {
      api.set(id);
    });
    fieldset.appendChild(btn);
    buttons[id] = btn;
  }

  wrap.appendChild(fieldset);
  document.body.appendChild(wrap);

  function sync(level) {
    for (const id of Object.keys(buttons)) {
      buttons[id].setAttribute('aria-pressed', id === level ? 'true' : 'false');
    }
  }

  api.onChange(sync);
  sync(api.get());

  return { root: wrap, sync };
}
