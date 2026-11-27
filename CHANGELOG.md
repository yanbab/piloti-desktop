# Changelog

Releases of Piloti Desktop, latest first. Dates are the tagged commit's.

## 0.10.13 — unreleased

- Piloti demo: Elements, Colors and Icons panes, with code beside each sample.
- Folders: new toolbar; a folder opened on its own keeps its view, sort and
  zoom; the info pane is remembered.
- Menu bar: keyboard menu; Control Center and Launcher aligned like the Piloti
  menu; orange battery in power saver mode.
- Notifications: same width and place as in the Control Panel, new silent and
  urgent looks, tooltips above panels.
- Piloti theme: softer accent, better menu and sidebar spacing.
- Text Editor is now Texts and Camera is Selfies. Settings, pins and default
  apps saved under the old names are still read.
- Apps without their own symbolic icon use the theme's generic one in the
  window menu button.
- Internal: smaller engine boundary, ports for hardware and media.

### Commits

- `e423805` revert: drop the Lucide-converted app symbolic icons
- `212c8ff` refactor: move the demo's file code out of fs-bridge
- `bc233b2` refactor: route Terminal, Flatpak and app lists through engine
- `cb50233` refactor: rename Text Editor to Texts and Camera to Selfies
- `99f4d13` fix(piloti): softer accent; menu and sidebar spacing and alignment
- `e40b0f5` refactor: move pure code out of engine-native
- `9372ab1` refactor: reach hardware and media through hardware()
- `214fd44` feat: demo, Folders, Control Panel and notification rework
- `f650fd8` refactor: take most views off web-vfs
- `ff61a64` refactor: group apps and shell by feature at the top of src
- `89bf152` fix(linux) : security policy script-src 'self' crashes plugins
- `0b9a4f7` fix: badges follow renames and moves on Linux

## 0.10.12 — 2026-11-27

- Text Editor never saves over another file: a new document takes an
  unused name, and a file changed on disk asks to Overwrite, Reload or
  Cancel. Closing an unsaved new document asks.
- The editor and Image Viewer follow renames and moves, of a parent folder
  too. Opening an open file focuses its window. This also works with the
  editor as a separate process.
- Folders' list view is a tree with a Modified column and drag and drop.
  Apps dropped on the Dock are pinned.
- Settings gains System and Extensions panes. Switching workspaces slides
  the windows in. Adwaita Sans is the UI font.
- Admin apps such as Synaptic open: Piloti starts a polkit agent and lets
  root use its Xwayland display.
- Agents asking to drive the desktop get a permission dialog, for the whole
  desktop or checked windows; the menu bar shows the agent and a stop
  button.
- Files and desktop launchers opened with installed apps give startup
  feedback and honour Terminal=true.
- Fixes for the Dock Trash, Text Editor's Dock icon, window buttons and
  focus rings.
- Faster start: desktop icons show before thumbnails, and icon caches are
  only rewritten when icons change.

### Commits

- `6a7765b` Release v0.10.12
- `9ea64c1` fix: Text Editor as a separate process keeps and follows its file
- `ad377ee` feat: permission dialog for agents driving the desktop
- `cc54376` fix: ask before saving over a file changed on disk
- `ae66a68` fix: open documents follow moves; never save over another file
- `c412ea2` doc: update
- `6be5939` revert: drop session icons from the Login Screen
- `e360e07` perf: rebuild the icon index only when icon folders change
- `4d191e5` perf: don't rewrite unchanged icon caches at each start
- `345e3a6` perf: desktop icons show before thumbnails and emblems
- `ed8d010` feat: session icons on the Login Screen, Piloti symbol in the theme selectors
- `63ddf65` fix: launch feedback for Open With, admin prompts and root apps
- `9a9a192` fix: Dock Trash path, app module windows, 16px tree triangles
- `874b716` feat: System and Extensions panes, workspace transition, soft accent, fonts and icons
- `16ab05f` feat: Folders list view is a tree; dropped apps pin to the Dock

## 0.10.11 — 2026-11-27

- Folders on Linux: image thumbnails, file sizes, a working location bar
  and info pane, the localized Templates folder, Recents with sizes that
  refreshes live, and saving through a dangling link keeps the link.
- Outside drops are written to disk, on the desktop too, and can be undone.
- Focus stays in the window after using a context menu.
- Desktop settings live in dconf (GSettings), linked to GNOME's keys.
- Piloti Shell: file commands, programs, completion and scripts; on Linux,
  JavaScript is limited to expressions (the shell forbids eval).
- Themed symbolic icons everywhere, one folder renderer, drive icons;
  Wi-Fi and speaker icons follow signal and level.
- Cupertino theme refinements; type follows the font settings.
- libarchive-tools is now a dependency; Domicile SDK 3.
- Compress and Extract are hidden without bsdtar; an archive holding one
  file or folder extracts to it, with no extra folder.
- Names that are taken are numbered "name (1)", "name (2)".
- Internal: one boundary for system commands, backends split by concern,
  ESLint.

### Commits

- `63a3dad` fix: archives without bsdtar, lone entries, numbered names
- `2424e66` Release v0.10.11
- `56c8fdb` doc: agent instructions in AGENTS.md only; architecture details in ARCHITECTURE.md
- `85a7ab9` refactor: split SystemBackendsContext
- `eab9a2e` chore: ESLint with the React hooks rules (npm run lint)
- `4316f0f` fix: drops, renames, Calculator keys and loading folders
- `3550649` feat: theme and icons pass: symbolic icons everywhere, one folder renderer, colour tokens, no app gradient, drive icons, translatable plugin entries
- `f42eba5` feat: Wi-Fi icon follows signal strength, speaker icon follows sound level
- `becefdd` fix: demo symbolic icons are Adwaita's and Papirus's own files; window menu falls back to application-x-executable
- `0837c7f` feat: \<SymbolicIcon\> draws the icon theme's symbolic icons; menubar, control panel, window bars and Settings sidebar use it
- `a63b717` fix: bugs found on the VM
- `5a798e2` fix: window menu icon in collapsed and unfocused windows; Apps permissions without descriptions
- `960605e` fix: Folders on Linux; refactor: system commands behind engine/
- `16161c3` feat: type roles follow font settings; button, switch and settings polish
- `f2fc403` doc: api update
- `249fba5` feat: loop checks in Piloti Shell; demo /proc for top and System Monitor
- `bc880c3` feat: Piloti Shell scripts as one program; six-column tables, ls -l table, shorter prompt
- `c617605` fix: stat of shipped files and folders never answered in the demo
- `8951335` feat: Piloti Shell commands, programs and completion; piloti theme
- `f1f9ae9` feat: link desktop settings to GNOME keys (gsettings-links.ini)
- `8d4e45d` feat: desktop settings in dconf (GSettings) on Linux; SDK 3
- `95858a1` feat: Cupertino checkbox, popup button and tooltip
- `e9b7717` refactor: fewer type, radius and surface tokens
- `21bd01e` refactor: three button sizes, named as CupertinoUI does
- `0df3a07` fix: demo icons; three control heights, 16px icon steps, dock 24-96px
- `f4e6916` feat: Cupertino traffic lights and capsule search field
- `45abaeb` feat: Elements demo with React/HTML tabs; Cupertino tabs and sidebar blur

