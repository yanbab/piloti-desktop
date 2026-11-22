# Piloti Desktop Roadmap

Release-by-release plan for the **0.10.x** line (we stay on 0.10.x — see `AGENTS.md`).
Each release is small enough to ship in one or two weeks and has an exit check.
The audit behind the stabilization items is in
[`_docs/STABILIZATION.md`](../_docs/STABILIZATION.md) (section numbers in brackets, e.g. **[§1.1]**).

**Principles for every release:** stability before features · measure before optimizing ·
`npm run typecheck && npm test` green · `fr`/`es` strings updated ·
E2E / Debian VM only for compositor and window-manager changes.

---

## 0.10.3 — Spatial apps & everyday polish *(in progress)*

Already landed on `main`:
- [x] Nice file paths ("Desktop ▸ Screenshot.png", "SSD ▸ etc ▸ default", "USB ▸ Doc.pdf") in notifications, Control Panel, Lock Screen and Folders info pane, with SSD/HDD, USB, CD-ROM and SD Card device icons (`src/lib/shell/nice-path.ts`, `NicePathLabel.tsx`).
- [x] Help ▸ **Search menus** (Cmd/Ctrl+K, Meta+K grabbed on native): searches app, GTK/DBus, Edit, Window, Help and Piloti menu commands with shortcuts (`menu-commands.ts`, `HelpMenuSearch.tsx`).
- [x] Spatial Image Viewer: zoom, pan, rotation and unsaved crop restored per file (`~/.local/state/piloti/image-viewer-state.json`).
- [x] No Save/Discard/Cancel prompt for spatial apps; opt back in with `[Windows] confirm-unsaved-on-close=true` in `~/.config/piloti/general.ini`.
- [x] Removed the "Saved" pills from Text Editor and Image Viewer.
- [x] Text Editor code folding next to line numbers (`codeFolding=false` in `notepad.ini` to hide).

Remaining:
- [ ] Localize capture notifications and relative times (`Intl.RelativeTimeFormat`) **[§3]**.
- [ ] Use `NicePathLabel` in Recents, Trash "Original location", Launcher file results and file chooser **[§3]**.
- [ ] Add plugin `ctx.commands` entries to Help ▸ Search menus **[§3]**.
- [ ] Add `eslint-plugin-react-hooks` + `npm run lint` (warnings only) **[§2.10]**.

**Exit:** manual pass in browser demo (Cmd+K, close an edited file and reopen, screenshot notification) + one VM session.

---

## 0.10.4 — VFS performance (stabilization 1)

- [x] Changed paths in VFS change events and BroadcastChannel messages **[§1.1]**.
- [x] `subscribeWebVfs(listener, watch)` with `exact` / `children` / `subtree` watches; migrated Folders, Desktop icons, Dock Trash, Dock stacks, Desktop templates, Text Editor, `subscribeVfsPath`, and web-app `.desktop` sync in Settings **[§1.1, §1.3]**.
- [x] `saveVfs` updates memory immediately and writes `localStorage` on a 250 ms trailing debounce (1 s max wait); flushed on `pagehide` / `beforeunload` / hidden tab **[§1.1]**.
- [x] Reads no longer fetch and compare the whole VFS string from `localStorage`; the cache stays valid until another window/iframe writes (storage event / broadcast).
- [x] Emblem changes go through the cache instead of writing the VFS key directly.
- [x] Console ▸ Infos ▸ Performance: writes/min, flushes/min, flush time, JSON size, listener wake-ups vs skipped, cross-window reloads **[§1.7]**.
- [x] Unit test: state writes don't wake folder listeners (`tests/unit/web-vfs-change-paths.test.ts`).

**Measured (Chrome, 259 KB VFS):** 50 rapid state writes → 1 `localStorage` flush (was 50 × ~4 ms) and 400 listener wake-ups skipped; cross-tab sync and write-then-reload persistence verified.

Follow-ups moved to later releases: split `~/.local/state` / `~/.config/piloti` into separate storage records **[§1.1, L]**; generic `measure()` around `.desktop` scans and icon-theme resolution **[§1.7]**.

---

## 0.10.5 — Render & lifecycle (stabilization 2)

