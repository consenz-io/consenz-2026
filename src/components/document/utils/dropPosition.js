/**
 * Compute a new insertPosition for a suggestion dropped between two items.
 *
 * @param {number|null} abovePos - position of the item above (section.order + 1, or suggestion.insertPosition), null if nothing above
 * @param {number|null} belowPos - position of the item below (section.order, or suggestion.insertPosition), null if nothing below
 * @returns {number} the new insertPosition
 */
export function computeDropPosition(abovePos, belowPos) {
  if (abovePos != null && belowPos != null) return (abovePos + belowPos) / 2;
  if (abovePos != null) return abovePos + 0.5;
  if (belowPos != null) return belowPos - 0.5;
  return -1;
}