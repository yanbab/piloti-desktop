# Architecture

One React tree (shell and built-in apps) on two engines. Code map:
[GUIDE.md](./GUIDE.md) · Linux, Wayland, XDG: [LINUX.md](./LINUX.md) ·
API: [API.md](./API.md).

```
UI (React)  ─►  piloti: Domicile's desktop + vfs, desktop, settings, plugins
                  ├─ native engine  →  Domicile, the disk, D-Bus, gsettings
                  └─ web engine     →  fake host, browser storage (demo)
```

## Layers

```
src/
  core/        plain TypeScript: ports/ (interfaces), apps/, config/, xdg/,
               files/, windows/, system/, state/, data/, locales/, util/
  platform/    adapters: shared/ (what UI code calls), native/ (Linux), web/ (demo)
  ui/          React: apps/, shell/, components/, context/, hooks/, dnd/, styles/
  piloti-*.tsx entry points: they pick the platform and mount the UI
```

| Layer | May import | Never |
|---|---|---|
| `core/` | `core/` | `platform/`, `ui/` |
| `platform/` | `core/`, `platform/` | `ui/` |
| `ui/` | `core/`, `platform/shared/` | `platform/native`, `platform/web` (types excepted) |

`tests/unit/engine-boundary.test.ts` checks it.

## Engines

| | Native | Web (demo) |
|---|---|---|
| Entry | `src/piloti-desktop.tsx` | `src/piloti-web.tsx` |
| Code | `platform/native/` | `platform/web/` |
| Files | the disk | browser storage |
| System | D-Bus, gsettings, processes | simulated |

- Check capabilities (`realFilesystem`, `systemServices`, `simulatedHardware`,
  `compositor`),
  not the engine.
- The native bundle never imports the web engine or the demo files:
  `piloti-web.tsx` injects the seed (`setVfsSeed`) and the demo capture.
- Each entry point calls `setEngine()` (`core/ports/engine.ts`).
  `platform/shared/` holds the bridges both engines share.
- Battery, audio, brightness, power profile, Wi-Fi, Bluetooth and media go
  through `hardware()` (`platform/shared/hardware.ts`, shape in `core/ports/hardware.ts`).
- System features use Domicile's `@domicile-desktop/system-*` libraries and
  GNOME/freedesktop services.
- On Linux: Domicile renders the shell, its compositor runs Wayland and
  portals, Piloti draws the desktop. A Wayland bug can sit in any of them.

## Loading

The Linux shell is `shell.js` plus `shell-chunks/`: apps and their libraries
load when first opened, so import them with `React.lazy` from the shell.
Nothing the entry imports up front may read `$HOME` (the build checks).

## Data

| What | API | Stored in |
|---|---|---|
| Files | `piloti.vfs`; views use `useVfsList` / `useVfsText`… | the disk |
| Settings | schema + key (`defineSettings`, `useDesktopSettings`) | desktop: dconf (Linux, schema installed) or `settings.ini`; apps: `ui/apps/<app>.ini` |
| Shell state | `core/state/vfs-state.ts`, read synchronously | `~/.local/state/piloti/`, `~/.cache/piloti/` |

- **One cache** (TanStack Query) for file reads; one watch per path, shared.
  The shell's own file operations update open views at once.
- **Settings** are what the user chose; window bounds, history and caches are
  state.
- File operations users can undo go through `platform/shared/fs-undo.ts`.
- **`piloti.vfs`** (`core/ports/vfs.ts`) is async, rejects on failure and writes
  through symlinks. `watch` calls once when in place, then on changes. On Linux it
  watches folders only (not recursive), shared and capped: inotify is scarce.
- `platform/shared/fs-bridge.ts` adds naming rules and listings for Folders and Desktop.
- Renames are announced on `platform/shared/renames.ts`; emblems go through
  `platform/shared/emblems.ts` (stored in each file's `metadata::emblems` on Linux, with
  the favorites listed in `favorites.json`). What only the demo does with files (open as a page, zip,
  download) is behind `core/ports/demo-files.ts`, set by `piloti-web.tsx`.