## 0.10.10 — 2026-11-26

- Files: one API (piloti.vfs) on both engines, the disk as the only copy;
  views share one cache and one watch per folder, and the shell's own
  file operations show at once. Changes made by other programs appear
  live in Folders and on the desktop.
- Settings: schema + key, one file per owner (settings.ini for the
  desktop, apps/<app>.ini for an app); settings.ini edits apply live;
  window.piloti.settings get/set/reset/watch.
- Fewer re-renders: components subscribe to the settings they read.
- Cupertino interface theme; buttons, switches, menus, sidebar and window
  frame styled with plain CSS and ui tokens.
- Folders and desktop share one icon view (View > As Desktop); Open With
  submenu; Select All, Move to Trash and Eject in the File menu.
- Keyboard settings pane, System Monitor, Text Editor in its own process
  (optional), Compress and Extract Here.
- piloti CLI commands work with Domicile 1.3.
- Fixes: undo after opening a file or a numbered move; Trash restore in
  the demo could move the home folder; missing application folders no
  longer use inotify instances.

### Commits

- `43177b4` Release v0.10.10
- `e582f41` fix: piloti CLI commands on Domicile 1.3; reorganise the docs
- `2048b97` refactor: menus and segmented control in plain CSS; HTML samples in the demo
- `1527b57` refactor: components ask for the settings they read
- `2aaeb2f` refactor: sidebar and grouped form in plain CSS; fix Cupertino menus
- `23f5b91` feat: views read files through shared VFS queries
- `e2979d4` feat: Cupertino interface theme
- `37c5c6c` refactor: window frame styled by plain CSS
- `2298d8c` refactor: use the ui prefix for theme tokens, classes and utilities
- `06c7376` refactor: switch, checkbox and input styled by plain CSS
- `a7ba21e` refactor: button styled by plain CSS, and a theme token test
- `6f694ba` refactor: rename adw tokens and classes to shell
- `ac6829a` feat: typed settings layer and a shared query cache
- `a5d0059` feat: show the app's symbolic icon on the window menu button
- `31c1470` fix: undo after opening a file or after a numbered move
- `b37b3ec` refactor: stop importing web-vfs where core modules do, and hold the line
- `834da88` feat: file operations go through piloti.vfs, no write-through mirror
- `893c743` feat: Text Editor and viewers use piloti.vfs
- `cb67de8` feat: add piloti.vfs and move config files to a watched state store
- `261570b` fix: apply settings.ini edits live on Linux
- `47ebdc3` feat: Keyboard settings pane, monitor settings file, About Computer and dock badge fixes
- `9a43e74` feat: Open With submenu, window menu opposite the controls, fitted System Monitor with quit
- `46e62a3` fix: keep focus on the icon after rename; sidebar row selected only for the folder itself
- `06b66e3` fix: control panel shadow clipping; notification More/Clear on top; no counts in file context menu
- `ab92cd8` doc: updates
- `735410f` standalone calculator crash
- `6d40557` app: piloti hello world
- `78db2dd` fix: sidebar blur and About header; add Select All, and Move to Trash / Eject in Folders' File menu
- `d327d22` feat: one folder icon view for the desktop and Folders, with View \> As Desktop
- `21ee7cd` feat: texteditor can be run inShell or out of process.
- `4cad6a7` feat: wire SystemMonitor
- `c9b8d6a` ci: scripts/vm-update.sh
- `f7931bf` Fix the website deploy: keep empty demo folders in git, restore /etc/issue, deploy from main only
- `b400ca8` Add the piloti global extending Domicile; rename domicile to piloti
- `f7ac57e` Absent Wi-Fi/Bluetooth hardware shows as absent
- `9b7fea0` Release number in builds; fix three Linux bugs; Flathub list as a file
- `2c0a888` Built-in apps described in their .desktop files (X-Piloti-\* keys), read at start; apps listed once
- `9be0e26` Reach files outside the engines only through engine/host-files, checked by a test
- `ed22ad2` Web demo and landing page read data/files over HTTP from \_\_fs/ (copied on build:web); drop the JSON pack
- `7e3f506` Web demo reads data/files from one generated pack; drop the generated TS and fetch fallbacks
- `2432293` scripts/vm-build.sh: build the .deb inside the Linux VM from its own copy
- `9f0329d` Shell log in ~/.local/state/piloti, emptied at start; window menu dot; drop a duplicated startup command and log read-back
- `62fe30e` Debug mode (show the desktop as it loads) and startup profiling: app launch logs and a report of steps, host calls and stalls
- `0c820a8` Drag windows while a menu is open; sidebar and window chrome polish
- `6ffc2fc` Linux shell and greeter start dark from their first line
- `05b0d77` Compress and Extract Here on the Linux desktop (bsdtar), undoable in both engines
- `149dfe4` Mobile demo: meta tags, no double-tap zoom, shell fits the visible viewport; no sidebar collapse animation
- `d5b2ce3` Menubar Launcher button uses the layout-grid icon
- `0ffe7ab` Web search: address bar searches when the text is not an address, Launcher search and new tabs use DuckDuckGo Lite (web demo: Wikipedia)
- `9aed679` Shared header search and info pane, Permissions pane, per-app About windows, Restart Piloti Desktop
- `e7710f8` Favicon: Piloti symbol fills 14x14 of 16px with a 1px margin
- `94b4d4c` Displays header like Wallpaper (laptop + demo external monitor, name and resolution); favicon tile is a muted accent at 25% opacity
- `32e5f64` Sortable list view for Folders and System Monitor, icon size scale, About window header, website update
- `93b92ab` System Monitor app (first version), Piloti Devtools, new Piloti Demo icon
- `47284de` Docs: project management (TODO with checkboxes, roadmap, issues) lives in local \_docs/; reference docs reorganized in docs/ (ARCHITECTURE rewritten, API removed, native, GNOME reuse, app modules, web apps moved in)

