export interface WindowPoint {
  x: number;
  y: number;
}

export interface WindowDimensions {
  width: number;
  height: number;
}

export interface ClampWindowOptions {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  /** Height reserved at the top of the display by MenuBar (px). */
  topBarHeight?: number;
  /** Optional margin reserved at the bottom of the canvas (px). */
  bottomInset?: number;
}

/**
 * Clamps a window's size and position so the full window stays inside the
 * visible desktop canvas between MenuBar and the viewport edges.
 */
export function clampWindowBounds(
  position: WindowPoint,
  size: WindowDimensions,
  screenWidth: number,
  screenHeight: number,
  options?: ClampWindowOptions
): { position: WindowPoint; size: WindowDimensions } {
  const topBarHeight = options?.topBarHeight ?? 30;
  const bottomInset = options?.bottomInset ?? 0;
  const canvasWidth = Math.max(240, Math.round(screenWidth));
  const canvasHeight = Math.max(
    200,
    Math.round(screenHeight - topBarHeight - bottomInset)
  );

  const effectiveMaxWidth =
    options?.maxWidth && options.maxWidth > 0
      ? Math.min(canvasWidth, Math.round(options.maxWidth))
      : canvasWidth;
  const effectiveMaxHeight =
    options?.maxHeight && options.maxHeight > 0
      ? Math.min(canvasHeight, Math.round(options.maxHeight))
      : canvasHeight;

  const minWidth = Math.min(
    effectiveMaxWidth,
    Math.max(120, Math.round(options?.minWidth ?? 240))
  );
  const minHeight = Math.min(
    effectiveMaxHeight,
    Math.max(100, Math.round(options?.minHeight ?? 180))
  );

  const rawWidth = Number.isFinite(size.width) ? Math.round(size.width) : minWidth;
  const rawHeight = Number.isFinite(size.height)
    ? Math.round(size.height)
    : minHeight;
  const width = Math.max(minWidth, Math.min(effectiveMaxWidth, rawWidth));
  const height = Math.max(minHeight, Math.min(effectiveMaxHeight, rawHeight));

  const maxX = Math.max(0, canvasWidth - width);
  const maxY = Math.max(0, canvasHeight - height);
  const rawX = Number.isFinite(position.x) ? Math.round(position.x) : 0;
  const rawY = Number.isFinite(position.y) ? Math.round(position.y) : 0;

  return {
    position: {
      x: Math.max(0, Math.min(maxX, rawX)),
      y: Math.max(0, Math.min(maxY, rawY)),
    },
    size: { width, height },
  };
}

/**
 * Clamps a 1-based workspace index into `[1, workspaceCount]`.
 */
export function clampWorkspace(
  workspace: number | undefined,
  workspaceCount: number
): number {
  const maxWs = Math.max(1, Math.round(workspaceCount));
  if (typeof workspace !== "number" || !Number.isFinite(workspace)) {
    return 1;
  }
  return Math.max(1, Math.min(maxWs, Math.round(workspace)));
}

