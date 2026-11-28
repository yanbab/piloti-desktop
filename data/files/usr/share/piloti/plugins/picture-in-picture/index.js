// Picture in Picture — a window manager feature written as a desktop plugin.
//
// The window menu gets a "Picture in Picture" entry. The window becomes a
// floating window: scaled down (like the overview does), kept above the
// others, moved anywhere by dragging (it snaps to the edges and resists past
// them) and resized from its borders, which scales it. Its real size and
// position do not change, so leaving PiP puts it back exactly where it was.
//
//   drag             move it
//   drag a border    resize it
//   click / double-click (per the click setting)   back to normal

const WIDTH_RATIO = 0.26; // default width, of the work area width
const MIN_WIDTH = 200;
const MAX_WIDTH_RATIO = 0.7;
const MARGIN = 6; // same gap as the shell's floating windows and menus

export function activate(ctx) {
  const { windows } = ctx.piloti.desktop;
  const pipWindows = new Set();

  const naturalSize = (win, area) =>
    win.maximized
      ? { width: area.width, height: area.height }
      : { width: win.size.width, height: win.size.height };

  // Last place and width the user gave a PiP window, or the bottom-right corner.
  function initialRect(win) {
    const area = windows.workArea;
    const natural = naturalSize(win, area);
    const saved = ctx.storage.get("rect");
    const width = Math.round(
      Math.min(
        natural.width,
        area.width * MAX_WIDTH_RATIO,
        saved?.width ?? Math.max(MIN_WIDTH, area.width * WIDTH_RATIO)
      )
    );
    const height = (natural.height * width) / natural.width;
    const maxX = area.x + area.width - width - MARGIN;
    const maxY = area.y + area.height - height - MARGIN;
    const clamp = (n, min, max) => Math.round(Math.min(max, Math.max(min, n)));
    return {
      width,
      x: clamp(saved?.x ?? maxX, area.x + MARGIN, maxX),
      y: clamp(saved?.y ?? maxY, area.y + MARGIN, maxY),
    };
  }

  function enter(windowId) {
    const win = windows.get(windowId);
    if (!win) return;
    const area = windows.workArea;
    pipWindows.add(windowId);
    ctx.windows.setPresentation(windowId, {
      ...initialRect(win),
      above: true,
      floating: {
        resizable: true,
        minWidth: MIN_WIDTH,
        maxWidth: area.width * MAX_WIDTH_RATIO,
      },
      onChange: (rect) => ctx.storage.set("rect", rect),
      // Restores like opening an icon: single or double click, per setting.
      onActivate: () => exit(windowId),
    });
  }

  function exit(windowId) {
    pipWindows.delete(windowId);
    ctx.windows.setPresentation(windowId, null);
    windows.focus(windowId);
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
