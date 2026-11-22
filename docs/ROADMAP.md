# Piloti Desktop Roadmap

Actionable delivery plan organized into seven milestones covering window management, filesystem & desktop interaction, built-in apps, UI themes, system backends, packaging & display manager integration, and native Linux/Wayland polish.

---

## M1 — Compositor & Spatial Window Management
- [ ] **Multi-monitor spatial awareness**: Scope `savedWindowBounds` with monitor connector / resolution fallback (`bounds-per-display`) and clamp smoothly when displays hot-plug or scale changes.
- [ ] **Per-workspace window persistence refinements**: Preserve maximized/tiled state independently per spatial key and restore focus cleanly on login.
- [x] **Spatial multi-icon drag offset preservation**: When dragging a multi-selection inside `DesktopIconsApp`, preserve relative grid column/row offsets rather than snapping only the primary dragged cell.
- [ ] **Native Wayland drag/resize parity**: Verify `domicile.windows.requests()` move/resize initiation on GTK4/Qt clients matches outer-shadow shell hitbox responsiveness.
- [ ] **Overview live snapshot performance**: Throttle `workspace-snapshots.ts` surface capture during rapid workspace swipes and pause off-screen animations while Overview is open.
- [ ] **Wayland popup focus & keyboard grab polish**: Track upstream `domicile-compositor` grabbed `xdg_popup` pointer press fix (`popup_done` before `wl_pointer.button`) for GTK3/Qt6 menu clicks.

---

## M2 — Files, Desktop & Virtual Filesystem
- [ ] **IndexedDB / OPFS backing store**: Store binary media (images, PDFs, audio, video) outside `localStorage` to raise the `web-vfs.ts` capacity limit cleanly without quota failures.
- [ ] **Undo / Redo transaction history**: Support `Ctrl+Z` inside `FilesApp` and `DesktopIconsApp` for Trash, Move, Rename, Duplicate, and Paste actions.
- [x] **Sorting, grouping & emblem filtering**: Name / Kind / Date Modified / Size sort modes and filter-by-emblem (`Favorite`, `Important`, `Work`, `Personal`) chips in `FilesApp`.
- [x] **Canonical `data/files/` VFS & `.ini` config store**: Persist desktop and app settings via VFS-backed GSettings-style `.ini` files (`/home/user/.config/piloti/settings.ini`) with live editor sync and host mirroring.
- [ ] **Column resize & native List View DnD**: Support dragging rows directly from `FilesApp` List View onto folders, sidebar places, Desktop, Trash, and `Text Editor` / `Image Viewer`.
- [ ] **Path breadcrumb bar**: Replace plain folder title button with an interactive segment breadcrumb pill bar while keeping `Ctrl+L` path editing.
- [ ] **Batch rename dialog**: Rename multiple selected files using pattern/counter templates.

---

## M3 — Built-in Apps & Isolated App SDK
- [ ] **Typed `piloti-app-sdk` contract**: Extract `src/lib/app-bridge.ts` into a versioned internal package/module with handshake schema versioning and drop/open event hooks.
- [ ] **Text Editor multi-tab & Search/Replace**: Support opening multiple VFS files per window or spatial document focus handoff, plus `Ctrl+H` find-and-replace.
- [ ] **Image Viewer zoom-to-cursor & annotations**: Anchor wheel zoom around pointer coordinates, add crop aspect presets (`1:1`, `4:3`, `16:9`), and display image dimensions/EXIF in Info overlay.
- [x] **Calculator scientific mode & tape**: Toggleable scientific functions and persistent calculation history drawer matching compact Adwaita styling.
- [x] **Terminal pipes, redirects & history**: Support `|` / `>` / `>>`, `Ctrl+R` reverse history search, `grep`, and persistent command history across sessions.
- [x] **Desktop Console VFS & Event Inspector**: Live `WindowEvent` / VFS diff viewer tab alongside REPL & Logs tabs in `ConsoleApp`.
- [x] **GDM-style Login Screen & Display Manager Greeter**: `LoginScreenApp` works both as an in-desktop preview and as a standalone `greetd` Wayland Display Manager replacement (`dist/greeter.js`, `/usr/bin/piloti-greeter`, `GREETD_SOCK` PAM auth, `/etc/passwd` + `/usr/share/wayland-sessions` discovery, `systemctl` power controls).

---

## M4 — Adwaita Design System, Icons & Accessibility
- [x] **Full Adwaita primitive adoption**: Shared grouped rows, glass HUD materials, search fields, and close-button tokens across `ControlPanel`, `PortalDialogs`, `LoginScreenApp`, and `AboutComputerDialog`.
- [x] **ARIA & Keyboard-only audit**: Roving `tabIndex`, `aria-activedescendant`, and focus return across `MenuBar`, `Launcher`, `Overview`, `AltTabSwitcher`, `Dock`, and `AdwSplitView`.
- [x] **Reduced motion parity**: `settings.reduceMotion` disables non-essential spring/scale transitions cleanly across `Overview`, `Launcher`, `Dock`, and `Window` reveal fades.
- [x] **High-contrast & custom accent refinements**: Adwaita high-contrast theme variant, Piloti Lottie `animated/` icon theme inheriting `Papirus,Adwaita,hicolor`, and accent-tinted iconography.
- [x] **Localization completeness**: UI strings wrapped with `_()` across `en`, `fr`, and `es` locales.

---

