# Piloti, Domicile & System API Reference

Brief one-line-per-function reference for Piloti shell APIs, the Domicile SDK (`@domicile-desktop/sdk` & `@domicile-desktop/react`), and system integration.

---

## 1. Piloti API

### Shell Contexts (`src/context/`)

#### `WindowsContext` (`useWindowManager()`)
- `launchApp(appId, options?)` — Opens a built-in app, GNOME panel, or native Wayland process.
- `openWebUrl(url, options?)` — Opens an `http(s)` or `blob:` URL in a standalone `WebViewWindow`.
- `focusWindow(windowId)` — Brings a window to front, unminimizes if needed, and focuses it.
- `closeWindow(windowId)` — Closes a shell, browser, or Wayland window.
- `minimizeWindow(windowId)` / `toggleMinimizeWindow(windowId)` — Minimizes or restores a window.
- `toggleMaximizeWindow(windowId)` — Toggles maximize/restore while remembering pre-maximize bounds.
- `tileWindow(windowId, side)` — Tiles a window `"left"`, `"right"`, or `"full"` respecting Dock clearance.
- `moveWindowToWorkspace(windowId, workspace)` — Moves a window to a target workspace index.
- `togglePinWindow(windowId)` — Pins/unpins a window across all workspaces.
- `updateWindowGeometry(windowId, patch)` — Updates window position/size and persists bounds.
- `setBrowserTitle(browserWinId, title)` / `setBrowserFavicon(browserWinId, icon)` — Updates web view title or favicon.

#### `SettingsContext` (`useSettings()`)
- `updateSettings(patch)` — Merges partial `DesktopSettings` and persists/syncs to GNOME.
- `applySettingsState(patch)` — Applies settings state locally without triggering redundant sync loops.
- `resolveInitialSettings(savedJson, isBrowserBackend)` — Hydrates initial settings and browser web defaults.

#### `AppsContext` (`useApps()`)
- `getAppIconUrl(appIdOrName)` — Resolves a themed XDG or bundled Adwaita SVG data URL for an app/mimetype.
- `ensureWaylandIcons(ids)` — Lazily resolves icon theme URLs for a batch of icon names.
- `launchXdgEntry(entry, actionId?)` — Launches a `.desktop` application or desktop action.
- `openXdgFolder(folder)` — Opens an XDG user directory in Files / Nautilus.

#### `NotificationsContext` (`useNotifications()`)
- `pushNotification(input)` / `dismissNotification(id)` / `markAllNotificationsRead()` — Creates, dismisses, or marks notifications read.
- `clearNotifications()` — Clears notification history.

#### `SystemBackendsContext` (`useSystemBackends()`)
- `lockSession()` / `unlockSession(password)` — Locks or unlocks the desktop lock screen.
- `requestPowerAction(action)` / `executePowerAction(action, options?)` — Opens quit confirmation or executes logout/restart/poweroff.
- `takeScreenshot()` / `startScreenRecording()` / `stopCapturing(id)` — Captures screenshots or screencasts via portal/host.

### Hooks & Storage Cache
- `useSidebarKeyboardNav(options)` (`src/hooks/use-sidebar-keyboard-nav.ts`) — Enables `ArrowUp`/`ArrowDown` sidebar item cycling (activating on keyup) and `Tab`/`ArrowRight`/`ArrowLeft` focus handoff between sidebar and view content.
- `getCachedStorageItem(key)` / `setCachedStorageItem(key, value)` / `removeCachedStorageItem(key)` (`src/lib/storage-cache.ts`) — In-memory cached and debounced `localStorage` persistence with `beforeunload` flushing.

