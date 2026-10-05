/**
 * Responsive layout helpers for Crapjack table chrome (unit-tested).
 */

/**
 * Felt bet circle overlaps the card lane on phones during a live hand; hide it then.
 * @param {boolean} roundActive
 * @param {number} viewportWidth
 */
export function showFeltBetCircle(roundActive, viewportWidth) {
  const w = Number.isFinite(viewportWidth) ? viewportWidth : 1280;
  if (!roundActive) {return true;}
  return w > 980;
}

/**
 * Big total badges replace the score pill on narrow viewports.
 * @param {number} viewportWidth
 */
export function showHandScorePill(viewportWidth) {
  const w = Number.isFinite(viewportWidth) ? viewportWidth : 1280;
  return w > 980;
}

/**
 * @param {number} viewportWidth
 */
export function useCompactSeatTitles(viewportWidth) {
  const w = Number.isFinite(viewportWidth) ? viewportWidth : 1280;
  return w <= 680;
}
