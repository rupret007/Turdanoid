/**
 * A compact, centered phone hand. Coordinates include room for an 8px selection
 * lift: callers lift the selected card by selectedLift without resizing the hand.
 * Two rows preserve readable indices when one row would expose less than 30px.
 */
export function layoutPhoneHand({ count = 0, width = 320 } = {}) {
  const cardCount = Number.isFinite(count) ? Math.min(13, Math.max(0, Math.floor(count))) : 0;
  const availableWidth = Number.isFinite(width) ? Math.max(0, width) : 320;
  const cardWidth = Math.min(availableWidth, Math.max(52, Math.min(58, availableWidth / 6.5)));
  const cardHeight = Math.round(cardWidth * 1.42);
  const selectedLift = 8;
  const arcHeight = 4;
  // Even a lifted front-row card leaves 56 - 8 - 4 = 44px of the rear row.
  const rowStride = 56;
  const singleRowCapacity = Math.max(1, Math.floor((availableWidth - cardWidth) / 30) + 1);
  const rows = cardCount === 0 ? 0 : cardCount > singleRowCapacity ? 2 : 1;
  const rearCount = rows === 2 ? Math.ceil(cardCount / 2) : cardCount;
  const pitch = rearCount > 1
    ? Math.max(0, Math.min(cardWidth - 8, (availableWidth - cardWidth) / (rearCount - 1)))
    : 0;
  const positions = Array.from({ length: cardCount }, (_, index) => {
    const row = rows === 2 && index >= rearCount ? 1 : 0;
    const rowIndex = row === 0 ? index : index - rearCount;
    const rowCount = row === 0 ? rearCount : cardCount - rearCount;
    const midpoint = (rowCount - 1) / 2;
    const arc = rowCount > 1 ? Math.pow((rowIndex - midpoint) / midpoint, 2) * arcHeight : 0;
    return {
      x: (availableWidth - cardWidth - (rowCount - 1) * pitch) / 2 + rowIndex * pitch,
      y: selectedLift + row * rowStride + arc,
      z: index + 1,
      row
    };
  });
  return {
    cardWidth,
    cardHeight,
    height: rows === 0 ? 0 : selectedLift + (rows - 1) * rowStride + arcHeight + cardHeight,
    selectedLift,
    rowStride,
    rows,
    positions
  };
}