## 0.10.9 — 2026-11-24

- Terminal (xterm.js): bash on a real PTY or the piloti-shell, chosen in
  the header bar; piloti-terminal is its desktop file and command.
- Web Browser: tabs as grouped windows; reorder by dragging (horizontal,
  same feel as the Dock), pull a tab out to detach it, pin tabs, reopen the
  last closed tab (Ctrl+Shift+T).
- Wi-Fi asks for the password of secured networks without a saved profile.
- Power profile and media players (MPRIS) follow D-Bus signals.
- Faster Launcher and window switching: the VFS cache is never serialized
  on native, the Launcher opens at once, windows no longer force a layout
  on every render.
- Menus close when a check or radio item is picked; fr/us keyboard
  switcher; Desktop Console without the JS REPL.
- Under the hood: engine split (web and native), capabilities,
  FileService/FileStore for every file operation.

### Commits

- `9aeb7f6` Release v0.10.9
- `1924bb8` Browser tabs: pin tab, reopen closed tab (Ctrl+Shift+T), tab context menu; other pending shell changes
- `1d6b007` Web demo favicon follows the desktop: window color background, accent house, updated live
- `16157e3` TODO: small improvement ideas, checked against the code
- `d8860db` Power profiles and MPRIS over D-Bus: live signals instead of powerprofilesctl/playerctl polling
- `f6567ca` Text Editor module host: unit tests for save, preload, Desktop folder, prefs
- `35751ec` TODO: drop the Launcher list check
- `9103910` TODO: refresh refactoring status
- `5b9b33e` fs-bridge no longer shells out: metadata read/write goes through FileService and the native FileStore
- `28663bb` App Store slider: list radius, two-line description room, bolder app name
- `ad5ad53` One menu system, Launcher A-Z, Browser in the dock, App Store slider, Piloti control panel and dock geometry
- `1288b18` TODO: capabilities status
- `cf0cf76` Mark remaining isBrowserRuntime uses with FIXME : Capabilities
- `99b2cf2` Capabilities: Folders and the spatial desktop ask for realFilesystem
- `e02cd94` TODO: capability migration progress
- `030a778` Capabilities: Desktop, Settings panes, keyboard switcher, Alt+Tab, Console and file context menu
- `503cd6d` Capabilities: Camera, Login screen, portal dialogs and Security settings
- `179bddd` Agent guide: browser tab strip, reorder and detach
- `fd64323` Capabilities: useCapabilities hook; Launcher, Displays settings and icon grid use it instead of isBrowserRuntime
- `fa5d17b` Dark Mode per App plugin, new dock and wallpaper defaults, Piloti menu and list styling
- `25c210e` Browser tabs: reorder with the Dock's sortable behaviour (horizontal only) and detach by pulling a tab out of the bar
- `7dd0b89` Perf: Window no longer forces a layout after every render; it measures its frame only when zoom flips
- `f6978b2` About window uses the vibrant material; Overview close buttons follow the button layout; PiP windows get the hover close button; New Tab split button (placeholder app list)
- `4bcacac` Wi-Fi: ask for the password of secured networks without a saved profile
- `2a59eb0` Terminal: remove the old terminal; rename to Terminal with piloti-terminal desktop file, command and bin
- `82a3219` Agent guide: one worktree per session; browser tabs in the code map; TODO focus on stabilization
- `29125fa` Web Browser: tabs as grouped web view windows, bookmarks, piloti-browser launcher and .desktop entry
- `7ffa41e` Engine capabilities instead of isBrowserRuntime in open-path, Text Editor host and system backends
- `c661408` Track remaining work in 'TODO - Code.md'
- `dd8722b` TODO.md: remaining refactoring and pending features
- `53d2a91` Launcher opens its panel at once and fills the list on the next frame (shows Loading… meanwhile)
- `523c721` Launcher no longer refreshes apps or icons when opened; the .desktop directory watchers keep them current
- `68e0108` Perf: native never serializes the VFS entry cache; opening the Launcher no longer rebuilds the icon index
- `826b754` Web Browser uses our web view windows; PiP restore follows the click setting; floating windows snap within 28 px; Piloti buttons without hover or colour transitions; heart emblem no longer covers others; Calculator resizes back to basic; docs/AGENT-GUIDE.md
- `729b8be` Menus: checkbox and radio items close the popup on click; terminal header clicks do not steal focus
- `e45f204` Desktop Console: drop the JS REPL tab (piloti-shell replaces it; run() and apps() moved there); terminal keeps keyboard focus while its window is focused
- `fd843f0` Terminal menu sorted a-z, piloti-shell included
- `1469d4a` Terminal menu: names without paths; the web demo lists bash disabled
- `1aa8696` Terminal: the shell menu is the title in a single header bar (GNOME-style); no second bar
- `73ec463` Terminal shell list: one entry per real program, sorted a-z, bash shown disabled when missing
- `2ff2a84` Aligned titles in both themes; Finder-like icon grid
- `b9f0f7b` Default Piloti session config: fr and us keymaps (the menubar switcher lists them)
- `99ad6e5` fs-bridge and the XDG file helpers ask the engine (realFilesystem capability) instead of taking an isBrowserRuntime flag
- `eda17dd` Terminal: shell picker menu in the header bar (piloti-shell + /etc/shells); no stale exit message when switching
- `f5a889a` Theme tokens for type, radius and heights; Piloti-free hover fills; Piloti demo app
- `ebef02d` Terminal on xterm.js with a bash / piloti-shell switch: bash on a real PTY (Linux), piloti-shell a JS REPL over the desktop
- `2690ed1` CLAUDE.md: engine, ports and VM dev loop
- `8442390` Engine split: each entry point picks its engine (Engine + capabilities); native bundle drops the web engine and the demo tree; demo seed is injected by piloti-web

## 0.10.8 — 2026-11-24

- Battery, brightness, Wi-Fi, volume and Bluetooth use Domicile's
  system-battery, system-backlight, system-network, system-audio and
  system-bluetooth libraries (UPower, logind, NetworkManager/iwd, BlueZ,
  PulseAudio/PipeWire) and follow changes made elsewhere, e.g. GNOME
  Settings. Bluetooth lists paired devices in the Control Center.