- [x] Text Editor on CodeMirror `Compartment`s — theme/preference changes reconfigure the live view; undo history, selection and folds survive **[§1.2, §2.1]**.
- [x] Window manager selector store: `useWindowManagerSelector()` + permanently stable `useWindowActions()` (latest-ref wrappers); MenuBar, Dock, Launcher, window menu buttons, Desktop, Control Panel, OSD, About, Files, Terminal, Calculator and icon grids subscribe to the slices they draw **[§1.4]**.
- [x] `useChromeSettings()` — settings without `savedWindowBounds` / `desktopIconPositions`, so drag commits don't re-render shell chrome; `React.memo` on MenuBar, Dock, Launcher, WindowMenuButton **[§1.4]**.
- [x] `settings.ini` serialized once per burst (150 ms debounce, flushed on page hide) instead of on every slider tick **[§1.5]**.
- [x] Native Trash (Dock) and Desktop folder refresh via Domicile `files.watch` (inotify) instead of 5–6 s polling; polling kept only as fallback (`engine-native/file-watch.ts`) **[§1.6]**.
- [x] MenuBar clock wakes once per minute (aligned, resyncs on tab visibility) instead of every second **[§1.6]**.
- [x] Listener hygiene: browser Domicile `resize` listener disposed on engine switch; Advanced ▸ Testing progress timer cleared on unmount **[§2.5, §2.7]**. (Console capture was already guarded — §2.4 not needed.)
- [x] Typed `shell-events.ts` (`emitShellEvent` / `onShellEvent`) for close negotiation, animated close, print, dismiss popups and Cmd+K **[§2.9]**.
- [x] Render counters (`render-stats.ts`) shown in Console ▸ Infos ▸ Performance.

