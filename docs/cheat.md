# Domicile SDK Cheat Sheet

Quick reference for `@domicile-desktop/sdk` and `@domicile-desktop/react` as used in Piloti.  
See [architecture.md](./architecture.md) for Piloti's React wrapper hooks (`useApps()`, `useWindowManager()`, etc.).

---

## 1. Setup & React Entry

```tsx
// desktop.tsx (compositor entry)
import { mount } from "@domicile-desktop/react/mount";
export const Shell = mount(PilotiShell);
```

- `useDomicile()` (`@domicile-desktop/react/domicile-provider`) → full `Domicile` object
- `domicile.on("compositorreplaced", cb)` → compositor restarted; streams/calls auto-reset
- **Reactive hooks** (`@domicile-desktop/react/*`):
  - `useWindows()` → `readonly ClientWindow[]`
  - `useFocusedWindow()` → `string | undefined`
  - `useDisplays()` → `readonly Display[] | undefined`
  - `usePortalRequests()`, `useCapturing()`, `useBoundShortcuts()`, `usePortalWallpaper()`
- **Result & Stream helpers**: Async system calls return `Promise<Result<T, SystemError>>` (`res.match({ Ok: (v) => …, Err: (e) => … })`) and listeners return `{ items: ReadableStream<T>, stop: () => void, ended }`.

---

## 2. Wayland Windows (`domicile.windows`)

### State & Events
- `windows.list`: `readonly ClientWindow[]` (`appId`, `title`, `desktopId`, `pid`, `width`, `height`, `minWidth/Max`, `dialog`, `clientFrame`, `transientFor`, `anchor`, `urgent`, `inhibitsShortcuts`, `cursor`, `cursorImage`, `parent`, `x`, `y`, `grab`, `pointerConstraint`, `frame`)
  - Toplevel if `parent === null`; popup if `parent !== null` (coordinates `x, y` relative to parent).
- `windows.focused`: `string | undefined` (`undefined` when the shell page holds keyboard focus)
- Events: `windows.on("change" | "focuschange" | "focusrequest", cb)` (note `"focusrequest"` receives `(appId: string)`).

### Control Methods
```ts
domicile.windows.focus(appId)           // Give keyboard focus to client
domicile.windows.focusShell()           // Return keyboard focus to shell HTML
domicile.windows.close(appId)           // Ask client to close (may refuse)
domicile.windows.setBounds(appId, { x, y, width, height }) // Place <app> box in CSS px (0×0 hides/suspends)
domicile.windows.pointerConstrained(appId, active)         // Grant/release lock or confine
domicile.windows.syncFrames()           // Enable frame-synced moves via ClientWindow.frame
```

### States, Requests & Bells
- `domicile.windows.setStates(appId, states)` — pass array of `WindowState` (`@domicile-desktop/sdk/window-state`):
  `TiledLeft` (`0`), `TiledRight` (`1`), `TiledTop` (`2`), `TiledBottom` (`3`), `Maximized` (`4`), `Fullscreen` (`5`), `Resizing` (`6`)
  - Tiled states tell GTK4/Libadwaita CSD clients to drop outer drop shadows on touching edges.
- `await domicile.windows.requests()` → stream of `WindowRequest`:
  `kind` (`WindowRequestKind`): `Maximize`, `Unmaximize`, `Fullscreen` (`display?`), `Unfullscreen`, `Minimize`, `Move`, `Resize` (`edges: ResizeEdge`).  
  *(Compositor grants none automatically—the shell handles them.)*
- `await domicile.windows.bells()` → stream of `{ appId: string | undefined }`.