- `web-vfs.ts` (localStorage + IndexedDB) is the demo's storage. On Linux the disk
  is the only copy of files.
- Config and state are the exception held in memory, read through
  `vfs-state.ts`; `platform/native/state-store.ts` follows the disk.

## Shell

- The public `piloti.desktop`, `.settings` and `.plugins` are typed in
  `core/ports/shell-api.ts`; `ui/context/use-shell-api.ts` connects them to the shell.
- Notifications, session lock, power and capture live in `ui/context/backends/`;
  `SystemBackendsContext` joins them with the hardware state.
- Contexts are split and selected (`useWindowManagerSelector`,
  `useDesktopSettings([...])`, `useWindowActions`); the window store is external
  (`window-manager-store.ts`). MenuBar, Dock and Launcher are memoised.
- `DesktopStateProvider` nests settings, system backends, windows and apps.
  Components subscribe to slices, so a change re-renders only what uses it.
- Window manager: `ui/context/WindowsContext.tsx` holds the state and actions;
  its types, derived lists and self-contained hooks are in `ui/context/windows/`,
  pure logic in `core/windows/`. What a launch does is decided by
  `core/windows/launch-plan.ts` (tested); the context carries it out.
- Windows keep their DOM order and are hidden with CSS, so iframes don't reload.
- Bounds and workspace are saved per URL, document or app.
- Folders opened on a folder keeps view, sort and zoom per folder
  (`metadata::piloti-view`); opened without one, a single view in
  `apps/folders.ini`, with the info pane (`ui/apps/files/folder-view.ts`).
- New webview windows stay hidden until ready (2.5 s limit).

## Built-in apps

- Described by `core/data/files/usr/share/applications/piloti-*.desktop`
  (`X-Piloti-*` keys), read at start by `platform/shared/app-catalog.ts`.
- `core/data/catalog.ts` holds their menus. Clicks arrive as `piloti:app-action`
  events; apps publish menu state with `publishWindowMenuState`.
- Shell events are typed in `core/windows/shell-events.ts`.
- `DesktopIconsApp` (the spatial desktop) and Folders share
  `ui/components/ui/icon-grid.tsx`.
- Folders' list view is a tree (`ui/components/ui/folder-tree-view.tsx`): each open
  folder has its own listing and watch, released when it is hidden.
- Item drags find their target by `data-*` attributes (`ui/dnd/item-drop.ts`),
  so grids, the tree, the Dock and windows take each other's drops.

## Backends

Logic any app needs, in the shell or in its own process, is plain TypeScript: no
React, no engine, and a host passed in (`files`, `processes`, `dbus`, which is
all an app module has). Interfaces are in `core/ports/`, code in `core/<domain>/`; a
test keeps it so.

- **Apps** (`core/ports/apps.ts`, `core/apps/`): list the installed applications, ask
  the shell to open one. A module can't launch programs, so `createModuleApps`
  runs `piloti open`; the shell starts them itself.

## App modules

Small utilities run in the shell. Heavier apps can run in their own document,
for crash and performance isolation (not a sandbox).

| Host | How |
|---|---|
| In shell (default) | a React component |
| Web, isolated | `IsolatedAppFrame` iframe, messages via `platform/shared/app-bridge.ts` |
| Native, isolated | a Domicile app module in its own window |

Domicile app module:

- Exports `main` (`mount(Component)`); run with `domicile open --app /path/app.js`.
- An app takes what it needs from an `AppHost` (`core/ports/app-host.ts`: files,
  apps, state, close) and settings from `defineSettings`. The shell builds one
  with `platform/shared/app-shell-host.ts`, a module with `platform/shared/app-module-host.ts`.
- Own origin and storage per directory; gets `files`, `processes`, `dbus` only.
  It talks to the shell through files or D-Bus.
- Shown in a `<webview>`; the shell draws its controls and drag strip
  (`core/data/app-modules.ts`).
