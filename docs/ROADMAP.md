# Piloti Desktop Roadmap

Actionable delivery plan organized into seven milestones covering window management, filesystem & desktop interaction, built-in apps, UI themes, system backends, code quality, and the native Linux/Wayland engine. See [docs/native.md](./native.md) for architectural notes, toolkit behavior, DRM findings, and XDG/Portal specifications.

---

## M1 — Compositor & Spatial Window Management
- [ ] **Multi-monitor spatial awareness**: Scope `savedWindowBounds` with monitor connector / resolution fallback (`bounds-per-display`) and clamp smoothly when displays hot-plug or scale changes.
- [ ] **Per-workspace window persistence refinements**: Preserve maximized/tiled state independently per spatial key and restore focus cleanly on login.
- [x] **Spatial multi-icon drag offset preservation**: When dragging a multi-selection inside `DesktopIconsApp`, preserve relative grid column/row offsets rather than snapping only the primary dragged cell.
- [ ] **Native Wayland drag/resize parity**: Verify `domicile.windows.requests()` move/resize initiation on GTK4/Qt clients matches outer-shadow shell hitbox responsiveness.
- [ ] **Overview live snapshot performance**: Throttle `workspace-snapshots.ts` surface capture during rapid workspace swipes and pause off-screen animations while Overview is open.
- [ ] **Wayland popup focus & keyboard grab polish**: Audit nested transient menus (`waylandPopups`) so clicking outside dismisses grabs reliably on Domicile DRM.

---

## M2 — Files, Desktop & Virtual Filesystem
- [ ] **IndexedDB / OPFS backing store**: Store binary media (images, PDFs, audio, video) outside `localStorage` to raise the `web-vfs.ts` capacity limit cleanly without quota failures.
- [ ] **Undo / Redo transaction history**: Support `Ctrl+Z` inside `FilesApp` and `DesktopIconsApp` for Trash, Move, Rename, Duplicate, and Paste actions.
- [x] **Sorting, grouping & emblem filtering**: Add Name / Kind / Date Modified / Size sort modes and filter-by-emblem (`Favorite`, `Important`, `Work`, `Personal`) chips in `FilesApp`.
- [ ] **Column resize & native List View DnD**: Support dragging rows directly from `FilesApp` List View onto folders, sidebar places, Desktop, Trash, and `Text Editor` / `Image Viewer`.
- [ ] **Path breadcrumb bar**: Replace plain folder title button with an interactive segment breadcrumb pill bar while keeping `Ctrl+L` path editing.
- [ ] **Batch rename dialog**: Rename multiple selected files using pattern/counter templates.

---

## M3 — Built-in Apps & Isolated App SDK
- [ ] **Typed `piloti-app-sdk` contract**: Extract `src/lib/app-bridge.ts` into a versioned internal package/module with handshake schema versioning and drop/open event hooks.
- [ ] **Text Editor multi-tab & Search/Replace**: Support opening multiple VFS files per window or spatial document focus handoff, plus `Ctrl+H` find-and-replace.
- [ ] **Image Viewer zoom-to-cursor & annotations**: Anchor wheel zoom around pointer coordinates, add crop aspect presets (`1:1`, `4:3`, `16:9`), and display image dimensions/EXIF in Info overlay.
- [x] **Calculator scientific mode & tape**: Complete toggleable scientific functions and persistent calculation history drawer matching compact Adwaita styling.
- [x] **Terminal pipes, redirects & history**: Support `|` / `>` / `>>`, `Ctrl+R` reverse history search, `grep`, and persistent command history across sessions.
- [x] **Piloti Console VFS & Event Inspector**: Add a live `WindowEvent` / VFS diff viewer tab alongside the REPL & Logs tabs in `ConsoleApp`.

---

## M4 — Adwaita Design System & Accessibility
- [ ] **Full Adwaita primitive adoption**: Audit `ControlPanel`, `PortalDialogs`, and `AboutComputerDialog` to reuse shared grouped rows, search fields, and close-button tokens cleanly.
- [ ] **ARIA & Keyboard-only audit**: Ensure roving `tabIndex`, `aria-activedescendant`, and focus return work across `MenuBar`, `Launcher`, `Overview`, `AltTabSwitcher`, `Dock`, and `AdwSplitView`.
- [x] **Reduced motion parity**: Ensure `settings.reduceMotion` disables non-essential spring/scale transitions cleanly across `Overview`, `Launcher`, `Dock`, and `Window` reveal fades.
- [ ] **High-contrast & custom accent refinements**: Add Adwaita high-contrast theme variant in `adwaita.css` and `AppearancePane`.
- [ ] **Localization completeness**: Extract remaining hardcoded English UI strings into `src/locales/en.json` and `fr.json` via `_()`, and audit pluralization/date formatting.

---