- Folders: sidebar bookmarks shared with Nautilus; favorites and emblems
  stored as gio metadata::emblems; Open With also for folders; XDG
  folder names (Bureau, Images...) used everywhere.
- Desktop Shell runs a real shell over the real disk on Linux.
- Native: state files read back from $HOME at boot; no browser storage.
- Rename, move, copy and trash reach the disk even for files the cache
  has not listed.

### Commits

- `c129b03` Release 0.10.8
- `367eb8f` Bluetooth through Domicile's system-bluetooth: live power state and paired devices in the Control Center, connect/disconnect
- `61d0a7d` Audio through Domicile's system-audio (live volume, mute and output devices); wpctl/pactl parsing removed
- `e00f6c1` Folder animations shared by desktop and Folders; Sort Manually
- `5ae33ce` Console Events: VFS Diff button stays on one line and ellipsizes
- `8ef0db5` Wi-Fi through Domicile's system-network (NetworkManager or iwd over D-Bus) with live updates; nmcli parsing removed
- `be9ffda` Favorite hearts: direct toggle on icons and list rows
- `a7e4002` Battery and brightness use Domicile's system-battery (UPower) and system-backlight (logind) and follow system changes
- `d9781cd` Emblems and favorites stored as gio metadata::emblems on native (shared with other file managers); listings and the Favorites view read them back
- `efc53b8` Folders: Nautilus-style view split button sharing the menu bar View menu
- `10054c7` Files: compact bottom bar with item count and zoom slider; neutral small slider
- `7a40803` Native: favorites and emblems persist on disk again; Favorites view stats the real files; Home no longer selects with Downloads
- `7aa811d` Folders: sidebar bookmarks shared with Nautilus (~/.config/gtk-3.0/bookmarks), Add/Remove from Bookmarks on folders
- `315a691` Open With also for folders: drop the directory gate
- `c839a4e` Open With also for folders (offers Nautilus)
- `fc37869` Launcher: Ctrl+A selects all, Alt+Space toggles from the field, dock tile toggles
- `5e380ef` FileService: rename, move, copy, trash, restore, remove and empty trash go through the FileStore (native renames no longer depend on the cache)
- `4d759b2` Terminal completion and Camera capture naming list the real directory first on Linux
- `6e1d777` Desktop Shell: real shell over the real disk on Linux (builtins stay for desktop commands)
- `e6c51c4` Shared drag feedback and pointer-drag helper

## 0.10.7 — 2026-11-24

- Native: Files sidebar and Camera use the real XDG folders (Bureau,
  Images...) instead of hardcoded English names.
- Native VFS is a memory cache of the disk: no localStorage/IndexedDB, no
  demo tree; Piloti state files are read back from $HOME at boot.
- The Piloti session uses ~/.config/piloti/domicile.json, so the plain
  Domicile session starts Domicile's default shell.
- Text Editor as a Domicile app module (CSD); real $HOME as VFS root.
- FileStore port and core FileService; engine/ports refactor under way.

### Commits

- `4562a12` Release 0.10.7
- `9fbaf2b` Fix drop jumps, single desktop menu, one popup surface at a time
- `7487965` Native: real XDG folders in Files and Camera, memory-only VFS cache hydrated from disk
- `1242e2e` Picture in Picture plugin and floating windows
- `17daa7f` FileStore port + core FileService (list/read/write/create) with native adapter; fs-bridge delegates to it
- `3cb05ab` Icon theme: accent markers declared by the theme, cleaner lookup
- `09eec56` App module spike: read the Settings portal over D-Bus
- `0cf4c47` VFS: clipboard and media/type helpers move to core (engine-neutral)
- `ccfa404` VFS: path model in core/vfs-paths, demo seed and defaults top-up in engine-web/vfs-seed
- `28a2773` VFS sync port: change propagation, cross-window broadcast and flush hooks behind VfsSync
- `9f3306a` VFS persistence port: localStorage/IndexedDB behind VfsPersistence, injectable (memory adapter + test)
- `c89610a` VFS root is the real $HOME on native (VFS\_HOME), resolved before the desktop loads
- `d947ac3` App module: real Desktop dir for new files, controls on both sides, header insets
- `4314621` Text Editor app module: Domicile host, entry, CSD frame with shell drag strip and controls
- `7584f4b` Text Editor: talk to its host through a TextEditorHost port (in-shell host, no behaviour change)
- `db59738` App module windows: live page title, ready state; drop unsupported --id
- `63717d3` Frame Domicile app module windows with the standard titlebar (no address bar)
- `3a189b0` App module spike: fix probes, record VM results in doc

## 0.10.6 — 2026-11-23

- Camera app (piloti-camera): Photo / Cam / Mic with a red record button,
  saves to Desktop with metadata in the file name; screen captures use the
  same naming. Menubar dot: red when a camera is live, orange for mic only.
  Sound recorder removed from the menubar and control panel.
- Dock and desktop reordering rebuilt on dnd-kit: icons slide aside to make
  room for the dragged item (spring animation).
- Image Viewer uses the standard title bar, Save icon in the header bar.
- Files: Sort & Filter menu and grid/list toggle back in the toolbar;
  Launcher web search restored; no hover highlight on sidebar resize handle.
- Touch Mode and its settings removed.
- Piloti theme: translucent menus, popovers, panel and dock.
- New: test Domicile app module (App Module Test) and build:apps, to
  evaluate running heavy apps in their own document.
- Fix test-order leak in the web VFS unit tests.

### Commits

- `259e44a` Release v0.10.6
- `4ee5c46` Add test Domicile app module (hello) with build:apps and .deb staging
- `ad9962b` Help menu: no focus ring on the search field, placeholder "Search commands"
- `7d60e53` Piloti: restore translucent menus, popovers, panel and dock
- `4d7f7c7` Ignore root dot files
- `167b3d2` Switch dock and desktop reordering to dnd-kit; Camera header and capture tracking; Image Viewer standard titlebar
- `ab53644` Scope macOS look to the Piloti theme; restore Adwaita; Cupertino UI tokens
- `61f8b58` Icons: full-size terminal, new Desktop Console icon, Text Editor matches text file, light accent shade
- `6fd32a7` Expect Piloti App Store icon override in XDG icon lookup test
- `3ce1593` Accent-tint Text Editor badge, App Store arrow; tint icons with the UI accent shade
- `2afc5e6` Reset web-vfs cache between tests to fix order-dependent CI failure
- `40adc80` Match macOS Ventura spacing: 20px inset, 8px groups, inset separators, 28px sidebar items
- `2a56df6` Compact controls: 36x20 switch, 28px segmented switchers, 36px rows
- `bc604f1` Compact Settings layout: Ventura-style density and title alignment
- `5ed0dab` Align Settings content and section titles with the headerbar title
- `d3b84d9` Rebuild Select as a popup menu button and simulate portal dialogs in web demo
- `dc6b267` Fix clipped control panel shadows and use popup selects in portal dialogs
- `5fb4d41` Show Bluetooth and Power Saver indicators in menu bar
- `4236ed0` feat: add Camera app and file operation undo history
- `f477c2b` feat: add camera application and file operation undo support
- `e21df17` Mark landing page as Alpha
- `ce84342` Replace landing page with new Adwaita-style design

