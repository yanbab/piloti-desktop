# User Plugins in Piloti

This document outlines practical ways to support simple, safe user plugins in Piloti across both runtimes (**Domicile Wayland** and **Browser Dev / Web**).

---

## Implemented Tier 1 & Manifestless Support

Piloti implements Tier 1 plugins and manifestless single-file plugins out of the box in `~/.config/piloti/plugins/`:

- **Single `.css` file** (`my-theme.css`) — no `manifest.json` required; injects `<style data-piloti-plugin="my-theme">` into `document.head`.
- **Single `.js` / `.mjs` file** (`my-script.js`) — no `manifest.json` required; executes as a browser ES module via `Blob` URL (`activate(ctx)` / `deactivate()` or top-level code using `window.piloti`).
- **Folder** (`my-plugin/`) — optional `manifest.json` (including declarative `commands`) or auto-detected `style.css` + `index.js`.
- **Management UI** — **Settings → Advanced → User Plugins** lists discovered plugins with live enable/disable switches, reload, **Sample CSS** / **Sample JS** generators, and **Open Folder**.
- **Safe Mode** — append `?safe-mode=1` to skip JS plugin execution while keeping CSS plugins active.

---

## Design Goals

1. **Simple to author**: A plugin should be a single folder with a `manifest.json` and an optional `style.css` or `index.js` — no build step required for basic extensions.
2. **Works on Domicile & Web**: Discovery and persistence should use `ctx.piloti.files` (backed by `$XDG_CONFIG_HOME/piloti/plugins/` on Linux and `web-vfs` / `localStorage` in the browser).
3. **Instant enable/disable**: Plugins register disposables (`onCleanup`) so toggling a plugin off cleanly removes its UI slots, commands, and stylesheets without reloading the compositor.
4. **Fault-isolated**: Plugin UI slots are wrapped in an error boundary (similar to `ShellErrorBoundary`) so a buggy plugin cannot crash `MenuBar`, `Dock`, or `Launcher`.

---

## Recommended Tiered Model

Supporting three progressive tiers keeps simple customizations trivial while allowing real JS extensions when needed.

### Tier 1 — Declarative Plugins (`manifest.json` + `style.css`)

Zero-JavaScript plugins for themes, tweaks, and custom launcher/menu actions:

```text
~/.config/piloti/plugins/nord-tweaks/
├── manifest.json
└── style.css
```

Example `manifest.json`:

```json
{
  "id": "nord-tweaks",
  "name": "Nord Shell Tweaks",
  "version": "1.0.0",
  "description": "Custom CSS variables and quick actions",
  "style": "style.css",
  "commands": [
    {
      "id": "open-notes",
      "title": "Open Quick Notes",
      "keywords": "notes markdown",
      "exec": ["gnome-text-editor", "~/notes.md"]
    }
  ]
}
```

- **How it loads**: Piloti reads `style.css` via `ctx.piloti.files.readFile(...)` and injects/removes a `<style data-piloti-plugin="nord-tweaks">` element in `document.head`.
- **Why start here**: Completely CSP-safe, instant live reload via file watching, and covers 80% of rice/theming and shortcut requests.

---

### Tier 2 — Lightweight ES Module Plugins (`index.js`)

For dynamic status indicators, custom Launcher search providers, or desktop automation, a plugin exports `activate(ctx)` and optional `deactivate()` as a native browser ES module:

```text
~/.config/piloti/plugins/pomodoro-indicator/
├── manifest.json
└── index.js
```

Example `index.js`:

```js
export function activate(ctx) {
  let remaining = 25 * 60;
  let timer = null;

  const item = ctx.menubar.addStatusItem({
    id: "timer",
    label: "25:00",
    onClick() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      } else {
        timer = setInterval(() => {
          remaining = Math.max(0, remaining - 1);
          const m = String(Math.floor(remaining / 60)).padStart(2, "0");
          const s = String(remaining % 60).padStart(2, "0");
          item.update({ label: `${m}:${s}` });
          if (remaining === 0) {
            clearInterval(timer);
            timer = null;
            ctx.notifications.push({
              summary: "Pomodoro finished",
              body: "Time for a short break.",
            });
          }
        }, 1000);
      }
    },
  });

  ctx.onCleanup(() => {
    if (timer) clearInterval(timer);
  });
}
```

#### Loading ESM Plugins Without a Bundler

- Read `index.js` text with `ctx.piloti.files.readFile(...)`, create a `Blob` (`type: "text/javascript"`), and call `import(/* @vite-ignore */ URL.createObjectURL(blob))` (revoking the URL afterward).
- **CSP note**: If Domicile enforces a strict `script-src`, ensure `blob:` is allowed or serve user plugins from a local origin/file handler. Keep Tier 1 (`manifest.json` + `style.css`) always available even under strict CSP.
- **No React version coupling**: Keep the plugin API imperative/data-driven (`label`, `icon`, `tooltip`, `menuItems`, `onClick`, `update(...)`) instead of requiring plugins to import `react`. That avoids JSX compilation and React instance mismatches.

---

### Tier 3 — Sandboxed Web Widgets / Mini-Apps (`<iframe>` + `postMessage`)

Piloti already hosts web apps (`installedWebApps` + `WebViewWindow`). Custom HTML/JS widgets (dashboards, calendars, media panels) can run inside a sandboxed `<iframe>` (`sandbox="allow-scripts"`) in a window or Control Panel popover, communicating with the shell over a small `postMessage` RPC subset.

