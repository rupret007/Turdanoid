/**
 * Back-to-hub pill placement helpers (CSS does the layout; these are for tests/tools).
 */

/** Viewport width at which shared CSS moves the pill to the top-left. */
export const NARROW_BACK_PILL_MAX_WIDTH = 520;

/**
 * @param {{ suiteBack?: string, suiteBackPill?: string } | DOMStringMap | undefined} dataset
 * @param {number} viewportWidth
 * @returns {'top' | 'bottom'}
 */
export function resolveBackPillPlacement(dataset, viewportWidth) {
  const raw = dataset?.suiteBack || dataset?.suiteBackPill || 'auto';
  const placement = String(raw).toLowerCase();
  if (placement === 'bottom') return 'bottom';
  if (placement === 'top') return 'top';
  if (Number(viewportWidth) <= NARROW_BACK_PILL_MAX_WIDTH) return 'top';
  return 'bottom';
}

/**
 * Axis-aligned box intersection (screen coordinates).
 * @param {{ left: number, top: number, right: number, bottom: number }} a
 * @param {{ left: number, top: number, right: number, bottom: number }} b
 */
export function boxesIntersect(a, b) {
  if (!a || !b) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * True if the hub pill overlaps any visible interactive control.
 * @param {{ left: number, top: number, right: number, bottom: number }} pillBox
 * @param {Array<{ left: number, top: number, right: number, bottom: number }>} controlBoxes
 */
export function pillOverlapsControls(pillBox, controlBoxes) {
  if (!pillBox || !controlBoxes?.length) return false;
  for (let i = 0; i < controlBoxes.length; i++) {
    if (boxesIntersect(pillBox, controlBoxes[i])) return true;
  }
  return false;
}