## 0.10.5 — 2026-11-23

- Render performance: window-manager selector store and stable actions,
  chrome settings without drag-churned fields, memoized shell chrome,
  CodeMirror compartments in the Text Editor (undo survives theme and
  preference changes), debounced settings.ini, inotify watches for Trash
  and Desktop, typed shell events.
- Link files (.desktop Type=Link, .url, .webloc) and "Make Link".
- One shared opener for Folders, Desktop and dock stacks: mimeapps.list,
  installed apps, launcher files, packages; .deb and .flatpakref open in
  the App Store with an install confirmation.
- Wider XDG mime inference and Open With from installed apps; fix App
  Store launcher mapping (piloti-appstore).
- Dock folder stacks always show icons.
- App Store: simpler toolbar, sort in the View menu, Sources menu fixed,
  "System (Debian)".
- Folders: sort order and view mode in the View menu.
- Accent-colored selected sidebar items; duplicate Edit menu removed.

### Commits

- `aa7878f` Release v0.10.5: render performance, link files, shared file opener, App Store polish

## 0.10.4 — 2026-11-22

* Release v0.10.4 (includes unreleased 0.10.3):
  - VFS performance: in-memory writes with coalesced localStorage flushes
    (250 ms debounce, flushed on pagehide/beforeunload), path-aware change
    events, and path-filtered subscribers (Folders, Desktop, Dock, Text
    Editor, Settings web-app sync); reads no longer re-fetch the whole VFS.
  - Console > Infos > Performance: VFS writes/flushes, flush time, JSON
    size and listener wake-up counters.
  - Nice file paths ("Desktop > Screenshot.png", "USB > Doc.pdf") with
    SSD/HDD, USB, CD-ROM and SD Card device icons in notifications and the
    Folders info pane.
  - Help > Search menus (Cmd/Ctrl+K): search and run any menu command with
    its shortcut; the Launcher stays on Alt+Space.
  - Spatial Image Viewer: zoom, pan, rotation and unsaved crop restored per
    file; no Save/Discard prompt on close for spatial apps (opt-in via
    ~/.config/piloti/general.ini); Text Editor code folding.

### Commits

- `0061fb2` Release v0.10.4: VFS performance, path-filtered change events, perf counters
- `8a5f9f8` feat: add device icons and shell enhancements including menu commands and path labeling
- `079fe2b` feat: add device icons and shell enhancements including menu commands and path labeling
- `72a0775` Update focus ring, floating notifications under Control Panel, shared keyboard switcher, Linux Force Quit, Wallpaper Colors/Pictures, and App Store piloti-appstore/Web Extensions/Plugins/Fonts
- `6fb1596` Add Touch Mode, BSOD bug report, Text Editor state/HTML Design/INI/JSON polish, accented Calculator/Notepad icons, Web Window back/URL/theme-color/per-window Dark Reader/PDF/Print, and popup dismissal
- `dd25ec3` Complete App Store AppFinder layout/Infos/Web Apps/progress, Dock folder stacks & progress/urgency, Security Apps/Permissions switch, VFS .json/.config/piloti migrations, Welcome/single-instance fix, and About window drag
- `6bfa0a9` Unify Console tabs with Chrome DevTools event counter/filters and use blue-on-white HTML icon
- `68b0f64` Add App Store Updates/Collections/Sources, XDG dock badges, Settings Security tab, web power/login flow, and UI fixes
- `7016949` Add inline autocomplete to Shell/Console and polish Console Events/Logs/Infos
- `2debb0a` Notifications: accent only for urgent; Wallpaper: fixed macOS-style preview header with screen name; Expander row: active state when open
- `08e1d5d` Normalize flathub-popular main\_categories arrays, per-window error boundary, and BSOD-on-preload debug toggle
- `74cd85d` USB & Text Editor Lottie icons, centered sidebar headerbar title, auto-hiding scrollbars, animated accent wallpaper + 3 nature wallpapers, About More info button, laptop wallpaper preview
- `fe8e576` Accent-derived Aurora Drift, global Dock-style tooltips, Advanced sidebar + Testing notifications, Wallpaper expander row, icon-only Open Folder buttons, Chrome Web Store web app + extension install
- `8a1ba03` macOS accent colors, restore XDG folder emblems, AppIndicator system plugin + compact sizing, left window menu, System settings pane + Full GNOME Settings toggle
- `b8e640d` Rename Applications to App Store, cancelable Flatpak install, remove Align Icons Right, web-only Fullscreen, 512 popular Flathub apps
- `7dd28ad` Share AuthPasswordCard layout between LoginScreenApp and LockScreen

## 0.10.2 — 2026-11-22

- Files (`piloti://apps`): hide icon zoom slider on Applications view while
  keeping zoom controls active in directory views.
- Web Apps: contrast-aware tinted headerbar colors (dark title and window
  controls on light `theme-color` websites) and focus shield for unfocused
  iframe windows.
- Help Menu: dynamic Keyboard Shortcuts popup reading live built-in and
  GTK/D-Bus menus, plus per-app website (`#<app>`) and GitHub Issue links.
- Chrome Extensions: uBlock Origin Lite and Dark Reader support (native Web
  Store config + Web-mode Dark Reader preview), popup `activeTab` activation,
  correct `~/.config/domicile/domicile.json` persistence, and managed local
  sample extension (`/usr/share/piloti/extensions/piloti-demo`).
- Text Editor & Image Viewer: explicit Save, shared Unsaved Changes dialog,
  INI preview via JSON viewer, Image Viewer toolbar fixes, white/blue-globe
  HTML mimetype icon, and capture Open notifications + IndexedDB VFS store.