### Virtual Filesystem (`src/lib/web-vfs.ts`)
- `normalizeVfsPath(rawPath?)` — Normalizes a POSIX VFS path (collapses `.`, `..`, trailing slashes).
- `resolveVfsPath(cwd, rawTarget?)` — Resolves relative, `~`, or absolute paths against `cwd`.
- `listVfsDir(dirPath)` — Lists child `WebVfsEntry` items in a directory.
- `getVfsEntry(path)` — Looks up a single VFS file or directory by path.
- `createVfsFolder(parentPath, baseName?)` — Creates a uniquely named folder in `parentPath`.
- `createVfsTextFile(parentPath, baseName?, content?)` — Creates a uniquely named file in `parentPath`.
- `writeVfsTextFile(path, content)` — Creates or overwrites a VFS file's content.
- `renameVfsEntry(rawPath, rawNextName)` — Renames a file or directory (updating descendant paths recursively).
- `trashVfsEntry(rawPath)` — Moves a VFS entry to `/home/user/.local/share/Trash/files` (or deletes if already in Trash).
- `emptyVfsTrash()` — Permanently deletes all entries inside Trash.
- `moveVfsEntry(rawSourcePath, rawTargetDir)` — Moves a VFS entry into `rawTargetDir`.
- `subscribeWebVfs(listener)` — Subscribes to VFS changes (same-tab and `storage` events).
- `buildVfsEntryWebAppUrl(entry)` — Creates a `blob:` or `data:` URL to preview HTML, SVG, image, audio, video, PDF, or text files.
- `importExternalFilesToVfs(targetDir, files)` — Virtually copies dropped host `File`s into `targetDir`.

### Desktop Engine & Hardware Bridge (`src/lib/engine-desktop/`)
- `launchDesktopCommand(domicile, argv, env?)` — Spawns a command via Domicile, auto-detecting/launching `xwayland-satellite` and injecting `DISPLAY` when needed (or simulates in browser mode via `src/lib/engine-web/`).
- `ensureXwaylandSatellite(domicile)` / `detectXwaylandSatelliteBinary(domicile)` — Detects `xwayland-satellite` in `PATH` or `~/.local/bin` / `~/Projets/xwayland-satellite/target/{release,debug}` and ensures a live X11 `DISPLAY` socket.
- `launchWithGnomeEnv(domicile, argv)` — Spawns a command with `XDG_CURRENT_DESKTOP=GNOME`.
- `runText(domicile, argv)` / `commandExists(domicile, bin)` — Runs a command and captures stdout or checks binary availability.
- `readGnomeInterfaceSettings(domicile)` / `monitorGnomeInterfaceSettings(domicile, cb)` — Reads or watches `org.gnome.desktop.interface` keys.
- `syncGnomeInterfaceKey(domicile, key, value)` — Writes a `gsettings` key in `org.gnome.desktop.interface`.
- `syncGtkIconTheme(domicile, iconTheme)` — Syncs `gtk-icon-theme-name` to `~/.config/gtk-4.0/settings.ini` and `gtk-3.0`.
- `readGtk4HintFontMetrics(domicile)` / `setGtk4HintFontMetrics(domicile, enabled)` — Reads or updates `gtk-hint-font-metrics` in GTK4 `settings.ini`.
- `readGtk4CustomCss(domicile)` / `writeGtk4CustomCss(domicile, css)` — Reads or writes `~/.config/gtk-4.0/gtk.css`.
- `listInstalledFontFamilies(domicile)` — Lists installed font families via `fc-list`.
- `readSystemAudio(domicile)` / `setSystemAudio(domicile, patch)` — Reads/sets default sink volume and mute via `wpctl`/`pactl`.
- `listSystemAudioSinks(domicile)` / `setDefaultAudioSink(domicile, id)` — Lists and switches audio output sinks.
- `readSystemWifi(domicile)` / `setSystemWifiEnabled(domicile, on)` / `connectSystemWifi(domicile, ssid, pass?)` — Manages Wi-Fi via `nmcli`.
- `readSystemPowerProfile(domicile)` / `setSystemPowerProfile(domicile, profile)` — Reads/sets `powerprofilesctl` profile.
- `readSystemBattery(domicile)` / `setSystemBrightness(domicile, pct)` — Reads `upower` battery and sets brightness.
- `readMprisMediaInfo(domicile)` / `controlMprisMedia(domicile, cmd)` — Reads/controls MPRIS media playback.
- `discoverGnomeControlCenterPanels(domicile)` / `openGnomeControlCenter(domicile, panel?)` — Discovers and opens GNOME Settings panels.

