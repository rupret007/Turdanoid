/**
 * Mobile layout helpers for board-first Turdtris.
 */

export const MOBILE_BOARD_FOCUS_MAX_WIDTH = 980;

export function shouldUseBoardFocusLayout(viewportWidth) {
  const w = Number(viewportWidth);
  if (!Number.isFinite(w)) {return false;}
  return w > 0 && w <= MOBILE_BOARD_FOCUS_MAX_WIDTH;
}

export function boardCanvasCssWidth(viewportWidth, viewportHeight) {
  const w = Number(viewportWidth) || 390;
  const h = Number(viewportHeight) || 844;
  const vwCap = Math.min(94, 78 + (w < 400 ? 4 : 0));
  const vhCap = h < 700 ? 38 : 46;
  return {
    width: `min(400px, ${vwCap}vw, ${vhCap}dvh)`,
    vwCap,
    vhCap
  };
}