### Commits

- `9b8d5a0` Release v0.10.2: apps zoom slider, theme-color contrast, dynamic Help menu, Chrome extensions support
- `8bd32e3` IndexedDB store for large VFS media, native image loading, shared unsaved dialog (editor+viewer), capture helpers, locale sync, tests
- `fd6f503` Text editor: close inline window via shell close event
- `01197c3` Fix editor close confirm, image viewer toolbar clicks, white html icon, focus shield for iframe windows
- `52852fb` Text editor: explicit save, unsaved-close prompt, INI preview; image viewer header/save fixes; capture Open action and webm saving
- `1578438` feat(fs-bridge,editor): wire gio set / gio info (gvfsd-metadata) for persistent file metadata on engine:native
- `1f2b362` fix(calc,windows,launcher,editor,menubar): wait for app DOM load before open anim, fix Calc resize & View menu, keep notification bell until cleared, preserve/select Launcher search & Esc-clear search fields, and save/restore TextEditor cursor/scroll in file metadata
- `b869e60` feat(files,desktop,shell): support .hidden and XDG Templates with New... submenu, constrain ControlPanel above dock, and hide System Settings in engine:web

## 0.10.1 — 2026-11-22

- Refactor src/lib/ into clean domain layers (engine-native, engine-web,
  engine, xdg, config, shell, plugins, core).
- Linux performance optimizations: pre-warm Domicile shell/greeter cache in
  postinst, compact deduplicated XDG icon index (~13x smaller) + SWR warm
  boot for icon index and XDG desktop apps, batch GSettings startup reads
  and consolidate 3 gsettings monitors into one `dconf watch`, lazy Xwayland,
  and skip heavy/looping GNOME autostart daemons (`user-dirs-update-gtk`,
  `org.gnome.Software`, conditional `orca`).
- Display Manager (`greetd`) fixes: terminate greeter compositor on session
  handoff, use `vt = 7` on Debian, honor `/etc/default/keyboard` layout +
  live keymaps, skip desktop session daemons in greeter mode, and clean up
  orphaned Chromium engine processes before session launch.

### Commits

- `480bd1c` fix(types): use GnomeInterfaceSnapshot in SystemBackendsContext
- `3e12a34` release: v0.10.1 — batch GSettings + dconf watch, XDG apps SWR cache, Linux perf & greetd polish
- `102b810` perf(linux,xdg): compact icon index cache (~35x smaller), SWR warm boot, lazy Xwayland, skip heavy autostart daemons
- `d67e0ef` refactor(lib): organize src/lib into engine-native, engine-web, engine, xdg, config, shell, plugins, core
- `9f68b88` fix(autostart): skip user-dirs-update-gtk.desktop on login
- `c6dfe11` feat(login-screen): align greeter card style with LockScreen, fix rounded border glitches, and declutter UI
- `6137d39` feat(files,icons,engine): refine Folders layout/context menu/info pane, restrict app icon accent tinting, and rename engine:system to engine:native
- `2e5529f` fix(greeter,session): clean up orphaned chrome engine on login and honor /etc/default/keyboard layout in greeter
- `d24e869` fix(greeter): exit domicile on greetd handoff, use vt=7 on Debian, skip desktop daemons in greeter mode
- `0593e87` perf(deb,linux): pre-warm Domicile shell & greeter cache in postinst to skip first-run Vite build and splash
- `e3bc8fd` fix(autostart): honor AutostartCondition, NotShowIn across Piloti:GNOME, and TryExec so Orca screen reader does not auto-launch
- `4310755` docs(website): update light and dark screenshots with Piloti Waves wallpaper

## 0.10.0 — 2026-11-22

* Release v0.10.0: Full XDG Desktop Portals, XDG Autostart/Recents/Thumbnails/Sound
  cues, standalone greetd Display Manager greeter (`piloti-greeter`, `greeter.js`,
  `piloti-greetd-client`, `greetd.toml`), LockScreen polish, and updated Roadmap.

### Commits

- `bf7336f` feat(portals,xdg,dm,linux): complete XDG portals & specs, greetd Display Manager greeter, Linux polish, and release v0.10.0
- `e9ab528` docs(website): use SVG sun/moon theme icons and 6-card 3x2 features grid
- `0b92256` feat(icons,wallpaper,docs): dynamic accent tinting across folder/file/app icons, animated trash icon, horizontal sliders, 16px wallpaper badge, plugin button size & system-adaptive website screenshots
- `5d7f48c` feat(ui,fonts,lock,login): 500 bold weight & live font style propagation, narrower browser/fallback windows, toggle search & left titles, LockScreen cleanup, GDM-style Login Screen app
- `94996d9` fix(ui,shell,icons,apps): unify glass material, menu borders, header button alignment, Papirus icons, Calculator resize & fade close
- `564e18e` feat(ui,wallpaper,plugins): Papirus dock/settings icons, reworked wallpaper + CSS/HTML animated standard, sample plugins, control panel & dock/fonts polish
- `5df73ef` feat(ui,theme): unify sidebar panel material, merge Piloti theme/icons, single-click default
- `b04c7e5` fix(ci): include cross-platform oxide and lightningcss lockfile entries
- `197148d` fix(ui): keep AdwSplitView sidebar item height compact
- `07fb9d0` fix(tests): handle Ubuntu zstd deb archives and isolate window mock in usb-and-engine test
- `9543bf9` style: format code changes across components and apps
- `53c6284` feat: add desktop environment file structure and system assets
- `6fc80fc` feat: add desktop environment file structure and system assets
- `22ccca1` feat: Papirus animated/empty-text/Loupe icons, .ini settings, engine split, xwayland-satellite, SSD dialog fix
- `ab184d6` Store settings and app states through VFS with live editing
- `d5d1f16` feat(icons,xdg): add Lottie animated icon support and Piloti animated/ icon theme
- `83645c7` feat(m4,m5,m6): pure Adwaita base + Piloti vibrant layer, PWA manifest metadata, ARIA listbox, chunk splitting & tests
- `a115985` fix(files): match macOS Finder zoom slider sizing (100px track, 4px height, 16px round thumb)
- `009dbd0` fix(files): give floating zoom slider explicit w-28 track width and full thumb
- `a92f50a` fix(files): floating bottom-left status badge and bottom-right compact zoom slider
- `5de1644` feat(m7,files,docs): XDG portals/autostart/recents/globs2/sound-theme, Files bottom zoom slider, inline help & docs