### Web Apps & Metadata (`src/data/web-apps.ts`)
- `canonicalizeWebUrl(rawUrl?)` — Normalizes an `http(s)` URL to canonical `href`.
- `getWebAppFaviconUrl(rawUrl?)` — Resolves a 128px favicon URL for public web apps.
- `parseHtmlTitle(html)` / `parseHtmlThemeColor(html, prefersDark?)` — Extracts `<title>` and `<meta name="theme-color">` from HTML.
- `getContrastForeground(cssColor?)` — Computes `#ffffff` or `#1d1d20` foreground for a CSS background color.
- `getCachedWebThemeColor(rawUrl?, prefersDark?)` / `setCachedWebThemeColor(rawUrl, color, prefersDark?)` — Reads/writes `localStorage` `theme-color` cache.
- `fetchWebPageMetadata(rawUrl, signal?, prefersDark?)` / `fetchWebPageTitle(rawUrl, signal?)` — Fetches `<title>` and `theme-color` via `/__web_meta` dev proxy or CORS `fetch()`.
- `resolveWebAppTitle(options)` — Resolves the best display title for a web app window.

### Window Manager, Desktop Icons & Notifications
- `clampWindowBounds(pos, size, screenW, screenH, opts?)` — Clamps window coordinates and dimensions inside `[min, max]` and viewport.
- `clampWorkspace(index, count)` — Clamps a workspace index to `[1, count]`.
- `assignGridPositions(items, saved, metrics)` / `moveItemToCell(id, cell, items, saved, metrics)` — Computes collision-free 2D desktop icon grid coordinates.
- `inferFileVisual(name, fileType)` — Maps file extensions/directories to Adwaita icon candidates and gradients.
- `sortDesktopItems(items)` — Sorts directories before files alphabetically.
- `findNextKeyboardItemId(...)` / `findTypeAheadItemId(...)` / `findItemsInRect(...)` — Handles spatial keyboard navigation, type-ahead, and marquee selection.
- `shouldShowNotificationBanner(...)` / `resolveNotificationTimeoutMs(...)` — Evaluates notification banner visibility and auto-dismiss timeout.
- `loadLocalNotificationHistory()` / `saveLocalNotificationHistory(items)` — Persists notification history in `localStorage`.

### XDG, i18n, Logging & Console
- `xdgDataDirs(env?)` / `xdgConfigHome(env?)` — Resolves FreeDesktop XDG Base Directory paths.
- `discoverXdgUserDirs(files)` / `parseXdgUserDirs(raw)` — Discovers XDG user folders from `~/.config/user-dirs.dirs`.
- `inspectXdgTrash(files, path)` / `emptyXdgTrash(domicile)` / `parseTrashInfo(raw)` — Inspects and empties XDG Trash.
- `discoverRemoteGlobalMenu(domicile, busName, path)` — Discovers GTK/D-Bus `org.gtk.Menus` & `org.gtk.Actions` global menus.
- `_(key, ...args)` / `getLocale()` / `setLocale(locale)` — Translates UI strings (`en.json` / `fr.json`) with `%s`/`%d` formatting.
- `logBootEvent(msg)` / `startBootPhase(label)` / `bootElapsedMs()` — Logs boot phase timings.
- `evaluateReplCode(code, scope)` / `formatInspectValue(val)` / `abbreviateDataImageUri(val)` — Evaluates Console REPL expressions and formats inspection output.

---

## 2. Domicile API (`@domicile-desktop/sdk` & `@domicile-desktop/react`)

