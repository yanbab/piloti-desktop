# Changelog

## 0.3.0 (2026-11-17)

- **Window Manager & Edge Snapping**: Unified Adwaita `WindowTitlebar` (`46px` height) and circular monochrome `WindowControls` respecting GNOME `buttonLayout` (`:close` default), added titlebar double-click maximize/restore, staggered multi-window cascade (`+24px, +24px`), fixed left/right edge snapping reverting to pre-tile size (and tightened snap zone to `12px` left/right, `10px` top), and clamped window bounds cleanly.
- **Web Apps & Icons**: Renamed built-in web apps (`Settings (Web)`, `Files (Web)`, `Terminal (Web)`, `Text Editor (Web)`), added custom app icons and aligned web app icons vertically on the Dock, added webview URL bar and loading state, and removed icon drop shadows for a crisp desktop.
- **Terminal (Web)**: Updated prompt to `<path>> `, kept entered commands white, styled folders in bold blue in `ls`, added `Tab` command autocompletion, `ArrowUp`/`ArrowDown` history navigation, and full-page text cursor.
- **Global MenuBar & Keyboard Navigation**: Updated Desktop menu (`Piloti -> Desktop`, `File` with New Window / New Text File / Screenshot / Record / Restart Desktop, `View` with Launcher / Control Panel / Settings (Web) / DevTools, `Help` with Shortcuts / Report Issue), added `Ctrl+Esc` to open the Piloti menu, and fixed continuous `ArrowLeft`/`ArrowRight` navigation across menus, Launcher, and Control Panel.
- **Launcher**: Split `Apps` and `Web apps` categories, renamed `Recent` and `Actions`, muted and aligned inline autocomplete text (`InlineCompletionInput`), and added `ArrowUp`/`ArrowDown` search query history navigation.
- **Control Panel & Notifications**: Moved brightness/volume sliders above quick toggles with OSD overlay feedback, hid empty notifications section, removed hover states on controls, matched active pill feedback (`color-mix` lighter accent), locked notification banners to top-right, and added real Web Audio chime playback (`sound-effects.ts`) for **Play Test Alert**.
- **Desktop, Files & Settings**: Updated Desktop context menu (`New Folder`, `New Text File`, `Align Icons`, `Change Wallpaper`), switched icon/file selection to `onPointerDown`, added `useSidebarKeyboardNav` for arrow/Tab sidebar navigation, removed row descriptions in Settings panes, and removed CSS transitions on active states.
- **DevTools & Architecture**: Set Console & Logs background to white/black, added DevTools tables, extracted `NotificationsContext`, modularized `src/lib/gnome/`, added `storage-cache.ts` debounced `localStorage` persistence, switched BSOD background to black, and updated `docs/ARCHITECTURE.md`, `docs/API.md`, and `docs/WELCOME.html`.

## 0.2.0 (2026-11-16)

