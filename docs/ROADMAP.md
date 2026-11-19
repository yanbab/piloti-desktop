# Piloti Desktop Roadmap

Actionable delivery plan organized into six milestones covering window management, filesystem & desktop interaction, built-in apps, Adwaita UI parity, system backends, and engineering quality.

---

## M1 — Compositor & Spatial Window Management
- [ ] **Multi-monitor spatial awareness**: Scope `savedWindowBounds` with monitor connector / resolution fallback (`bounds-per-display`) and clamp smoothly when displays hot-plug or scale changes.
- [ ] **Per-workspace window persistence refinements**: Preserve maximized/tiled state independently per spatial key and restore focus cleanly on login.
- [ ] **Spatial multi-icon drag offset preservation**: When dragging a multi-selection inside `DesktopIconsApp`, preserve relative grid column/row offsets rather than snapping only the primary dragged cell.
- [ ] **Native Wayland drag/resize parity**: Verify `domicile.windows.requests()` move/resize initiation on GTK4/Qt clients matches outer-shadow shell hitbox responsiveness.
- [ ] **Overview live snapshot performance**: Throttle `workspace-snapshots.ts` surface capture during rapid workspace swipes and pause off-screen animations while Overview is open.
- [ ] **Wayland popup focus & keyboard grab polish**: Audit nested transient menus (`waylandPopups`) so clicking outside dismisses grabs reliably on Domicile DRM.

---

## M2 — Files, Desktop & Virtual Filesystem
- [ ] **IndexedDB / OPFS backing store**: Store binary media (images, PDFs, audio, video) outside `localStorage` to raise the `web-vfs.ts` capacity limit cleanly without quota failures.
- [ ] **Undo / Redo transaction history**: Support `Ctrl+Z` inside `FilesApp` and `DesktopIconsApp` for Trash, Move, Rename, Duplicate, and Paste actions.
- [ ] **Sorting, grouping & emblem filtering**: Add Name / Kind / Date Modified / Size sort modes and filter-by-emblem (`Favorite`, `Important`, `Work`, `Personal`) chips in `FilesApp`.
- [ ] **Column resize & native List View DnD**: Support dragging rows directly from `FilesApp` List View onto folders, sidebar places, Desktop, Trash, and `Text Editor` / `Image Viewer`.
- [ ] **Path breadcrumb bar**: Replace plain folder title button with an interactive segment breadcrumb pill bar while keeping `Ctrl+L` path editing.
- [ ] **Batch rename dialog**: Rename multiple selected files using pattern/counter templates.

---

## M3 — Built-in Apps & Isolated App SDK
- [ ] **Typed `piloti-app-sdk` contract**: Extract `src/lib/app-bridge.ts` into a versioned internal package/module with handshake schema versioning and drop/open event hooks.
- [ ] **Text Editor multi-tab & Search/Replace**: Support opening multiple VFS files per window or spatial document focus handoff, plus `Ctrl+H` find-and-replace.
- [ ] **Image Viewer zoom-to-cursor & annotations**: Anchor wheel zoom around pointer coordinates, add crop aspect presets (`1:1`, `4:3`, `16:9`), and display image dimensions/EXIF in Info overlay.
- [ ] **Calculator scientific mode & tape**: Complete toggleable scientific functions and persistent calculation history drawer matching compact Adwaita styling.
- [ ] **Terminal pipes, redirects & history**: Support `|` / `>` / `>>`, `Ctrl+R` reverse history search, `grep`, and persistent command history across sessions.
- [ ] **Piloti Console VFS & Event Inspector**: Add a live `WindowEvent` / VFS diff viewer tab alongside the REPL & Logs tabs in `ConsoleApp`.

---

## M4 — Adwaita Design System & Accessibility
- [ ] **Full Adwaita primitive adoption**: Audit `ControlPanel`, `PortalDialogs`, and `AboutComputerDialog` to reuse shared grouped rows, search fields, and close-button tokens cleanly.
- [ ] **ARIA & Keyboard-only audit**: Ensure roving `tabIndex`, `aria-activedescendant`, and focus return work across `MenuBar`, `Launcher`, `Overview`, `AltTabSwitcher`, `Dock`, and `AdwSplitView`.
- [ ] **Reduced motion parity**: Ensure `settings.reduceMotion` disables non-essential spring/scale transitions cleanly across `Overview`, `Launcher`, `Dock`, and `Window` reveal fades.
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
- [ ] **Static lint & CI gate**: Configure automated `bun run typecheck && bun test && bun run build` checks in CI on every commit.

