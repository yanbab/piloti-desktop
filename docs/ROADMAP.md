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

- [ ] Include changed paths in VFS change events and BroadcastChannel messages **[§1.1]**.
- [ ] `subscribeWebVfs(listener, { under })` and migrate Folders, Desktop icons, Dock, Dock stacks, Text Editor, `subscribeVfsPath` **[§1.1, §1.3]**.
- [ ] Debounce `saveVfs` serialization to idle time, flush on `pagehide` **[§1.1]**.
- [ ] Perf counters (`measure()`): VFS size, writes/min, listener wake-ups, `reloadDir` time — shown in Console ▸ Infos **[§1.7]**.
- [ ] Unit test: one state write wakes only listeners under that path.

**Exit:** typing + moving the cursor in Text Editor with Folders open causes **0** `reloadDir` calls; VFS writes/min reported before/after in the release notes.

---

## 0.10.5 — Render & lifecycle (stabilization 2)

- [ ] Text Editor on CodeMirror `Compartment`s — no view rebuild on theme/prefs, undo history survives **[§1.2, §2.1]**.
- [ ] Split `WindowsContext` consumers: actions-only users → `useWindowActions()`; add `useFocusedWindow()` / `useWindowList()` **[§1.4]**.
- [ ] `React.memo` on Dock items, notification cards, Launcher tiles **[§1.4]**.
- [ ] Settings: single serialization per update **[§1.5]**.
- [ ] Event-driven Trash / Desktop refresh on native; minute-aligned clock **[§1.6]**.
- [ ] Listener hygiene: console-store guard, browser Domicile disposer, AdvancedPane timer **[§2.4, §2.5, §2.7]**.
- [ ] Typed `shell-events.ts` for `piloti:*` window events **[§2.9]**.

**Exit:** React Profiler shows that dragging a window does not re-render MenuBar/Dock/Launcher; no listener count growth after opening/closing 20 windows.

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
