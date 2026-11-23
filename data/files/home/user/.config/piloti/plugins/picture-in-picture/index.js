// Picture in Picture — a window manager feature written as a desktop plugin.
//
// The window menu gets a "Picture in Picture" entry. The window is scaled down
// (like the overview does) into a corner of the work area and kept above the
// others. Its real size and position do not change, so leaving PiP puts it
// back exactly where it was.
//
//   drag             move it; it settles in the nearest corner
//   double-click     back to normal

const WIDTH_RATIO = 0.26; // of the work area width
const MIN_WIDTH = 240;
const MAX_WIDTH = 420;
const MARGIN = 16;
const DRAG_THRESHOLD = 4;

export function activate(ctx) {
  const pipWindows = new Map(); // windowId -> corner

  const naturalSize = (win, area) =>
    win.maximized
      ? { width: area.width, height: area.height }
      : { width: win.size.width, height: win.size.height };

  // Size and corner position of the PiP window in the work area.
  function layout(win, corner) {
    const area = ctx.windows.getWorkArea();
    const natural = naturalSize(win, area);
    const width = Math.round(
      Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, area.width * WIDTH_RATIO), natural.width)
    );
    const height = Math.round((natural.height * width) / natural.width);
    const left = area.x + MARGIN;
    const right = area.x + area.width - width - MARGIN;
    const top = area.y + MARGIN;
    const bottom = area.y + area.height - height - MARGIN;
    return {
      width,
      height,
      x: corner.endsWith("left") ? left : right,
      y: corner.startsWith("top") ? top : bottom,
    };
  }

  function present(windowId, rect, animate) {
    ctx.windows.setPresentation(windowId, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      above: true,
      interactive: false,
      animate,
      onPointerDown: (event) => startDrag(windowId, event),
      onDoubleClick: () => exit(windowId),
    });
  }

  function enter(windowId) {
    const win = ctx.windows.get(windowId);
    if (!win) return;
    const corner = ctx.storage.get("corner") ?? "bottom-right";
    pipWindows.set(windowId, corner);
    present(windowId, layout(win, corner), true);
  }

  function exit(windowId) {
    pipWindows.delete(windowId);
    ctx.windows.setPresentation(windowId, null);
    ctx.windows.focus(windowId);
  }

  function nearestCorner(rect) {
    const area = ctx.windows.getWorkArea();
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const vertical = cy < area.y + area.height / 2 ? "top" : "bottom";
    const horizontal = cx < area.x + area.width / 2 ? "left" : "right";
    return `${vertical}-${horizontal}`;
  }

  function startDrag(windowId, event) {
    if (event.button !== 0) return;
    const win = ctx.windows.get(windowId);
    const current = ctx.windows.getPresentation(windowId);
    if (!win || !current) return;
    const start = { x: event.clientX, y: event.clientY };
    const origin = { x: current.x, y: current.y };
    const size = layout(win, pipWindows.get(windowId) ?? "bottom-right");
    let moved = false;
    let rect = { ...size, ...origin };

    const onMove = (e) => {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      moved = true;
      rect = { ...size, x: origin.x + dx, y: origin.y + dy };
      present(windowId, rect, false);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (!moved || !pipWindows.has(windowId)) return;
      const corner = nearestCorner(rect);
      pipWindows.set(windowId, corner);
      ctx.storage.set("corner", corner);
      present(windowId, layout(win, corner), true);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // The shell drops the presentation of a window that closes.
  const isPip = (windowId) =>
    pipWindows.has(windowId) && Boolean(ctx.windows.getPresentation(windowId));

  ctx.windows.addMenuItem({
    id: "toggle",
    label: "Picture in Picture",
    checked: isPip,
    onSelect: (windowId) => (isPip(windowId) ? exit(windowId) : enter(windowId)),
  });

  ctx.onCleanup(() => pipWindows.clear());
}
