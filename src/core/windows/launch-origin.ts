export interface LaunchOriginRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

let pendingOrigin: { rect: LaunchOriginRect; expiresAt: number } | null = null;

export function captureLaunchOriginRect(
  rect: LaunchOriginRect,
  ttlMs = 1500
): void {
  if (rect.width <= 0 || rect.height <= 0) return;
  pendingOrigin = {
    rect: { ...rect },
    expiresAt: Date.now() + ttlMs,
  };
}

export function captureLaunchOriginFromElement(
  el: Element | null | undefined,
  ttlMs = 1500
): void {
  if (!el || typeof el.getBoundingClientRect !== "function") return;
  const r = el.getBoundingClientRect();
  captureLaunchOriginRect(
    { left: r.left, top: r.top, width: r.width, height: r.height },
    ttlMs
  );
}

export function consumeLaunchOriginRect(): LaunchOriginRect | null {
  if (!pendingOrigin) return null;
  const { rect, expiresAt } = pendingOrigin;
  pendingOrigin = null;
  if (Date.now() > expiresAt) return null;
  return rect;
}