- **Uppercase docs, text/md default editor & default pinned apps**: Uppercased `docs/` filenames, opened text/markdown/code VFS files in `TextEditorApp` by default, and set default pinned apps to Files, Terminal, Application Store, and DevTools (with `org.gnome.DevTools` Adwaita icon).
- **Respect Wayland/GTK size limits & dialog hints**: Honored `maxWidth`/`maxHeight` in `clampWindowBounds` and `Window`, respected `dialog`/`transientFor` parent centering and small committed sizes, and lowered built-in fallback `minSize` so app `defaultSize` is preserved.
- **Host-to-VFS file drag-and-drop**: Added `importExternalFilesToVfs` in `web-vfs.ts` so dragging files from the user's OS onto Desktop or `FilesApp` copies them into the virtual filesystem.
- **Unified headerbar layout, Dock order & minimize flash fix**: Standardized all SSD/CSD headers (`WindowMenuButton` left, title center, icon-only `WindowControls` right), fixed Dock icon order stability on minimize/maximize, respected `dockPosition` in `tileWindow`, and eliminated the 1-frame flash at the end of minimize animations.
- **WM compact headers, icon-only controls & App Store progress**: Reduced SSD/web app titlebar height (`h-7`/`h-8`), switched window controls to icon-only without circles, prioritized titlebar double-click maximize/restore, kept cursor unchanged while dragging, and added a 500–1000ms progress bar in `AppStoreApp` during install/remove.
- **Menubar notification bell**: Moved the bell icon to the left of the status cluster, greyed out when empty or DND.
- **Launcher polish**: Removed the inline completion `– description` hint and hid the visible bottom resize bar in favor of edge resizing.
- **Titlebar menu button**: Replaced the titlebar app/window icon with a 3-vertical-dots menu button.
- **Theme-color caching**: Cached web app `<meta name="theme-color">` values in `localStorage` for instant headerbar tinting.
- **Consolidated `app.json` & Web Games**: Consolidated curated web apps into `src/data/app.json` and added 9 iframe-friendly games under `Games`.
- **Web view headerbar tinting**: Parsed `<meta name="theme-color">` (with `prefers-color-scheme` and contrast foreground) plus a Vite `/__web_meta` dev proxy.
- **Text Editor drag & context menu**: Added `Edit in Text Editor` to file context menus and drag-and-drop onto the Text Editor Dock icon/window with a drop indicator.
- **Adwaita icons restored**: Added Adwaita SVGs and fallbacks for Terminal, Web View, DevTools, Text Editor, and Application Store.
- **Window Manager header interactions**: Fixed double-click header maximize and added drag-to-restore on maximized window headers.
- **Application Store**: Added `Application Store` (with Piloti menu entry, sidebar `Search`, borderless favicons, 2-line cards, and main-view bottom action bar) and seeded 10 default web apps in the web Launcher.
- **Dock context menu**: Renamed labels to `Hide` / `Zoom` and aligned `Dock Settings…` with checkbox labels using `inset`.
- **Web Text Editor & Fake Terminal**: Added minimal instant-save `TextEditorApp` and `TerminalApp` (`cd`, `pwd`, `ls`, `mkdir`, `touch`, `cat`, `rm`, `open`, `top`) over `localStorage` VFS.
- **BSOD recovery screen**: Added `ShellErrorBoundary` with `Reload Shell`, `Clear Cache & Reload`, and `Try to Continue`, plus `bsod()` in Console REPL.
- **Dock spacing**: Reduced Dock vertical/edge padding to `7px` and centered icons along the dock axis.
- **GTK icon theme sync**: Synced `org.gnome.desktop.interface icon-theme` into `~/.config/gtk-4.0/settings.ini` and `~/.config/gtk-3.0/settings.ini`.
- **Dock positions & launch feedback**: Added left/bottom/right flush Dock placement, pulsing launch transparency, and per-window indicator dots.
- **Wallpaper & hover polish**: Fixed switching from image to solid/gradient wallpapers and removed hover delays on menubar triggers for instant `:active` feedback.
- **VFS web app launch**: Opened HTML, text, image, and media VFS files directly as standalone web apps with Adwaita mimetype icons.
- **Console inspection polish**: Abbreviated long `data:image/...` URIs in Console logs and State JSON views.
- **Web Desktop starter guide**: Seeded `Welcome.html` onto the web Desktop VFS with rendered HTML preview in `FilesApp`.
- **Trash & Drag-and-Drop**: Rendered dragged icons in a top-level portal, enabled dragging files to Dock Trash/places, and dynamically updated empty/full Trash icons.
- **FilesApp**: Added `FilesApp` (`localStorage` VFS) with a movable CSD header, zoom buttons, and portal context menus.
- **Notification toast exit**: Simplified notification toast dismissal to a clean fade-out.
- **UI & Shell polish**: Persisted Settings/DevTools active tabs, made Launcher vertically resizable, and styled notifications with Adwaita menu material.
- **Shell logging**: Added `[Piloti]` logs for window move/resize, workspace switches, notifications, and session/power actions.
- **Spotlight inline completion**: Added `InlineCompletionInput` with `Tab`/`ArrowRight` acceptance in `CommandInput` and `Launcher`.
- **DevTools State & Storage**: Renamed Inspector to State, added raw value formatting, and added inline `data:image` previews in Storage.
- **Boot & wallpaper transitions**: Eliminated solid-color flash behind image wallpapers and improved Dock icon loading.
- **Quit dialogs & Welcome guide**: Updated quit dialogs with a restore-windows checkbox and added `docs/Welcome.html`.
- **i18n & unified logging**: Consolidated logs into `.cache/piloti/piloti.log` and added `_(...)` localization (`en.json` / `fr.json`).

## 0.1.0

- Initial release.
