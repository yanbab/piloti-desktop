/**
 * The icon sizes the shell uses, in px. Icons are never smaller than 16px and
 * always one of these (the Piloti Demo app shows them side by side).
 * Larger image previews (Folders zoomed in) are thumbnails, not icons.
 */
export const ICON_SIZES = [16, 24, 32, 48, 56, 64, 96] as const;

export type IconSize = (typeof ICON_SIZES)[number];

/** The closest size of the scale (never below 16). */
export function snapIconSize(px: number): IconSize {
  let best: IconSize = ICON_SIZES[0];
  for (const size of ICON_SIZES) {
    if (Math.abs(size - px) < Math.abs(best - px)) best = size;
  }
  return best;
}