### `<app>` Custom Element (`@domicile-desktop/sdk/app-element`)
```tsx
<app app-id={win.appId} resizing={isResizing} />
```
- Props/attributes: `appId` (`app-id`), `resizing` (defers client reflow while dragging), `frame` (`syncFrames()`).
- DOM CustomEvents (all bubble; detail `{ appId }` or `{ appId, pressed }`):
  - `"domicile-focus-requested"` (`APP_FOCUS_REQUESTED_EVENT`) — cancelable; call `e.preventDefault()` to handle focus yourself
  - `"domicile-focus-release-requested"` (`APP_FOCUS_RELEASE_REQUESTED_EVENT`) — cancelable; call `e.preventDefault()` when clicking custom window chrome
  - `"domicile-presented"`, `"domicile-suspended"`, `"domicile-resumed"`

---

## 3. Apps & Browser Windows (`domicile.browser` + XDG)

Domicile itself discovers processes/windows, not `.desktop` catalogs. Piloti indexes XDG apps and folders in [AppsContext.tsx](../src/context/AppsContext.tsx) via [xdg-desktop-entry.ts](../src/lib/xdg-desktop-entry.ts), [xdg-icon-theme.ts](../src/lib/xdg-icon-theme.ts), and [xdg-user-dirs.ts](../src/lib/xdg-user-dirs.ts).

### Browser / Web App Windows (`domicile.browser`)
- `browser.windows`: `readonly BrowserWindow[] | undefined` (`id`, `url`, `title`, `popupWindow`, `width`, `height`, `isPrivate`, `partition`, `isApp`, `appId`, `isCaptured`)
- `browser.open(url, { partition? })`
- `browser.openPrivate(url)`
- `browser.openApp(url, { id?, reuse? })` (`AppReuse.New | Focus | Navigate`)
- `browser.close(id)`
- `await browser.countMatches(id, selector)` → `Promise<number>`
- `await browser.fetch(url, { method?, headers?, body?, sapisidHashOrigin? })` → `Promise<FetchResponse>`
- `browser.on("change", cb)`
- Embed inside shell via `<webview window={win.id} />`.

### Launching XDG Apps & Helpers (Piloti Shell)
- `useApps()` → `installedXdgApps`, `xdgUserDirs`, `fallbackAppIconUrl`, `getAppIconUrl(id)`, `launchXdgEntry(entry, actionId?)`, `openXdgFolder(folder)`
- Launch GNOME apps with `XDG_CURRENT_DESKTOP=GNOME`: `launchWithGnomeEnv(domicile, argv)` in [gnome-bridge.ts](../src/lib/gnome-bridge.ts).

---

## 4. Processes & D-Bus (`domicile.processes`, `domicile.dbus`)

### Processes (no shell wrapper unless invoking `"sh"`)
```ts
// 1. Fire-and-forget app launch
domicile.processes.launch(["kitty"]);
domicile.processes.launch(["env", "XDG_CURRENT_DESKTOP=GNOME", "nautilus", "--new-window"]);

// 2. Run to completion and collect stdout/stderr
const res = await domicile.processes.run(["uname", "-a"], { cwd?, env? });
// res -> Result<{ code?: number, signal?: number, stdout: string, stderr: string }, SystemError>

// 3. Streaming subprocess with stdin/kill
const subRes = await domicile.processes.spawn(["journalctl", "-f"], { cwd?, env?, stdin?: true });
// Ok(sub) -> sub.stdout, sub.stderr, sub.exited, sub.write(data), sub.closeStdin(), sub.kill(Signal.Term)
```

### D-Bus (`domicile.dbus`)
```ts
import { Bus } from "@domicile-desktop/sdk/system";

await domicile.dbus.call({
  bus: Bus.Session, // or Bus.System
  destination: "org.freedesktop.portal.Desktop",
  path: "/org/freedesktop/portal/desktop",
  interface: "org.freedesktop.portal.Settings",
  member: "Read",
  signature: "ss",
  body: ["org.gnome.desktop.interface", "color-scheme"],
});

await domicile.dbus.match({ bus: Bus.Session, interface: "…", member: "…" });
```

---

## 5. Files (`domicile.files`)

Relative paths resolve from `$HOME`. Most calls fail with `SystemErrorKind.Locked` when locked.