**Measured (Chrome):** dragging a window by 180×90 px → **0** renders of MenuBar, Dock, Launcher, WindowMenuButton, Desktop and Control Panel (was ~2 commits' worth each, plus one per VFS/settings write). Focus switches still update the menu bar. Text Editor keeps the same view and undo across a theme switch.

Follow-ups: memoize notification cards / Launcher tiles once profiled; migrate the remaining `piloti:*` window events (`folder-drop-anim`, `workspace-zoom-from-thumb`, desktop actions) to `shell-events.ts`; menu bar clock ignores `clockShowSeconds` (pre-existing).

---

## 0.10.5 follow-up — Files, links & App Store polish *(landed after the render work)*

- [x] **Link files**: open `.desktop` (`Type=Link`), `.url` and `.webloc` (web pages, files or folders); **Make Link** in the Folders/Desktop context menu; link badge icon (`link-files.ts`).
- [x] **One opener for everything** (`useOpenPath` + `open-file.ts`): Folders, Desktop and dock stacks honour `mimeapps.list`, installed `.desktop` entries (our apps, web apps, .deb apps), launcher files, zip extraction and package files. Native files now open through it too.
- [x] **XDG mime**: far wider type inference (pdf, audio, video, archives, packages, links…), `sub-class-of` inheritance, built-in defaults when `mimeapps.list` is silent, **Open With** lists installed apps declaring the type, `.deb` / `.flatpakref` → App Store with an install confirmation (`pkexec apt install -y`).
- [x] **Fix**: launching the App Store from its `.desktop` entry (`Exec=piloti-appstore`) was not mapped to the built-in app.
- [x] Dock **folder stacks**: every entry has an icon (accent folders, file badges incl. link / PDF / launcher).
- [x] **App Store**: toolbar reduced to search + sources; List/Grid switcher and refresh button removed; sort order moved to View ▸ Sort by…; Software Sources is now a proper menu (no transparency / z-index bug); "System" → **System (Debian)**.
- [x] **Folders**: sort order and view mode moved out of the toolbar into the View menu (Sort by Name/Kind/Date/Size, Ascending/Descending).
- [x] **Consistency**: selected sidebar items use the accent colour in every app; duplicate "Edit" menu removed.
- [x] File management verified end-to-end in Chrome: Ctrl+C/X/V across folders, drag to sidebar places, into folders and onto the Desktop.

Still open from this pass: install/remove of Debian packages from the catalog (only upgrades and local `.deb` files are wired); `.desktop` launcher icons from their `Icon=`; link target names from `Name=`.

---

## 0.10.6 — Spatial apps, part 2

- [ ] Async close handshake in `app-bridge` (`canClose()`), so isolated iframe apps save state reliably **[§2.8]**.
- [ ] Shared `useSpatialDocumentState(path, schema)` hook used by Text Editor and Image Viewer (debounce, rename migration, LRU cap, flush on close).
- [ ] Text Editor: real find/replace (`@codemirror/search`), Enter / Shift+Enter navigation, `Ctrl+H` **[§3]**.
- [ ] Text Editor: keep folded ranges in spatial state.
- [ ] Image Viewer: zoom-to-pointer, separate "Actual Size" vs "Revert", image size from the window not the screen, mime sniffing **[§2.2, §2.3, §3]**.
- [ ] Image Viewer: crop aspect presets (1:1, 4:3, 16:9) and dimensions/EXIF in an Info overlay.
- [ ] Functional tests: spatial state round-trip for both apps.

**Exit:** close + reopen any edited document/image restores it exactly in both engines.

---

## 0.10.7 — Files & Desktop

- [ ] Path breadcrumb bar in Folders, built on `nice-path` segments (device icon + clickable segments); keep `Ctrl+L` text editing.
- [ ] Undo / Redo for Trash, Move, Rename, Duplicate, Paste in Folders and Desktop.
- [ ] Drag rows from List View onto folders, sidebar, Desktop, Trash, Text Editor and Image Viewer.
- [ ] Batch rename (pattern + counter).
- [ ] Native: real mount detection for nice paths (`/proc/self/mountinfo` + `rotational` → SSD/HDD; `udisks2` drive type → USB/SD/optical).

---

## 0.10.8 — Structure & engine isolation

- [ ] Split `AppStoreApp`, `FilesApp`, `WindowManager`, `ConsoleApp`, `WindowsContext` into folders (one PR each, no behavior change) **[§4]**.
- [ ] Split `SystemBackendsContext` into Capture / Notifications / Power providers **[§2.6]**.
- [ ] Remove `window.__PILOTI__` reads from components; add `fs-bridge` `readBinary` / `writeBinary` **[§4]**.
- [ ] Typed versioned `piloti-app-sdk` contract (handshake version, drop/open/close hooks) extracted from `app-bridge.ts`.

---

## 0.10.9 — Native session & packaging

- [ ] Multi-monitor bounds per display with clamping on hot-plug/scale change.
- [ ] Per-workspace maximized/tiled persistence and focus restore on login.
- [ ] Overview snapshot throttling during swipes.
- [ ] App Store: live Flatpak install/remove progress and permission summary.
- [ ] Per-app portal permissions (camera, mic, location, USB, shortcuts) in Settings ▸ Security.
- [ ] Secret Service unlock handoff from `greetd`.
- [ ] CI: `dpkg-deb --info`, `lintian`, clean install on Debian bookworm/trixie.
- [ ] On-demand thumbnails into `~/.cache/thumbnails/normal/`, freedesktop sound files when present.

---

## Tracking upstream (no release attached)

- Domicile compositor: grabbed `xdg_popup` `popup_done` timing, GTK3/Firefox decoration ping-pong, `vmwgfx` cursor hotspot offset — see `_docs/ISSUES.md`.
- Native drag/resize parity for GTK4/Qt clients via `domicile.windows.requests()`.

---

## Done (0.10.0 – 0.10.2)

- **Windows:** spatial multi-icon drag offsets; CSD/SSD drag threshold with reliable double-click maximize.
- **Files & VFS:** sorting/grouping/emblem filters; canonical `data/files/` tree; VFS-backed `.ini` settings with live editor sync and host mirroring; IndexedDB store for large media.
- **Apps:** Calculator scientific mode & tape; Terminal pipes/redirects/history; Console VFS & event inspector; GDM-style Login Screen and `greetd` greeter; Text Editor HTML Design / INI / JSON preview.
- **Design:** Adwaita primitives; keyboard/ARIA audit; reduced motion; high contrast & accent tinting; Piloti animated icon theme; `en`/`fr`/`es`.
- **Services:** PWA metadata & web app install; full XDG Desktop Portal UI; inhibitors in power dialog & Control Panel.
- **Packaging:** engine isolation (native vs web); Debian package and CLI wrappers; unit/functional/E2E suites.
- **Native:** `xwayland-satellite`; XDG autostart, global menus, MIME, recents, thumbnails, sound theme; Lock Screen polish.