## M5 — System Services, Web Apps & Portals
- [ ] **App Store real Flatpak stream**: Stream live install/remove progress, update badges, and permissions summary from `src/lib/gnome/flatpak.ts` in Domicile sessions.
- [ ] **Web app manifest metadata**: Extract PWA manifest icons, display title, and start URL automatically when pinning custom web apps.
- [ ] **Network & Bluetooth inline diagnostics**: Add signal details, saved-network forget/disconnect actions, and device pairing state in `ControlPanel` & `Settings`.
- [ ] **Portal & ScreenCast polish**: Add window vs display source thumbnails in `PortalDialogs` and one-click annotate/copy-to-Desktop for screenshots.
- [ ] **Session power & lock screen resilience**: Handle DPMS wake, PAM retry lockouts, and suspend/hibernate feedback cleanly in `LockScreen` and `PowerActionDialog`.

---

## M6 — Code Health, Testing & Packaging
- [ ] **Browser E2E Playwright harness**: Add automated end-to-end checks for Desktop ↔ Files drag-and-drop, outer-shadow resize edges, ready-to-show web app reveals, and keyboard shortcuts.
- [ ] **Component & hook unit test expansion**: Add DOM/Testing-Library tests for `AdwSplitView`, `FileItemContextMenu`, `useSidebarKeyboardNav`, and `WindowsContext` spatial bounds lifecycle.
- [ ] **Bundle size & lazy chunk optimization**: Audit `vite.shell.config.ts` and `vite.config.ts` chunk splitting (especially CodeMirror languages in `TextEditorApp` and SVG icon atlases).
- [x] **Static lint & CI gate**: Configure automated `bun run typecheck && bun test && bun run build` checks in CI on every commit.

---

## M7 — Native Engine, XDG Completeness, Wayland WM & Portals
- [ ] **Upstream Domicile compositor & engine parity**:
  - Upgrade VM/packaging past `cprussin/domicile#2049` so `xdg_toplevel.move` (`kind=5`) and `xdg_toplevel.resize` (`kind=6`) work natively on GTK3, Firefox, Chromium, and Qt CSD windows without `Alt/Meta + drag`.
  - Fix `org_kde_kwin_server_decoration` / `zxdg_toplevel_decoration_v1` negotiation in `domicile-compositor` (`decorations.rs`) so GTK3/Chromium client-side decoration requests do not trigger tight `request_mode(1)` <-> `mode(2)` loops.
  - Fix DRM cursor hotspot (`drmModeSetCursor2` / `HOTSPOT_X` & `HOTSPOT_Y`) in `domicile-engine` so VMware `vmwgfx` and para-virtualized GPUs do not offset click targets down-right by `(+6, +4)`.
- [ ] **Cross-toolkit Wayland WM test matrix**: Verify SSD/CSD detection, interactive move/resize, keyboard/pointer grabs, `waylandPopups` geometry, fractional scaling, and multi-monitor positioning across GTK2 (`pcmanfm`), GTK3 (`gnome-connections`, `gnome-disks`), GTK4/Libadwaita (`nautilus`), Chromium, Firefox, Electron, and Qt apps.
- [x] **Full XDG Desktop Portal UI implementation (`PortalDialogs.tsx`)**:
  - Build native-feeling `FileChooser` (`Open`, `Save`, `SaveFiles`, filters, custom `FileChoice` controls) backed by `domicile.files` / `FilesApp` components.
  - Build `AppChooser` using `xdg-desktop-entry.ts` + `xdg-mimeapps.ts` and MIME association persistence.
  - Complete `DynamicLauncher`, `GlobalShortcuts` chord binder, `RemoteDesktop`, and `Print` portal dialogs instead of falling back to the generic dismissal prompt.
  - Add Power / Session inhibitor visibility (`PortalKind.Inhibit`) inside `PowerActionDialog` so apps blocking logout/restart/suspend explain why and offer override/wait.
- [ ] **Host Portals, Secret Service & D-Bus Bridges**:
  - Wire Secret / Password unlock prompts (`org.freedesktop.secrets` / GNOME Keyring / `pam` unlock handoff) cleanly into login and session startup.
  - Wire OpenURI / Notifications action callbacks / Documents portal paths / Contacts & Location permissions through `xdg-desktop-portal` + Domicile.
- [x] **Missing useful XDG Specifications**:
  - **XDG Autostart**: Parse and manage `~/.config/autostart/*.desktop` and `/etc/xdg/autostart/` with enable/disable UI in Settings.
  - **Global Menu `dbusmenu` / Canonical Registrar**: Wire `@domicile-desktop/sdk/dbusmenu` alongside `xdg-app-menu.ts` (`org.gtk.Menus`) so Electron, Qt, and LibreOffice export menus to `MenuBar`.
  - **Shared MIME-info & Thumbnails**: Add `globs2` / magic header sniffing in `xdg-mimeapps.ts` and XDG Thumbnail Managing Standard (`~/.cache/thumbnails/`) support in `FilesApp` / `DesktopIconsApp`.
  - **XDG Recent Files & Sound Theme**: Support `~/.local/share/recently-used.xbel` in Files/Launcher and FreeDesktop Sound Theme alert cues in `sound-effects.ts`.

