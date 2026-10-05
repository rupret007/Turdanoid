import { describe, it, expect } from 'vitest';
import { shouldUseBoardFocusLayout, boardCanvasCssWidth } from '../games/turdtris-layout.js';

describe('turdtris-layout', () => {
  it('enables board focus at phone and tablet widths only', () => {
    expect(shouldUseBoardFocusLayout(390)).toBe(true);
    expect(shouldUseBoardFocusLayout(980)).toBe(true);
    expect(shouldUseBoardFocusLayout(981)).toBe(false);
    expect(shouldUseBoardFocusLayout(1280)).toBe(false);
    expect(shouldUseBoardFocusLayout(0)).toBe(false);
    expect(shouldUseBoardFocusLayout(NaN)).toBe(false);
  });

  it.each([
    { width: 390, height: 844, inset: 0, expectedWidth: 257, reserved: 330 },
    { width: 390, height: 844, inset: 34, expectedWidth: 240, reserved: 330 },
    { width: 320, height: 640, inset: 0, expectedWidth: 169, reserved: 302 },
    { width: 320, height: 640, inset: 34, expectedWidth: 152, reserved: 302 }
  ])('fits the board, header and dock at $width × $height with $inset px inset', ({ width, height, inset, expectedWidth, reserved }) => {
    const layout = boardCanvasCssWidth(width, height, inset);
    expect(layout.mobile).toBe(true);
    expect(layout.boardWidth).toBe(expectedWidth);
    expect(layout.boardHeight).toBe(expectedWidth * 2);
    expect(layout.verticalReservation).toBe(reserved);
    // A 100px header and 185px dock cannot overlap the board at either phone size.
    expect(100 + layout.boardHeight + 185 + inset).toBeLessThanOrEqual(height);
    expect(layout.boardWidth + layout.horizontalReservation).toBeLessThanOrEqual(width);
    expect(layout.boardWidth / 10).toBeGreaterThanOrEqual(15);
    expect(layout.width).toContain(`100dvh - ${reserved}px`);
    expect(layout.width).toContain('100vw - 42px');
    expect(layout.width).toContain('env(safe-area-inset-bottom)');
  });

  it('uses the compact reservation through the 700px media boundary', () => {
    expect(boardCanvasCssWidth(390, 700).verticalReservation).toBe(302);
    expect(boardCanvasCssWidth(390, 701).verticalReservation).toBe(330);
  });

  it('reserves horizontal cabinet padding when viewport width limits the board', () => {
    const layout = boardCanvasCssWidth(320, 1400);
    expect(layout.boardWidth).toBe(278);
    expect(layout.boardWidth + layout.horizontalReservation).toBe(320);
    expect(layout.boardHeight + layout.verticalReservation).toBeLessThan(1400);
  });

  it('preserves the existing desktop canvas sizing rule', () => {
    const layout = boardCanvasCssWidth(1280, 900);
    expect(layout.mobile).toBe(false);
    expect(layout.width).toBe('min(440px, 78vw, 44dvh)');
    expect(layout.boardWidth).toBe(396);
    expect(layout.boardHeight).toBe(792);
    expect(boardCanvasCssWidth(1920, 1080).boardWidth).toBe(440);
  });

  it('handles missing dimensions and unusably short viewports without negative geometry', () => {
    expect(boardCanvasCssWidth(undefined, undefined).boardWidth).toBe(257);
    expect(boardCanvasCssWidth(Infinity, -3).boardWidth).toBe(257);
    expect(boardCanvasCssWidth(320, 200).boardWidth).toBe(0);
    expect(boardCanvasCssWidth(320, 640, -34).safeAreaBottom).toBe(0);
    expect(boardCanvasCssWidth(320, 640, NaN).safeAreaBottom).toBe(0);
  });
});