## M5 — System Services, Web Apps & XDG Desktop Portals
- [ ] **App Store real Flatpak stream**: Stream live install/remove progress, update badges, and permissions summary from `src/lib/engine-desktop/flatpak.ts` in Domicile sessions.
- [x] **Web app manifest metadata & window menu install/remove**: Extract PWA manifest icons, display title, and start URL automatically; restore Install/Remove Web App in `MenuBar` and rounded Dock PWA icons.
- [x] **Full XDG Desktop Portal UI (`PortalDialogs.tsx` & `ControlPanel.tsx`)**:
  - Interactive `Screenshot`, `ScreenCast` (with frame preview & resolution badges), `PickColor` (with live coordinate HUD), `FileChooser` (Places, hidden files toggle, `SaveFiles` summary, filters, custom `FileChoice`), `AppChooser` (with `mimeapps.list` default persistence), `DynamicLauncher`, `GlobalShortcuts` (interactive chord capture & `taken` conflict warnings), `RemoteDesktop`, `Print` (printers + Save to PDF), and rich `Access` / `Account` / `Wallpaper` / `Usb` / `InputCapture` permission dialogs with `Escape`-to-cancel.
  - Active `PortalKind.Inhibit` blockers surfaced in both `PowerActionDialog` and `ControlPanel`.
- [ ] **Host Portals, Secret Service & Privacy Settings**:
  - Wire Secret Service (`org.freedesktop.secrets` / `gnome-keyring-daemon`) PAM unlock handoff cleanly into `greetd` / session boot.
  - Add per-app portal permission management (camera, mic, location, USB, shortcuts) in Desktop Settings.

---

## M6 — Packaging, CLI & Quality Engineering
- [x] **Engine isolation (`engine-desktop` vs `engine-web`)**: Decoupled Linux/Domicile runtime bridges from browser dev/demo engine with live engine switching.
- [x] **Debian `.deb` Packaging & CLI commands**:
  - Standard `debian/` metadata (`control`, `rules`, `changelog`, `copyright`, `postinst`, `postrm`) plus cross-platform `npm run build:deb` (`scripts/build-deb.mjs`).
  - Installs `/usr/bin/piloti`, `/usr/bin/piloti-session`, `/usr/bin/piloti-greeter`, `/usr/bin/piloti-webapp`, `/usr/bin/piloti-*` app wrappers, `/usr/libexec/piloti-desktop/piloti-greetd-client`, `/usr/share/wayland-sessions/piloti.desktop`, `/usr/share/applications/piloti-*.desktop`, `/usr/share/piloti-desktop/{shell.js,greeter.js,domicile.json,greeter-domicile.json,greetd.toml}`, and `/usr/share/icons/Piloti/`.
  - Live `domicile send-shell` command bridge wired in `Desktop.tsx` (`src/lib/shell-commands.ts`).
- [x] **Automated Unit, Functional & Playwright E2E Coverage**: Fast unit/functional test suite (`bun test`) covering XDG specs, portals/packaging, greeter parsers, VFS, window bounds, and shell commands.
- [ ] **CI Debian package verification job**: Add a Linux CI step running `dpkg-deb --info`, `lintian`, and clean install verification on Debian bookworm/trixie.

---

## M7 — Native Linux / Wayland Engine & XDG Specifications
- [x] **X11 / `xwayland-satellite` Integration**: Auto-detect `xwayland-satellite` in `$PATH` or local build directories, manage free X11 display sockets (`:0`, `:1`, ...), and inject `DISPLAY` for launched X11 apps.
- [x] **XDG Specifications wired end-to-end**:
  - **XDG Autostart**: Discovered from `/etc/xdg/autostart` + `~/.config/autostart`, launched once per Wayland session (`src/lib/engine-desktop/autostart.ts`), and configurable in Settings -> Advanced.
  - **Global Menu `dbusmenu` + `org.gtk.Menus`**: Wired via `@domicile-desktop/sdk/dbusmenu` in `src/lib/xdg/xdg-app-menu.ts`.
  - **Shared MIME-info (`globs2` / magic sniffing)** (`src/lib/xdg/xdg-mimeapps.ts`).
  - **XDG Recent Files (`~/.local/share/recently-used.xbel`)**: Wired into `fs-bridge.ts` and `FilesApp` Recents view.
  - **XDG Thumbnail Managing Standard (`~/.cache/thumbnails/{large,normal}/<md5>.png`)**: RFC 1321 MD5 URI hashing and host thumbnail lookup (`src/lib/xdg/xdg-thumbnails.ts`) wired into `fs-bridge.ts`.
  - **XDG Sound Theme cues**: Wired into screenshot capture and Trash empty (`src/lib/sound-effects.ts`).
- [x] **Lock Screen Linux polish**: Locale-aware clock (`en`/`fr`/`es`) and live `UnlockRefused` retry cooldown countdown.
- [ ] **Upstream Domicile compositor/engine fixes**: Track fixes for GTK3/Firefox KDE decoration ping-pong loop, Ozone DRM `vmwgfx` cursor hotspot offset `(+6, +4)`, and grabbed `xdg_popup` `popup_done` timing (see `_docs/ISSUES.md`).
- [ ] **On-demand thumbnail generator & native sound theme file playback**: Write generated PNG thumbnails to `~/.cache/thumbnails/normal/` and load `/usr/share/sounds/freedesktop/stereo/` audio files when present.