### `DomicileHost` (Low-Level Compositor Bridge)
- `spawn(command)` — Launches a native Wayland/Linux process.
- `searchFiles(query)` — Searches indexed user files relative to `$HOME`, returning matches and indexing status.
- `callSystem(id, request)` — Sends a raw system channel request by ID.
- `answerPortalRequest(id, answer)` — Responds to a pending XDG Desktop Portal dialog request.
- `copyClipboardEntry(entry)` — Copies a clipboard history entry to the active selection.
- `activateTrayItem(id, action)` — Invokes `primary`, `secondary`, or `context` action on a StatusNotifierItem tray icon.
- `dismissNotifications(ids)` — Dismisses notifications by ID.
- `invokeNotificationAction(id, action)` — Triggers a notification action button callback.
- `replyToNotification(id, text)` — Sends an inline reply to a notification.
- `focusApp(appId)` — Focuses a native Wayland application window.
- `focusChrome()` — Returns keyboard focus to the shell chrome.
- `closeApp(appId)` — Requests a native Wayland application to close.
- `setAppBounds(appId, x, y, width, height)` — Positions and sizes a native Wayland surface in CSS pixels.
- `syncFrames()` — Synchronizes compositor frame callbacks.
- `warpPointer(x, y, unlessOver?)` — Moves the pointer to `(x, y)` unless over `unlessOver`.
- `pointerConstrained(appId, active)` — Notifies the host of pointer lock/constraint state.
- `setTheme(theme)` — Sets compositor theme (`"dark"` | `"light"`).
- `themeCaptured(theme)` — Acknowledges captured theme update.
- `lock()` — Locks the desktop session.
- `unlock(passphrase)` — Attempts to unlock the session with `passphrase`.
- `grabShortcut(chord, whileInhibited?)` — Registers a global keyboard shortcut grab.
- `ungrabShortcut(chord)` — Releases a registered global keyboard shortcut.
- `grabGesture(gesture)` — Registers a global touchpad/touch gesture grab.
- `ungrabGesture(gesture)` — Releases a registered gesture grab.
- `activateExtension(id)` — Triggers a browser extension action.
- `openBrowserWindow(url, partition?)` — Opens a browser window for `url`.
- `openPrivateBrowserWindow(url)` — Opens an incognito/private browser window for `url`.
- `openAppWindow(url, appId?, reuse?)` — Opens a standalone web app window.
- `countBrowserWindowMatches(id, selector)` — Counts DOM selector matches inside a browser window.
- `closeBrowserWindow(id)` — Closes a browser window by ID.
- `startCasting(id)` — Starts screencasting a target and returns the route ID.
- `stopCasting(route)` — Stops an active screencast route.
- `cancelDownload(id)` — Cancels an active download.
- `removeDownload(id)` — Removes a download entry.
- `clearDownloads()` — Clears completed/failed downloads.
- `fetchWithCookies(url, method, headers, body, sapisidHashOrigin)` — Performs a cookie-backed HTTP request through the browser host.

### `@domicile-desktop/react` Hooks
- `useDomicile()` — Returns the `Domicile` instance (`windows`, `browser`, `files`, `processes`, `system`, `displays`, `notifications`, `portals`, `session`, `shell`).
- `useWindows()` — Subscribes to live Wayland window list and state updates.
- `useFocusedWindow()` — Returns the currently focused Wayland window.
- `useWatch(fn)` — Reactively subscribes to Domicile observable values.
- `usePortalWallpaper()` — Reads/watches the portal wallpaper URI.
- `mount(Component)` — Mounts the root React shell component into Domicile.

---

## 3. System (Data Storage, GNOME GSettings & Stack)

### On-Disk Files (`$HOME` / Linux)
- `.cache/piloti/piloti.log` — Unified shell & boot log file written by `console-store.ts`.
- `.cache/piloti/wallpapers/<hash>_2560.jpg` — Downscaled/transcoded JPEG wallpaper cache.
- `.config/user-dirs.dirs` — FreeDesktop XDG user directory mappings (`Desktop`, `Documents`, `Downloads`, etc.).
- `.config/gtk-4.0/settings.ini` & `.config/gtk-3.0/settings.ini` — Synced `gtk-icon-theme-name` and `gtk-hint-font-metrics`.
- `.config/gtk-4.0/gtk.css` — User custom GTK4 CSS scratchpad.
- `.local/share/piloti-gcc/applications/` — Hidden GNOME Control Center `.desktop` panel overrides.
- `.local/share/Trash/files/` & `.local/share/Trash/info/` — FreeDesktop XDG Trash storage and `.trashinfo` metadata.

