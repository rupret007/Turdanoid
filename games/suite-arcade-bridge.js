/* Thin helpers so inline game scripts can call Suite.arcade consistently. */
(function (root) {
  'use strict';

  function currentPage() {
    const loc = root.location || { pathname: '' };
    return (loc.pathname || '').split('/').pop() || '';
  }

  function suiteArcade() {
    return root.Suite && root.Suite.arcade ? root.Suite.arcade : null;
  }

  function touchRun(snapshot) {
    const arcade = suiteArcade();
    if (!arcade) {
      return false;
    }
    return arcade.saveRun(currentPage(), snapshot);
  }

  function clearRun() {
    const arcade = suiteArcade();
    if (!arcade) {
      return false;
    }
    return arcade.clearRun(currentPage());
  }

  function finishRun(options) {
    const arcade = suiteArcade();
    if (!arcade) {
      return false;
    }
    const page = currentPage();
    arcade.recordEnd(page, options || {});
    const host = options && options.host;
    if (host) {
      arcade.mountActions(host, {
        page,
        bucket: options.bucket,
        scoreLine: options.scoreLine,
        gameTitle: options.gameTitle
      });
    }
    return true;
  }

  function mountEnd(host, options) {
    const arcade = suiteArcade();
    if (!arcade || !host) {
      return;
    }
    const page = currentPage();
    arcade.mountActions(host, Object.assign({ page }, options || {}));
  }

  function bindAutosave(getSnapshot) {
    if (typeof getSnapshot !== 'function') {
      return;
    }
    function flush() {
      try {
        const snap = getSnapshot();
        if (snap) {
          touchRun(snap);
        }
      } catch (e) {}
    }
    root.addEventListener('pagehide', flush);
    root.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    });
  }

  function wireResumeButton(button, applySnapshot) {
    const arcade = suiteArcade();
    if (!arcade || !button || typeof applySnapshot !== 'function') {
      return;
    }
    const saved = arcade.loadRun(currentPage());
    if (!saved) {
      button.hidden = true;
      return;
    }
    const level = saved.level || 0;
    const score = saved.score || 0;
    button.hidden = false;
    button.textContent = level > 0 ? 'Continue level ' + level : 'Continue run';
    button.setAttribute(
      'aria-label',
      'Resume your saved run at level ' + level + ' with score ' + score
    );
    button.addEventListener('click', function () {
      if (applySnapshot(saved)) {
        button.hidden = true;
      }
    });
  }

  root.TurdSuiteArcadeBridge = {
    currentPage,
    touchRun,
    clearRun,
    finishRun,
    mountEnd,
    bindAutosave,
    wireResumeButton
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