## 0.9.0 — 2026-11-21

* Initial Debian package release of Piloti Desktop.
* Install /usr/bin/piloti, /usr/bin/piloti-session, /usr/bin/piloti-webapp,
  and built-in piloti-* app launcher commands.
* Install Wayland session descriptor /usr/share/wayland-sessions/piloti.desktop,
  system desktop entries, Piloti icon theme, and bundled Domicile shell.

### Commits

- `abeb1a9` chore(release): v0.9.0 — multi-icon drag offsets, Files sort/emblems, reduced-motion parity, CI gate
- `90398c0` feat(vfs,devtools,launcher): GVfs mime/thumbnail metadata for webm, background VFS/events, console footer & launcher polish
- `b0fa81c` fix(ui,settings): restore window menu toggle, compact swatches, scale-only animations, dock menu & order
- `d10810b` docs: add native engine guide (docs/native.md) and M7 milestone to ROADMAP
- `90d83b9` feat(ui): Piloti/Adwaita themes, Fitt's law borders, movable launcher, es i18n
- `4f83f45` feat(icons,shell): Papirus mini-theme, dock 64px max, calc fixed header, fast quit fade
- `4ae8327` fix(wayland): omit pointerId on client-initiated window moves/resizes
- `0e1537a` fix(wayland): restore GTK4 headerbar drag via held-press gated Unfullscreen (kind 3)
- `c2b4420` fix(window): trim resize handle overlap and fix SSD popup height; document DRM cursor hotspot bug
- `acdf13d` docs: document live VM Wayland CSD/SSD and domicile findings in docs/BUGS.md
- `a685ccb` Fix GTK2 pcmanfm SSD detection, add heldPress + pointerId capture for Wayland client drags, and track bugs in docs/BUGS.md
- `4fe09ea` Fix Calculator resize/close via WindowManager, block tile/maximize, and auto-watch newly installed XDG apps
- `17ab8bb` Render Calculator directly for sidebar vibrancy, keep Favorite emblem red, propagate settings.ini live with E2E test
- `b090c1e` Mac App Store ambient hero backdrop, remove WindowMenuButton, make Calculator headerbar transparent
- `904e507` Restore scale-150 on AppStore featured slider backdrop icon
- `b700837` Fix Calculator drag/vibrancy/mode-switch, add Download/Compress/Extract to WebVFS, update SDK types
- `d2b022b` Redesign Calculator, add showWindowMenu setting opposite window controls, enlarge desktop icons
- `6d96329` Position AppStore slider icon top-left, deduplicate piloti://apps, fix Launcher web app icons, and cache VFS & XDG icon lookups
- `49a8210` Inline dynamic imports into dist/shell.js for Linux Domicile shell
- `c544a0b` Make App Store featured slider backdrop colors more vivid
- `36d9c40` Consolidate tests under tests/, restore vite configs to root, fix launcher webapp icons, add Applications folder in Files, and dim open files
- `0b73785` Spatial window persistence, open/close zoom polish, and Playwright E2E tests
- `2b323f7` fix(session): preserve window payload and restore all builtin apps on reload; add functional test
- `bfceee4` feat(wm,ui,ci): icon-origin zoom animations, sleeker ControlPanel sliders, About Computer version, functional test, and Pages CI
- `30a000e` fix(vfs,grid,i18n): remove VFS cache, fix rubber-band selection, and add Japanese (ja) CJK locale
- `8734eb1` perf(wm,context,apps): fix 2.5s unready stall for Notepad/ImageViewer and eliminate shell-wide re-renders
- `f32e195` perf(vfs,bridge): add in-memory VFS cache and direct in-process FS bridge fallback
- `36ebc64` fix(apps): native WindowControls/WindowMenuButton for Notepad & Image Viewer, outside-click dismissal for inline edit
- `d1ca00d` fix(wm,apps): render TextEditorApp and ImageViewerApp directly for native headerbar interaction
- `4734af4` fix(headerbar): forward center title clicks through IsolatedAppFrame CSD drag overlay for inline rename
- `5914e04` fix(vfs,apps): cross-iframe BroadcastChannel rename sync, spatial Desktop slot preservation, and ImageViewer headerbar rename
- `c591c2a` fix(web-apps): route piloti-webapp .desktop entries to openWebUrl instead of simulated Wayland surface

## 0.7.1 — Extensions, Plugins, metadata::emblems & Web Demo — 2026-11-20

- **GVfs `metadata::emblems`**: Files VFS now stores and syncs emblems under `metadata::emblems` (`emblem-favorite`, `emblem-important`, `emblem-work`, `emblem-personal`) on `WebVfsEntry` records for future Nautilus compatibility.
- **Website Demo**: Updated `docs/demo/` with the latest build including Chrome Extensions preview, Tier 1 & manifestless CSS/JS User Plugins, inline scrollable menus, `.config/Piloti/*.ini` persistence, and `.local/share/applications/*.desktop` entries.
- **Versioning**: Adopted `0.7.x` incremental minor/patch numbering (`0.7.1`, `0.7.2`, ...).
- **Docs**: Updated `README.md` and `docs/PLUGINS.md`.

### Commits

- `f40830a` chore(release): v0.7.1 — metadata::emblems VFS support, updated docs & web demo

## 0.8.0 — Extensions, User Plugins & Shell Refinements — 2026-11-20

- **Chrome Extensions in Web Windows**: Toolbar action icons, badges, activation, and auto-sized popup webviews via `domicile.extensions`, plus a Manifest V3 demo extension (`extensions/piloti-demo/`) and Web preview toggle in Settings → Advanced.
- **User Plugins (`~/.config/piloti/plugins/`)**: Tier 1 & manifestless single-file `.css` / `.js` plugins, MenuBar status items, Launcher commands, `window.__PILOTI__` shell bridge, and Settings → Advanced management UI.
- **VFS & App Persistence**: `createDir`, `writeFile`, and `stat` in Web VFS; `.config/Piloti/<app>.ini` persistence for Settings pane and Notepad preferences; standard XDG `.desktop` entries in `.local/share/applications/`.
- **UI & Menu Fixes**: Replaced floating submenus with inline scrollable accordions; fixed Files sidebar ancestor selection; made hidden dotfiles clearly translucent (55% opacity); updated App Store & DevTools icons; pinned all built-in apps to the Dock by default.

### Commits