### `localStorage` Keys (Browser & Shell Persistence)
- `piloti.desktop.settings.v1` — Core `DesktopSettings` (theme, accent, dock, wallpaper, installed web apps, `webDefaultsVersion`).
- `piloti.window-bounds.v1` — Remembered per-app window positions and sizes (`savedWindowBounds`).
- `piloti.desktop-icon-positions.v1` — Spatial 2D grid coordinates for Desktop icons.
- `piloti.xdg-session-management-v1` — Session restore snapshot (open Wayland, browser, and shell windows).
- `piloti.web.vfs.v1` — Browser-mode virtual filesystem entries (`WebVfsEntry[]`).
- `piloti.dock-icons.v5` — Cached resolved Dock/app icon data URLs per icon theme.
- `piloti.xdg-icon-index.v1` — Cached XDG icon theme directory index.
- `piloti.web-theme-colors.v1` — Cached `<meta name="theme-color">` values per URL and color scheme.
- `piloti.console.log.v1` — Browser-mode fallback log buffer for `piloti.log`.
- `piloti.notifications.history.v1` & `piloti.notifications.read.v1` — Notification center history and read IDs.
- `piloti.locale.v1` — Selected UI locale (`"en"` | `"fr"`).
- `piloti.launcher.height.v1` & recent-launch keys — Persisted Launcher height and recent launches.
- `residence:app-store-state:v1` — Browser-mode simulated install/uninstall state for catalog apps.

### GNOME GSettings & GTK Configuration
- `org.gnome.desktop.interface color-scheme` — Syncs dark/light/default color scheme.
- `org.gnome.desktop.interface accent-color` — Syncs GNOME accent color.
- `org.gnome.desktop.interface icon-theme` — Syncs active icon theme name (also mirrored to GTK3/GTK4 `settings.ini`).
- `org.gnome.desktop.interface clock-format` — Syncs 12h / 24h menubar clock format.
- `org.gnome.desktop.interface clock-show-seconds` — Syncs seconds display in the menubar clock.
- `org.gnome.desktop.interface font-name` — Syncs UI sans-serif font family and size.
- `org.gnome.desktop.interface document-font-name` — Syncs document font family and size.
- `org.gnome.desktop.interface monospace-font-name` — Syncs monospace font family and size.
- `org.gnome.desktop.interface text-scaling-factor` — Syncs global text scaling factor.
- `org.gnome.desktop.interface font-antialiasing` — Syncs font antialiasing mode (`none`, `grayscale`, `rgba`).
- `org.gnome.desktop.interface font-hinting` — Syncs font hinting level (`none`, `slight`, `medium`, `full`).
- `org.gnome.desktop.interface font-rgba-order` — Syncs subpixel RGBA order (`rgb`, `bgr`, `vrgb`, `vbgr`).
- `org.gnome.desktop.background picture-uri` — Syncs light-mode wallpaper URI.
- `org.gnome.desktop.background picture-uri-dark` — Syncs dark-mode wallpaper URI.
- `org.gnome.desktop.background picture-options` — Syncs wallpaper scaling/fit mode (`zoom`, `centered`, `scaled`, `spanned`, `stretched`, `wallpaper`, `none`).
- `org.gnome.desktop.background color-shading-type` — Syncs background shading (`solid`, `horizontal`, `vertical`).
- `org.gnome.desktop.background primary-color` — Syncs primary background hex/RGB color.
- `org.gnome.desktop.background secondary-color` — Syncs secondary gradient background color.
- `org.gnome.desktop.background picture-opacity` — Syncs wallpaper image opacity.
- `org.gnome.desktop.notifications show-banners` — Syncs Do Not Disturb (`false` = DND active).
- `org.gnome.desktop.notifications show-in-lock-screen` — Syncs notification visibility on the lock screen.

### System Stack & CLI Tools
- **Compositor & Runtime**: `@domicile-desktop/sdk` & `@domicile-desktop/react` (Wayland `<app>` surfaces, `<webview>`, portals, display/session management) + React 19, TypeScript, Tailwind CSS v4, Base UI, Lucide icons, Vite, and Bun.
- **Desktop & Settings**: `gsettings`, `gnome-control-center` (wrapped with `XDG_CURRENT_DESKTOP=GNOME`), `fc-list` (font enumeration), `gio` (trash), `gdbus` / D-Bus (`org.gtk.Menus` / `org.gtk.Actions` global menus).
- **Hardware & Media**: `wpctl` / `pactl` (PipeWire/PulseAudio volume & sinks), `nmcli` (NetworkManager Wi-Fi), `powerprofilesctl` (power profiles), `upower` (battery), `brightnessctl` / sysfs backlight, `playerctl` (MPRIS media controls).
- **Image Transcoding**: `magick` / `convert` (ImageMagick), `ffmpeg`, `djxl` (JPEG XL), and `python3` (`GdkPixbuf`) for wallpaper conversion.
