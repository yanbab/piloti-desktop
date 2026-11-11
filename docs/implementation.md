# Piloti Desktop — Implementation Plan

## 1. Overview & Vision

**Piloti** is a modern, fluid Linux desktop shell built on [Domicile](https://domicile-desktop.com/) (a Wayland compositor whose shell is a web page) and styled with [CupertinoUI](https://www.cupertino-ui.com/) (macOS 27 components for `shadcn/ui` and Tailwind CSS v4) and GNOME Adwaita.

Taking design inspiration from both **macOS** (Liquid Glass materials, top application menu bar, magnifying dock, Spotlight-like command palette, grouped settings forms) and **GNOME** (unified quick-settings + notification calendar popover, distraction-free workspace ergonomics, keyboard-first workflow), Piloti provides a cohesive desktop experience that runs:
1. **Natively on Linux (Debian / VMware)** via `domicile ./desktop.tsx` or `domicile ./dist/shell.js`.
2. **In any Browser on macOS / Linux / Windows** via Vite (`bun run dev` / `npm run dev`) with a full mock Domicile host and interactive sample applications.

---

## 2. Architecture & Dual-Runtime Design

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         Piloti Desktop Shell UI                           │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────────────┐  │
│  │ TopMenuBar  │ │WindowManager │ │ DesktopDock  │ │ControlCenterPanel │  │
│  └─────────────┘ └──────────────┘ └──────────────┘ └───────────────────┘  │
│  ┌────────────────────┐ ┌──────────────────────┐ ┌─────────────────────┐  │
│  │  AltTabSwitcher    │ │   CommandPalette     │ │ Settings & Samples  │  │
│  └────────────────────┘ └──────────────────────┘ └─────────────────────┘  │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
   ┌─────────────────────────────────┐ ┌─────────────────────────────────┐
   │   Domicile Compositor Runtime   │ │   Browser / macOS Dev Runtime   │
   │  (@domicile-desktop/react+sdk)  │ │   (FakeDomicileHost + Bridge)   │
   │  - Real Wayland <app app-id>    │ │  - Simulated Wayland Windows    │
   │  - processes.launch([...])      │ │  - Built-in Sample Apps         │
   │  - keyboard.grab("Alt+Space")   │ │  - Browser Keyboard Shortcuts   │
   │  - notifications / tray / dbus  │ │  - Persistent Local State       │
   └─────────────────────────────────┘ └─────────────────────────────────┘
```

### Entry Points
- **`desktop.tsx`**: The primary Domicile shell module exporting `export const Shell = mount(Desktop)`. Also detects when mounted directly in a standard browser page and initializes the browser development harness automatically.
- **`index.html` & `src/main.tsx`**: Vite browser entry point for local development on macOS (`bun run dev` / `npm run dev`).
- **`vite.config.ts` & `vite.shell.config.ts`**:
  - `vite.config.ts` serves the interactive browser development environment and builds the web preview.
  - `vite.shell.config.ts` bundles the standalone Domicile shell (`dist/shell.js`) with inline CSS injection (`cssInTheModule`) and `preserveEntrySignatures: "exports-only"` per the Domicile Packaging specification.

---

## 3. Component Breakdown

### 3.1 CupertinoUI Foundation (`src/components/ui/` & `src/styles/macos.css`)
Installed directly from the official CupertinoUI registry (`https://www.cupertino-ui.com/r/{name}.json`):
- **Theme (`macos-theme`)**: Full CSS variables for light/dark modes, 13 system accent colors (`--mac-accent`), Liquid Glass backdrops (`mac-material-menu`, `mac-material-dock`, `mac-material-hud`), typography tokens, and radii.
- **Layout & Shell Primitives**: `window`, `dock`, `menubar`, `command`, `dialog`, `popover`, `dropdown-menu`, `context-menu`, `tooltip`, `scroll-area`, `separator`, `kbd`.
- **Controls & Forms**: `grouped-form`, `icon-tile`, `button`, `switch`, `slider`, `select`, `tabs`, `input`, `search-field`, `badge`, `progress`, `radio-group`, `toggle-group`, `avatar`.

### 3.2 Desktop State & Settings Store (`src/context/DesktopStateContext.tsx`)
Manages reactive shell state persisted to `localStorage` and synchronized with Domicile (`domicile.theme`, `domicile.notifications`, `domicile.windows`, `domicile.processes`, `domicile.keyboard`):
- **Appearance**: Theme mode (`dark` | `light` | `system`), accent color (`blue`, `purple`, `pink`, `red`, `orange`, `yellow`, `green`, `mint`, `teal`, `cyan`, `indigo`, `brown`, `graphite`), reduced motion, window translucency.
- **Dock Configuration**: Icon size (`36px`–`72px`), magnification enabled & scale (`64px`–`96px`), auto-hide behavior, show running indicators, show Favorites stack.
- **Wallpaper / Background**: Curated presets (macOS Sequoia/Sonoma dynamic gradients, GNOME Adwaita abstract art, Alpine dusk, Cyber grid) + custom image URL.
- **System Controls**: Volume level & mute, Display brightness & Night Light, Wi-Fi enabled & active SSID, Bluetooth enabled & connected devices, Do Not Disturb, Power profile (`balanced` | `performance` | `power-saver`).
- **Window & App Registry**: Unified list of Wayland windows (`useWindows()`) and shell/sample windows, tracking z-index order, minimized state, maximized/snapped geometry, and focus history (MRU order for `Alt+Tab`).

### 3.3 Top Menubar (`src/components/shell/TopMenuBar.tsx`)
- **Left Cluster**:
  - **Piloti System Menu**: About Piloti, System Settings, App Launcher (`Alt+Space`), Lock Screen, Restart Shell, Log Out.
  - **Active Application Menus**: Bold active app title + contextual menus (`File`, `Edit`, `View`, `Window`, `Help`) with keyboard shortcut hints and actions (New Window, Minimize, Zoom/Maximize, Tile Left/Right, Close Window).
- **Right Cluster (`MenubarExtras`)**:
  - Native system tray icons (`domicile.tray.items`).
  - Quick search trigger (`Alt+Space`).
  - Status pill with Wi-Fi, Sound, Battery indicators.
  - Date & Clock button that toggles the right-side **Notifications & Quick Settings Panel**.

### 3.4 Bottom Dock & Favorites Stack (`src/components/shell/DesktopDock.tsx`)
- Uses CupertinoUI `<Dock>` with smooth Gaussian pointer magnification and auto-hide support.
- **Left Section**: Pinned apps + active running apps (Settings, Terminal, Files, Browser, Notes, Activity Monitor, plus any running Linux Wayland client). Clicking focuses or restores minimized windows, or launches the app. Context menu (right-click) supports New Window, Keep in Dock, Minimize, and Quit.
- **Right Section (Favorites Stack)**: Separated by `<DockSeparator />`. Features a macOS-style stacked folder icon for **Favorites** that opens a Liquid Glass fan/grid popover containing favorite folders, quick documents, and recent launchers, alongside the **Trash / Minimized Windows** item.

### 3.5 Floating Window Manager & CSD / GNOME Support (`src/components/shell/WindowManager.tsx`)
- Renders floating windows on top of the desktop canvas using CupertinoUI `<Window>`.
- Supports dragging by titlebar, 8-way edge/corner resizing, double-click titlebar to zoom/maximize, traffic light buttons (Close, Minimize to Dock with perspective matrix animation, Zoom), and window focus elevation.
- **Client-Side Decorations (CSD) for GNOME / GTK4 / Libadwaita Apps**:
  - Automatically detects `window.clientFrame === true` on Wayland clients (or honors **Settings → Appearance → Titlebar & Frame Mode**: `Auto`, `Always CSD`, `Force SSD`).
  - When CSD is active, omits the server-side `<WindowTitlebar>` so GNOME's native `AdwHeaderBar` / `GtkHeaderBar` renders cleanly at the top of the window without double titlebars.
  - Synchronizes `xdg_toplevel` window states via `domicile.windows.setStates(appId, states)` (`WindowState.TiledLeft/Right/Top/Bottom` and `WindowState.Maximized`) so GTK4/libadwaita apps drop their internal buffer shadow and transparent outer margin when clipped to Piloti's rounded window frame (or optionally render their raw native GTK shadow when `csdClipShadow` is turned off).
  - Listens to `domicile.windows.requests()` (`WindowRequestKind.Maximize`, `Unmaximize`, `Fullscreen`, `Unfullscreen`) so clicking the maximize/fullscreen buttons inside a GNOME app's own headerbar updates Piloti's window state.
  - Supports **Alt + Drag / Super + Drag** anywhere over a CSD window (`modifierGrabActive` drag overlay) as well as a subtle top-center **CSD Grab Pill** (`csdShowGrabBar`) for effortless mouse dragging and quick window actions.
  - Renders Wayland child popups (`window.parent !== undefined` for `GtkPopoverMenu`, dropdowns, and tooltips) via `<app app-id={popup.appId} frame={String(popup.frame)} />` positioned over their parent surface.
- Bridges Wayland `<app app-id={w.appId} />` elements when running under Domicile:
  - Calls `domicile.windows.setBounds(appId, { x, y, width, height })` when moved or resized, or `{ x: 0, y: 0, width: 0, height: 0 }` when minimized.

### 3.6 Windows-Style Alt+Tab Switcher (`src/components/shell/AltTabSwitcher.tsx`)
- Grabs `Alt+Tab` and `Alt+Shift+Tab` via `domicile.keyboard.grab` (and browser `keydown`/`keyup`).
- Opens a centered translucent HUD overlay displaying all open windows in Most-Recently-Used (MRU) order.
- Each card shows a live window preview / app surface snapshot, app icon badge, window title, and status badge (e.g., Minimized).
- Holding `Alt` and pressing `Tab` / `Shift+Tab` / Arrow keys cycles selection; releasing `Alt` or pressing `Enter` activates, unminimizes, and raises the target window.

### 3.7 Command Palette (`src/components/shell/CommandPalette.tsx`)
- Bound to `Alt+Space` (and `Cmd+K` / `Ctrl+Space` convenience aliases in browser).
- Built on CupertinoUI `<CommandDialog>` (`cmdk`).
- Categorized results with instant fuzzy filtering:
  - **Applications**: Launch built-in apps or Linux desktop apps (`kitty`, `firefox`, `code`, `nautilus`, etc. via `domicile.processes.launch`).
  - **Open Windows**: Switch directly to any open window.
  - **System Actions**: Toggle Dark/Light Mode, Open Settings panes, Mute/Unmute Audio, Toggle Do Not Disturb, Tile Focused Window Left/Right, Maximize Window, Send Test Notification, Lock Session.
  - **Favorites**: Quick access to favorite directories and files.

### 3.8 Right-Side Notifications & Quick Settings Panel (`src/components/shell/ControlCenterPanel.tsx`)
- Slides out on the top-right beneath the Menubar when clicking the status cluster or clock.
- **Quick Settings Grid**: 2-column pill buttons for Wi-Fi, Bluetooth, Dark Mode, Do Not Disturb, Night Light, and Power Mode.
- **Hardware Sliders**: Interactive Sound Volume and Display Brightness sliders using CupertinoUI `<Slider>`.
- **Calendar & Weather/Uptime Header**: Today's date, time, and session status.
- **Notifications Feed**: Displays live notifications from `domicile.notifications.list` merged with shell notifications, supporting click invocation (`notifications.invoke`), individual dismiss (`notifications.dismiss`), and "Clear All".

### 3.9 Settings Application (`src/components/apps/SettingsApp.tsx`)
- Built with a macOS System Settings sidebar (`IconTile` + search filter) and CupertinoUI `<GroupedForm>` panes:
  1. **Appearance**: Light/Dark/Auto theme selector, 13 macOS accent color swatches, wallpaper tinting, animation toggle.
  2. **Dock & Menu Bar**: Dock size slider, magnification toggle & scale slider, auto-hide toggle, Favorites stack toggle, 24-hour clock & seconds toggles.
  3. **Wallpaper / Background**: Visual grid of desktop wallpapers + custom image URL input.
  4. **Wi-Fi & Network**: Network adapter toggle, connected network details, available Wi-Fi networks list.
  5. **Sound**: Output volume, mute switch, output/input device selectors, alert sound tester.
  6. **Displays**: Resolution & scale readout (`useDisplays()`), brightness slider, Night Light toggle.
  7. **About & Shortcuts**: System overview, Domicile runtime mode indicator, and keyboard shortcut cheat sheet.

### 3.10 Sample Applications for Browser / macOS & Testing (`src/components/apps/`)
- **Terminal (`TerminalApp.tsx`)**: Interactive shell with command history (`help`, `neofetch`, `ls`, `open`, `notify`, `theme`, `uname`, `clear`, or launching Linux binaries when under Domicile).
- **Files (`FilesApp.tsx`)**: File manager with sidebar favorites, breadcrumb bar, icon/list view toggle, and file inspector.
- **Notes (`NotesApp.tsx`)**: Multi-note editor with persistent storage and search.
- **System Monitor (`MonitorApp.tsx`)**: Real-time resource charts, open window inspector, and process manager.
- **Web Browser (`BrowserApp.tsx`)**: Embedded web view / documentation reader (`<webview>` on Domicile, `<iframe>`/reader in browser).

---

## 4. Verification & Testing Plan

1. **Typecheck & Build**:
   - Verify TypeScript compilation (`tsc --noEmit`).
   - Verify browser production build (`bun run build:web`) and Domicile standalone shell bundle (`bun run build:shell` -> `dist/shell.js`).
2. **Browser / macOS Runtime Verification**:
   - Launch dev server and verify Top Menubar, Bottom Dock, Favorites Stack, Floating Windows (drag, resize, minimize, zoom), `Alt+Tab` switcher, `Alt+Space` Command Palette, Right-side Notifications & Quick Settings panel, and the Settings app.
3. **Domicile Compatibility Check**:
   - Ensure `desktop.tsx` exports `Shell = mount(Desktop)` cleanly and handles real `<app app-id>` Wayland windows alongside shell windows for testing in Debian under VMware.