---

## Minimal Shell Plugin API (`PilotiPluginContext`)

Keep the surface small and aligned with existing contexts in `src/context/DesktopStateContext.tsx`:

| Namespace | Capabilities | Backed By |
| --- | --- | --- |
| `ctx.menubar` | `addStatusItem({ id, label, icon?, tooltip?, menu?, onClick? })` -> `{ update, remove }` | `MenuBar.tsx` / `SystemTray.tsx` |
| `ctx.launcher` | `registerProvider({ id, search(query), onSelect(item) })` | `Launcher.tsx` |
| `ctx.commands` | `register({ id, title, shortcut?, run })` | `WindowsContext` / `Launcher` |
| `ctx.windows` | `openWebUrl(url, title?)`, `launchApp(appId)`, `list()`, `get(id)`, `focus(id)` | `useWindowManager()` |
| `ctx.windows` (window manager) | `getWorkArea()`, `setPresentation(id, { x, y, width, above?, interactive?, animate?, floating?, onChange?, onPointerDown?, onDoubleClick? } \| null)`, `getPresentation(id)`, `addMenuItem({ id, label, checked?, visible?, onSelect })` -> remove | `window-presentation.ts` / `WindowManager.tsx` |
| `ctx.notifications` | `push({ summary, body?, urgency? })` | `useNotifications()` |
| `ctx.piloti` | Domicile's whole desktop API (files, processes, windows...) | `lib/engine/piloti.ts` |
| `ctx.storage` | `get(key)`, `set(key, value)` (namespaced per plugin ID) | `storage-cache.ts` |
| `ctx.system` | Optional gated access to `readFile`, `spawn` (declared in `manifest.json` `permissions`) | `ctx.piloti.files` / `ctx.piloti.processes` |
| `ctx.onCleanup(fn)` | Registers teardown callback run automatically on disable/reload | `PluginsContext` |

---

## Discovery & Lifecycle

1. **Plugin directory**:
   - **Domicile (Linux)**: `$XDG_CONFIG_HOME/piloti/plugins/<id>/manifest.json` (fallback `~/.config/piloti/plugins/`).
   - **Browser Dev (Web)**: `/home/user/.config/piloti/plugins/<id>/manifest.json` via `web-vfs` (plus optional file/JSON import in Settings).
2. **Settings persistence**:
   - Store `enabledPluginIds: string[]` in `SettingsContext` so plugins are opt-in and survive restarts.
   - Include a safe-mode flag (e.g. `?safe-mode=1` or holding `Shift` on startup) to skip loading JS plugins if one misbehaves.
3. **Cleanup & Hot Reload**:
   - Each enabled plugin receives an isolated `disposables: Array<() => void>` array.
   - Disabling or reloading runs `plugin.deactivate?.()` followed by all registered `onCleanup` callbacks and removes any injected `<style>` tags, menu bar items, and launcher providers.

---

## Suggested Implementation Plan

1. **Types & Loader (`src/lib/plugins/`)**:
   - `types.ts`: `PluginManifest`, `PilotiPluginContext`, `MenuBarStatusItem`, `LauncherProvider`.
   - `loader.ts`: Scan `piloti/plugins/*/manifest.json`, inject/remove CSS, load ESM via `Blob` URL, track disposables, and catch runtime errors.
2. **State Provider (`src/context/PluginsContext.tsx`)**:
   - Compose inside `DesktopStateContext.tsx` after `WindowsProvider` (or alongside `AppsProvider`) so plugins have access to notifications, windows, and settings.
   - Expose `plugins`, `statusItems`, `launcherProviders`, `togglePlugin(id)`, and `reloadPlugin(id)`.
3. **Shell Extension Slots**:
   - **`MenuBar.tsx`**: Render `statusItems` next to `SystemTray` inside a `ShellErrorBoundary`.
   - **`Launcher.tsx`**: Query `launcherProviders` alongside XDG apps, web apps, and files.
4. **Management UI**:
   - Add a simple **Plugins** section (in `SettingsApp` or `AppStoreApp`) listing discovered plugins with an enable/disable `Switch`, reload button, and any load error message.

---

## Window manager plugins

`ctx.windows.setPresentation` shows a window scaled and moved, the way the overview does, without changing its real geometry: clearing it puts the window back exactly where it was. Coordinates are in the work area (`ctx.windows.getWorkArea()`, the rectangle a maximized window fills). With `interactive: false`, an overlay takes the pointer and forwards `onPointerDown` / `onDoubleClick` to the plugin; `above: true` keeps the window over the others. Presentations a plugin set are cleared when it is disabled, and the shell drops those of closed windows.

With `floating: { resizable?, minWidth?, maxWidth? }` the presentation becomes a **floating window**, like the launcher: the shell moves it when dragged (anywhere; it snaps to edges within 16 px, resists past them and settles back inside, 6 px from the edges like the main menu) and, when resizable, scales it from its borders keeping the aspect ratio. `onChange({ x, y, width })` reports the result. The geometry lives in `src/lib/shell/floating-window.ts`, shared with the launcher.

`ctx.windows.addMenuItem` adds an entry to the window menus (the ⋮ button and the titlebar right-click menu), with an optional check mark.

The bundled **Picture in Picture** plugin (`~/.config/piloti/plugins/picture-in-picture/`) uses both: its window menu entry turns the window into a scaled floating window kept on top; drag it anywhere, drag a border to resize it, double-click to restore.

