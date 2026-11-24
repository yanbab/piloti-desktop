// Dark Mode per App — a window menu entry that forces an app dark.
//
// The choice is an app setting (`~/.config/piloti/apps/<app-id>.ini`,
// `color-scheme=dark`), so every window of the app follows it
// and it survives restarts. Unchecked, the app follows the desktop style.

export function activate(ctx) {
  const appOf = (windowId) => ctx.windows.get(windowId)?.appId;
  const isDark = (windowId) => {
    const appId = appOf(windowId);
    return Boolean(appId) && ctx.apps.getSetting(appId, "color-scheme") === "dark";
  };

  ctx.windows.addMenuItem({
    id: "toggle",
    label: "Dark Mode",
    checked: isDark,
    onSelect: (windowId) => {
      const appId = appOf(windowId);
      if (!appId) return;
      ctx.apps.setSetting(appId, "color-scheme", isDark(windowId) ? null : "dark");
    },
  });
}