- `39b12d0` chore(release): v0.8.0
- `7928c9d` fix(menus,files): replace submenus with inline scrollable accordions and make hidden files 55% opacity
- `0b3db74` fix(shell): web-vfs file ops, .config/Piloti ini prefs, .desktop entries, sidebar selection, icons & submenus
- `e4e59ce` feat(plugins): implement Tier 1 & manifestless CSS/JS user plugins with Settings UI
- `7b3a6fd` feat(extensions): add Browser Extensions settings in Advanced and Piloti Demo Extension
- `c5c2f47` feat(browser): add Chrome extensions toolbar actions and popup webview support
- `d691302` feat(capture): sequential Screenshot/Screencast naming and one-click audio recording
- `9be36c6` feat(files): 85% hidden file opacity, emblem hover tint, and smooth arrange/zoom transitions
- `c393805` fix(wm): light website default, submenu z-index, headerbar double-click zoom, and multi-window dock toggle

## 0.7.0 — Design & Shell Refinements — 2026-11-20

Notepad live rename & sync, proportional icon labels, larger default Files grid, App Store hero slider redesign, compact collapsed sidebars, opaque unfocused sidebars, Auto day/night & OS theme, Alt-Tab 64px icons, Dock 64px max, and Piloti website in-app window.

### Commits

- `df9e3c5` chore: release v0.7.0
- `4ad7eea` feat(shell): refine sidebars, AppStore slider, Alt-Tab, Dock max size, auto theme, and web links
- `b62218d` feat(files): scale icon labels with font size, bump default grid size, and tint emblem buttons
- `e114521` feat(notepad): default prefs, cursor toggle, icon toolbar buttons, and live file rename sync

## 0.6.1 — Refined UI and Bugfixes — 2026-11-20

Refined UI, desktop/WM interactions, VFS FreeDesktop integration, Console VFS & Event Inspector, Terminal pipes/history, and Adwaita High-Contrast theme.

### Commits

- `1589b91` feat(theme): add Adwaita high-contrast variant and custom accent color picker
- `0aa15f7` feat(terminal): add pipes, redirects, grep, Ctrl+R reverse search, and persistent history
- `2243be7` feat(devtools): add live VFS diff and WindowEvent inspector tab
- `5f5017e` feat(vfs): add /etc/issue terminal banner and XDG mimeapps.list Open With support
- `cbaa5c1` feat: refine window menu, icon drag/emblems/badges, overview transitions, JSON preview, and terminal curl/piloti
- `ec74e8b` fix: polish sidebars, emblems, icon drag FLIP, menus, sliders, overview, and dock bounce
- `0da18ce` feat: refine WM drag, Files/TextEditor menus, desktop icon drop, and XDG web app storage
- `e15aa50` feat: add advanced settings pane and update desktop environment components and demo build
- `72e10f3` feat: update desktop environment components, apps, and documentation

## 0.6.0 — 2026-11-19

App Store, fixed settings, window management bugs.

### Commits

- `516ee54` refactor: update desktop environment components and apps

## 0.5.0 — 2026-11-18

No release notes.

### Commits

- `5d1ec13` feat: release v0.5.0

## 0.4.0 — 2026-11-18

No release notes.

### Commits

- `f526361` feat: release v0.4.0

## 0.3.0 — 2026-11-17

- **Window Manager & Edge Snapping**: Unified Adwaita `WindowTitlebar` (`46px` height) and circular monochrome `WindowControls` respecting GNOME `buttonLayout` (`:close` default), added titlebar double-click maximize/restore, staggered multi-window cascade (`+24px, +24px`), fixed left/right edge snapping reverting to pre-tile size (and tightened snap zone to `12px` left/right, `10px` top), and clamped window bounds cleanly.
- **Web Apps & Icons**: Renamed built-in web apps (`Settings (Web)`, `Files (Web)`, `Terminal (Web)`, `Text Editor (Web)`), added custom app icons and aligned web app icons vertically on the Dock, added webview URL bar and loading state, and removed icon drop shadows for a crisp desktop.
- **Terminal (Web)**: Updated prompt to `<path>> `, kept entered commands white, styled folders in bold blue in `ls`, added `Tab` command autocompletion, `ArrowUp`/`ArrowDown` history navigation, and full-page text cursor.
- **Global MenuBar & Keyboard Navigation**: Updated Desktop menu (`Piloti -> Desktop`, `File` with New Window / New Text File / Screenshot / Record / Restart Desktop, `View` with Launcher / Control Panel / Settings (Web) / DevTools, `Help` with Shortcuts / Report Issue), added `Ctrl+Esc` to open the Piloti menu, and fixed continuous `ArrowLeft`/`ArrowRight` navigation across menus, Launcher, and Control Panel.
- **Launcher**: Split `Apps` and `Web apps` categories, renamed `Recent` and `Actions`, muted and aligned inline autocomplete text (`InlineCompletionInput`), and added `ArrowUp`/`ArrowDown` search query history navigation.
- **Control Panel & Notifications**: Moved brightness/volume sliders above quick toggles with OSD overlay feedback, hid empty notifications section, removed hover states on controls, matched active pill feedback (`color-mix` lighter accent), locked notification banners to top-right, and added real Web Audio chime playback (`sound-effects.ts`) for **Play Test Alert**.
- **Desktop, Files & Settings**: Updated Desktop context menu (`New Folder`, `New Text File`, `Align Icons`, `Change Wallpaper`), switched icon/file selection to `onPointerDown`, added `useSidebarKeyboardNav` for arrow/Tab sidebar navigation, removed row descriptions in Settings panes, and removed CSS transitions on active states.
- **DevTools & Architecture**: Set Console & Logs background to white/black, added DevTools tables, extracted `NotificationsContext`, modularized `src/lib/gnome/`, added `storage-cache.ts` debounced `localStorage` persistence, switched BSOD background to black, and updated `docs/ARCHITECTURE.md`, `docs/API.md`, and `docs/WELCOME.html`.

### Commits

- `3c7f76b` feat: release v0.3.0
- `ba7590b` feat: polish window bounds, webview URL bar & loading state, DevTools tables, and custom app icons

## 0.2.0 — 2026-11-16

No release notes.

### Commits

- `336c96f` feat: release v0.2.0
- `5019f35` refactor: update demo assets and xdg nodejs implementation
- `4fd8163` feat: add console app and web demo build output

## 0.1.0 — 2026-11-11

No release notes.

### Commits

- `7d58785` initial commit
