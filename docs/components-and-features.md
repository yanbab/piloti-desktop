# Components, Shortcuts & Features

## 1. Top Menubar (`src/components/shell/TopMenuBar.tsx`)
- **System & App Menus**: Dynamic bold active app menu plus contextual `Window` and `Help` actions.
- **Center Workspace Switcher**: 4 workspaces with active and populated indicators.
- **Recording / Cast Indicator**: Live `REC` / `Sharing` pill with Pause, Resume, and Stop controls whenever `useCapturing()` reports an active session.
- **DBusMenu System Tray (`TrayIndicatorButton.tsx`)**: Renders `domicile.tray.items` and opens native `DBusMenu` dropdowns (`domicile.tray.menu`) with checkboxes, radios, separators, and submenus.
- **Quick Controls**: Launcher (`Alt+Space`), Task Switcher (`Alt+Tab`), live Battery indicator (when present on hardware), Wi-Fi/Volume/DND status, and Clock toggle for the Control Center.

## 2. Bottom Dock (`src/components/shell/DesktopDock.tsx`)
- Magnifying `<Dock>` displaying pinned launchers (`Settings`, `Files`, `Terminal`, `Browser`), running Wayland windows with real XDG icons, and minimized window tiles with genie/scale restore animations.
- Right-click context menus allow opening new windows, pinning/unpinning, minimizing, and quitting.

## 3. Window Manager (`src/components/shell/WindowManager.tsx`)
- **CSD & SSD Support**: Omits server titlebars automatically on GNOME / GTK4 (`clientFrame`) apps while providing single-click headerbar dragging (`46px` center strip) and `Alt`/`Super + Drag` anywhere.
- **8-Edge Resizing**: Sets the `resizing` attribute on `<app>` during edge drags for immediate compositor updates.
- **Edge Snapping & Bounds Memory**: Dragging to left, right, or top screen edges shows a translucent drop preview and tiles on release; per-`appId` window size and position are saved and restored on relaunch.
- **Zero-Offset DRM Cursors (`src/lib/cursors.ts`)**: Anchors custom SVG cursor hotspots at `(0, 0)` so clicks register at the exact visual pointer tip even under Chromium Ozone/DRM + VMware `vmwgfx`.

## 4. `Alt+Tab` Task Switcher (`src/components/shell/AltTabSwitcher.tsx`)
- Menu-material overlay listing windows in Most-Recently-Used order.
- Captures real PNG thumbnails of live Wayland windows via `domicile.capture.preview(PreviewedWindow.App(...))`.

## 5. `Alt+Space` Command Palette (`src/components/shell/CommandPalette.tsx`)
- Uses the exact menu material (`variant="menu"` on `DialogContent`) with no dark backdrop.
- Searches open windows, XDG-discovered `.desktop` apps (with real icons), System Settings, `gnome-control-center`, screenshot/recording actions, theme/appearance toggles, and window tiling commands.

## 6. Control Center & Notifications (`src/components/shell/ControlCenterPanel.tsx`)
- Quick toggles for **Wi-Fi**, **Bluetooth**, **Dark Mode**, **Do Not Disturb**, **Night Light** (`4200K` hardware LUT via Domicile), and **Power Mode** (`powerprofilesctl`).
- Compact single-line **Brightness** and **Volume** (`wpctl`/`pactl`) sliders, plus quick **Screenshot** (`Print`), **Screen Record**, and **Settings** triggers.
- Unified notification list backed by `domicile.notifications`.

## 7. System Settings (`src/components/apps/SettingsApp.tsx`)
The sole built-in shell app, organized into 7 modular panes under `src/components/apps/settings/`:
1. **Appearance**: Switch between **Cupertino** and **Adwaita**, Light/Dark/Auto mode, accent swatches (including GNOME 47 Adwaita accents), vibrancy, and CSD/SSD frame mode.
2. **Dock & Menu Bar**: Dock size, magnification, auto-hide, and 24-hour / seconds clock options.
3. **Wallpaper**: 6 built-in meshes, custom image URLs, plus XDG Wallpaper portal updates.
4. **Wi-Fi & Network**: Radio toggle and live NetworkManager (`nmcli`) wireless networks.
5. **Sound**: Master output volume, mute toggle, and live PipeWire / PulseAudio sinks (`pactl`).
6. **Displays**: Connected outputs, **Add 1080p Virtual** display (`domicile.displays.addVirtual`), brightness, and Night Light.
7. **About Piloti**: Two-way `GSettings` sync toggle, `Prefer Native gnome-control-center` toggle, direct GNOME panel launchers, detected daemon badges, and full shortcut reference.

## 8. Lock Screen & Portal Dialogs
- **`LockScreen.tsx`**: Wired to `domicile.session` (`locked`, `lock()`, `unlock(passphrase)`, `idleWarnings()`, `unlockRefusals()`) with PAM passphrase authentication.
- **`PortalDialogs.tsx`**: Handles `Screenshot` (area drag-select / window / fullscreen), `ScreenCast` picker, `PickColor`, `Access`, `Account`, `Wallpaper`, `InputCapture`, and `Usb` portal requests.