- Built with `npm run build:apps` → `dist/apps/<id>/` (`hello`, `calculator`, `image-viewer`, `selfies`, `system-monitor`, `texts`).

A module and the shell talk as in Electron (`core/apps/module-channel.ts`):

| Direction | Carried by |
|---|---|
| Module → shell: menu state, wanted size, what it watches | a shell command, `piloti send piloti-ipc …`, answered |
| Module → shell: close or focus a window | `piloti send piloti-ipc-do …`, answered |
| Shell → module: menu actions, "send again", the windows | the D-Bus signal `org.piloti.Shell.Message` |

After `#` in its URL, a module puts its open file (so opening it again focuses
the window) and the name it goes by. Renames and moves made in the shell are
still left in `~/.cache/piloti/moves/`. On the VM a round trip takes 35–150 ms,
and each module had its own renderer process; Domicile gives no pid for it.
Any program of the session can send these messages: not a security boundary.

In a module, menu state and actions are the same window events as in the shell,
so an app needs nothing of its own. A module that must not close refuses with
`beforeunload` and asks in its own window.

Each app adds only what it needs to `AppHost`; one that holds a file takes
`DocumentHost` (rename, follow renames, ask before closing).

An app that needs the desktop's windows takes a `ShellHost`
(`core/ports/shell-host.ts`: watch the windows, close or focus one). The shell
serves it from its window manager (`ui/hooks/use-shell-host.ts`); a module gets
it from `core/apps/module-shell.ts`: it adds `watch: ["windows"]` to its state
and the shell sends the list when it changes, at most every 250 ms; the demo's
iframe asks the page around it (`platform/shared/app-frame-shell.ts`). Names and
icons of other apps: `core/apps/describe-apps.ts` reads the `.desktop` files and
the icon theme.

**Porting an app:** a `host.ts` with what it needs, a `shell-host.tsx` for the
shell, a `main.tsx` calling `mountModuleApp` (`ui/apps/module-app.tsx`), a line in
`core/data/app-modules.ts` and `run-mode.ts`, and its name in `build:apps`. The
runtime gives every module the desktop's look and language (read from dconf as
the shell does, and followed), its settings and state, notifications
(`org.freedesktop.Notifications`) and its window chrome.

View ▸
Open New Windows Separately sets `run-in=isolated`; without an installed module
it opens in the shell.

Learned in the VM: set `color-scheme: light dark` or the page stays white; no
`SharedArrayBuffer`; the window is 0×0 at first render; dark mode and accent
come from the Settings portal; the file to open is passed in
`~/.cache/piloti/texts-open`.

## Domicile

Chromium as the Wayland compositor; the desktop is a web page. A shell is a
module exporting `Shell`; each window is an `<app app-id>` element placed with
CSS. Piloti is one such shell.

```tsx
import { mount } from "@domicile-desktop/react/mount";
import { useWindows } from "@domicile-desktop/react/windows";

const Desktop = () => (
  <main>{useWindows().map((w) => <app app-id={w.appId} key={w.appId} />)}</main>
);
export const Shell = mount(Desktop);
```

- `domicile ./shell.tsx` runs it; `domicile load-shell` reloads in place and
  keeps windows. A shell that fails keeps the running one.
- React ignores `on…` props on `<app>`: put handlers on a wrapper.
- CSP is `script-src 'self' 'wasm-unsafe-eval'`: no `eval`, no inline scripts.
- Domicile 1.3 sends shell commands as `{ words, sent }` and waits for
  `shell.answer` (SDK 3).

Docs: [how it works](https://domicile-desktop.com/docs/how-it-works) ·
[writing shells](https://domicile-desktop.com/docs/shells/writing) ·
[system access](https://domicile-desktop.com/docs/shells/system-access) ·
[SDK](https://domicile-desktop.com/docs/reference/sdk) ·
[React](https://domicile-desktop.com/docs/reference/react) ·
[CLI](https://domicile-desktop.com/docs/reference/cli) ·
[release notes](https://domicile-desktop.com/docs/release-notes)
