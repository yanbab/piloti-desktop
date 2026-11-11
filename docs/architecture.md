# Architecture & Dual-Runtime Design

Piloti is architected to run identically across two environments:
1. **Domicile Wayland Compositor (Linux / Debian)**: `Shell` runs inside Domicile's Chromium engine with a live `Domicile` desktop object (`windows`, `keyboard`, `processes`, `notifications`, `tray`, `theme`, `displays`, `files`, `dbus`, `portals`, `capture`, `session`), rendering native Wayland clients inside `<app app-id="…" />` elements.
2. **Web Browser / macOS Development Harness**: Mounts into `#root` using `@domicile-desktop/react/fake-domicile` (`FakeDomicileHost`) paired with virtual XDG `.desktop` / Adwaita `.svg` files in [`src/lib/browser-domicile.ts`](../src/lib/browser-domicile.ts).

Only **System Settings** is built directly into the shell; all other applications (`nautilus`, `kitty`, `firefox`, `gnome-control-center`, etc.) run as native Wayland / XDG processes.

---

## 1. Directory Structure

```text
piloti-desktop/
├── desktop.tsx                              # Domicile entry (`export const Shell = mount(PilotiShell)`)
├── index.html                               # Browser / macOS Vite entry HTML
├── vite.config.ts                           # Browser dev & `dist-web/` build config
├── vite.shell.config.ts                     # Standalone Domicile bundle (`dist/shell.js`)
├── docs/                                    # Website (`index.html`) + Markdown documentation
│   ├── index.html                           # Adwaita / Flathub-inspired landing page
│   ├── .nojekyll                            # Direct static serving on GitHub Pages
│   ├── README.md
│   ├── architecture.md
│   ├── components-and-features.md
│   └── vmware-debian-guide.md
└── src/
    ├── main.tsx                             # Browser harness bootstrap
    ├── context/
    │   ├── SettingsContext.tsx              # Persisted preferences, themes, wallpapers, per-app bounds
    │   ├── SystemBackendsContext.tsx        # GSettings monitor, daemons, notifications, session lock, capture
    │   ├── AppsContext.tsx                  # XDG .desktop & Icon Theme indexing + launching
    │   ├── WindowsContext.tsx               # Settings + Wayland windows, popups, tiling, Alt+Tab, shortcuts
    │   └── DesktopStateContext.tsx          # Composes providers & exports focused hooks + useDesktopState
    ├── data/
    │   └── catalog.ts                       # Accent palettes, wallpapers, Settings & default launcher metadata
    ├── components/
    │   ├── shell/
    │   │   ├── PilotiShell.tsx              # Root surface, wallpaper, idle banner, overlays
    │   │   ├── TopMenuBar.tsx               # App menus, workspace switcher, capture pill & tray
    │   │   ├── TrayIndicatorButton.tsx      # DBusMenu popup renderer for StatusNotifierItems
    │   │   ├── DesktopDock.tsx              # Magnifying Dock for pinned & running apps
    │   │   ├── WindowManager.tsx            # CSD/SSD window frames, edge snap preview, <app> surfaces
    │   │   ├── AltTabSwitcher.tsx           # MRU task switcher with live PNG window previews
    │   │   ├── CommandPalette.tsx           # Alt+Space launcher (XDG apps, windows, actions)
    │   │   ├── ControlCenterPanel.tsx       # Quick Settings, hardware sliders, screenshot/record & notifications
    │   │   ├── PortalDialogs.tsx            # XDG Desktop Portal UI (Screenshot, ScreenCast, PickColor, Access)
    │   │   ├── LockScreen.tsx               # PAM / compositor lock screen overlay
    │   │   └── AppSymbol.tsx                # XDG SVG/PNG icon renderer with squircle fallback
    │   ├── apps/
    │   │   ├── SettingsApp.tsx              # Built-in System Settings host window
    │   │   └── settings/                    # Focused pane modules (Appearance, Dock, Wallpaper, Network, Sound, Displays, About)
    │   └── ui/                              # Shared UI primitives (window, dock, menubar, command, dialog, etc.)
    ├── lib/
    │   ├── xdg-desktop.ts                   # Single-file XDG Desktop Entry + Icon Theme Spec module
    │   ├── gnome-bridge.ts                  # GSettings, gnome-control-center, wpctl/pactl, nmcli, sysfs battery
    │   ├── cursors.ts                       # Zero-offset (0, 0) SVG cursors for Ozone/DRM + vmwgfx
    │   ├── browser-domicile.ts              # FakeDomicileHost dev harness with virtual XDG apps & icons
    │   ├── xdg-desktop.test.ts              # Unit tests for Desktop Entry & Icon Theme parsers
    │   └── gnome-bridge.test.ts             # Unit tests for GSettings, wpctl & nmcli parsers
    └── styles/
        ├── globals.css                      # Tailwind v4 + cursor variables
        ├── macos.css                        # Cupertino macOS Liquid Glass tokens
        └── adwaita.css                      # GNOME 47 / Libadwaita 1.6 calibrated tokens
```

---

## 2. Core System Bridges

### 2.1 Wayland Surfaces (`<app app-id="…">`) & CSD Support
- **Bounding Box Sync**: `WaylandAppSurface` calls `domicile.windows.setBounds(appId, rect)` on layout and resize changes, and sets `0×0` when minimized.
- **Zero-Duplicate CSD**: Sends `WindowState.TiledLeft/Right/Top/Bottom` (and `Maximized` when zoomed) so GTK4/Libadwaita windows drop their client-side drop shadows and render cleanly inside Piloti's rounded frame.
- **Fast Drag & Edge Snap**: Dragging updates `style.translate` directly on the DOM node at display refresh rate and commits geometry to React state (and `savedWindowBounds`) on release; dragging to screen edges triggers a translucent snap zone (`left`, `right`, or `full`).

### 2.2 XDG Desktop & Icon Theme Module (`src/lib/xdg-desktop.ts`)
- Scans `$XDG_DATA_HOME/applications`, Flatpak/Snap exports, and `/usr/share/applications` with localization and `Exec=` field code expansion.
- Parses `index.theme` (`Inherits`, `Fixed`/`Scalable`/`Threshold` directories) and loads real `.svg`/`.png` app icons across the active theme (`watchIconTheme`), falling back cleanly to `/usr/share/pixmaps`.

### 2.3 GNOME Integration (`src/lib/gnome-bridge.ts`)
- Launches applications with `XDG_CURRENT_DESKTOP=GNOME` and `XDG_SESSION_DESKTOP=gnome`, unlocking full panels in `gnome-control-center`.
- Maintains two-way `GSettings` sync (`gsettings monitor org.gnome.desktop.interface` and `gsettings set`) and bridges PipeWire (`wpctl` / `pactl`), NetworkManager (`nmcli`), `powerprofilesctl`, ACPI battery sysfs, and hardware Night Light (`domicile.displays.setColorTemperature`).
