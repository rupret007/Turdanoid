/**
 * Mobile-first leaderboard strip + Share control for arcade end screens.
 */

function formatLeaderValue(row) {
  const n = row.value;
  if (row.rank === 'low' && n >= 1000) {
    const sec = Math.floor(n / 1000);
    const ms = n % 1000;
    return sec + ':' + String(ms).padStart(3, '0');
  }
  return n.toLocaleString('en-US');
}

/**
 * @param {Document} doc
 * @param {HTMLElement} host
 * @param {{
 *   page: string,
 *   bucket?: string,
 *   scoreLine?: string,
 *   gameTitle?: string,
 *   getLeaderboard: (page: string, bucket: string) => Array<{ value: number, at: number, rank?: string }>,
 *   share: (opts: object) => Promise<{ method: string }>
 * }} options
 */
export function mountArcadeActions(doc, host, options) {
  if (!host || host.querySelector('.suite-arcade-bar')) {
    return null;
  }
  const page = options.page;
  const bucket = options.bucket || 'default';
  const bar = doc.createElement('div');
  bar.className = 'suite-arcade-bar';

  const actions = doc.createElement('div');
  actions.className = 'suite-arcade-actions';

  const shareBtn = doc.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'suite-arcade-btn suite-arcade-share';
  shareBtn.textContent = 'Share score';
  shareBtn.setAttribute('aria-label', 'Share your score and a link to play');

  const boardBtn = doc.createElement('button');
  boardBtn.type = 'button';
  boardBtn.className = 'suite-arcade-btn suite-arcade-board-toggle';
  boardBtn.setAttribute('aria-expanded', 'false');
  boardBtn.setAttribute('aria-controls', 'suiteArcadeBoard');
  boardBtn.textContent = 'Local top 10';
  boardBtn.setAttribute('aria-label', 'Show local top ten high scores on this device');

  actions.appendChild(shareBtn);
  actions.appendChild(boardBtn);

  const panel = doc.createElement('section');
  panel.className = 'suite-arcade-board';
  panel.id = 'suiteArcadeBoard';
  panel.hidden = true;
  const heading = doc.createElement('h3');
  heading.className = 'suite-arcade-board-title';
  heading.textContent = 'Top scores (this device)';
  const list = doc.createElement('ol');
  list.className = 'suite-arcade-board-list';
  panel.appendChild(heading);
  panel.appendChild(list);

  function renderBoard() {
    const rows = options.getLeaderboard(page, bucket) || [];
    list.innerHTML = '';
    if (!rows.length) {
      const empty = doc.createElement('li');
      empty.className = 'suite-arcade-board-empty';
      empty.textContent = 'No scores saved yet.';
      list.appendChild(empty);
      return;
    }
    for (let i = 0; i < rows.length; i++) {
      const li = doc.createElement('li');
      li.textContent = '#' + (i + 1) + ' — ' + formatLeaderValue(rows[i]);
      list.appendChild(li);
    }
  }

  boardBtn.addEventListener('click', function () {
    const open = panel.hidden;
    panel.hidden = !open;
    boardBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      renderBoard();
    }
  });

  shareBtn.addEventListener('click', function () {
    shareBtn.disabled = true;
    options
      .share({
        page,
        gameTitle: options.gameTitle,
        scoreLine: options.scoreLine,
        bucket
      })
      .finally(function () {
        shareBtn.disabled = false;
      });
  });

  bar.appendChild(actions);
  bar.appendChild(panel);
  host.appendChild(bar);
  return { bar, shareBtn, boardBtn, renderBoard };
}
