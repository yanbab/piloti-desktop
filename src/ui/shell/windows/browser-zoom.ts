/** Zoom levels of the Web Browser, as Chrome steps them. */
export const BROWSER_ZOOM_STEPS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5,
] as const;

/** The next zoom step up (1) or down (-1) from `current`, clamped to the steps. */
export function nextBrowserZoom(current: number, direction: 1 | -1): number {
  const steps = BROWSER_ZOOM_STEPS;
  if (direction > 0) return steps.find((s) => s > current + 0.001) ?? steps[steps.length - 1];
  for (let i = steps.length - 1; i >= 0; i--) if (steps[i] < current - 0.001) return steps[i];
  return steps[0];
}

/** "110%". */
export function formatBrowserZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}