```ts
await domicile.files.readText(".config/user-dirs.dirs")   // Promise<Result<string, SystemError>>
await domicile.files.read(path, { offset?, length? })     // Promise<Result<Uint8Array, SystemError>>
await domicile.files.write(path, data, { atomic?: true }) // atomic: false for /sys or /proc
await domicile.files.createDir(path)
await domicile.files.readDir(path)                        // Ok(DirEntry[]) -> { name, fileType: FileType }
await domicile.files.stat(path)                           // { fileType, size, modifiedMs, realPath }
await domicile.files.watch(path)                          // Listening<Listened<string>>
await domicile.files.search(query)                        // Promise<{ files, matched, indexing }> (auto-aborts older search)
```

---

## 6. Displays, Theme & Appearance

### Displays (`domicile.displays`)
- `displays.list`: `readonly Display[] | undefined` (`name`, `x`, `y`, `width`, `height`, `scale`, `modeWidth`, `modeHeight`, `refreshMhz`, `adaptiveSync`, `transform`)
- `displays.on("change", cb)`
- `await displays.setColorTemperature(kelvin, display?)` (`1000..6500`; `6500` resets)
- `await displays.sleep(display?)` / `await displays.wake(display?)`
- `await displays.addVirtual(mode)` (headless output for casting)

### Theme & Appearance
- `domicile.theme`: `current` (`"dark" | "light" | undefined`), `windows`, `set(theme)`, `captured(theme)`, `on("change" | "windowschange", cb)`
- `domicile.appearance`: `accentColor` (`#rrggbb | undefined`), `highContrast`, `reducedMotion`, `on("change", cb)`

---

## 7. Input, Shortcuts, Gestures & Pointer

- `domicile.keyboard`:
  - `grab(chord, { whileInhibited? })` / `ungrab(chord)` (Sway syntax, e.g. `"Alt+Space"`, `"Meta+Shift+l"`)
  - `modifiers`: `{ alt, ctrl, shift, meta } | undefined`
  - `on("shortcut" | "shortcutrelease" | "modifierschange", cb)`
  - `keymaps()`, `selectKeymap(choice)`, `switchShortcutsInhibitor(action)`
- `domicile.gestures`:
  - `grab("swipe:3" | "pinch" | "hold" | "edge:left" | …)` / `ungrab(gesture)`
  - `on("gesture", ({ kind, phase, fingers, dx, dy, scale, rotation, canceled, edge }) => …)`
- `domicile.pointer`:
  - `warp(x, y, unlessOver?: Box)`

---

## 8. Session, Lock & Capture

- `domicile.session`:
  - `idle`, `locked` (`boolean | undefined`)
  - `lock()`, `unlock(passphrase)`
  - `on("idlechange" | "lockchange", cb)`
  - `idleWarnings()`, `idleHolds()`, `unlockRefusals()`
- `domicile.capture`:
  - `await capture.screenshot()` → `{ kind: ScreenshotKeptKind, path? }`
  - `await capture.screenRecord()` → WebM path in `$XDG_VIDEOS_DIR/Screen recordings/`
  - `await capture.preview(previewedWindow)` → `Result<string, SystemError>` (`data:image/png;base64,…`)

---

## 9. Notifications, Tray, Portals, Clipboard & Shell Config

- `domicile.notifications`: `list`, `dismiss(ids)`, `invoke(id, action)`, `reply(id, text)`, `on("change", cb)`
- `domicile.tray`: `items`, `activate(id, "primary" | "secondary" | "context")`, `menu(address, cb)`, `on("change", cb)`
- `domicile.portals`: `requests`, `capturing`, `boundShortcuts`, `wallpaper`, `answer(id, answer)`, `stopCapturing(id)`, `pauseRecording(id)`, `resumeRecording(id)`, `discardRecording(id)`, `fireShortcut(id, "pressed" | "released")`, `on("change", cb)`
- `domicile.clipboard`: `entries` (`{ id, image, preview, thumbnail }`), `copy(id)`, `on("change", cb)`
- `domicile.shell`: `options`, `commands()`, `on("optionschange", cb)`

