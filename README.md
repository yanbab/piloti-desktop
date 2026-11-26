<p align="center">
  <img src="./docs/assets/piloti-icon.svg" alt="Piloti Desktop Icon" width="112" height="112" />
</p>

# Piloti Desktop

An hybrid Web/Linux desktop shell built on [Domicile](https://domicile-desktop.com/), a Chromium based Wayland compositor.

It allows nice experiments when boundaries between web and native apps are not so important anymore.


## Features

### Shell
- Wayland window management (SSD/CSD, snapping, Overview, workspaces, Alt+Tab)
- Unified menu bar, system tray, movable Launcher & Control Panel
- Magnifying Dock, Desktop Icons spatial grid & Lock Screen
- Piloti & Adwaita light/dark/high-contrast themes, Papirus mini-theme, plugins & Chrome extensions
- FreeDesktop standards specs: Recents (XBEL), Trash, MimeApps & Globs2, Desktop Entries, Icon Themes, Autostart, Desktop Portals, Notifications, BaseDirs, UserDirs

### Apps
- Files (Grid/List views, Sort & Emblem filtering, bottom zoom slider, GIO/GVfs metadata)
- Web Terminal (pipes, redirects, `Ctrl+R` history, `piloti` CLI) & DevTools (REPL, Logs, Infos, VFS & Events, Storage)
- Notepad (Markdown & JSON preview), Calculator (Standard & Scientific), Image Viewer, App Store, Settings

## Quick Start

### Browser Development Mode

```bash
bun install
bun run build
bun run dev
```

Open `http://localhost:5173`. Runs against a local `FakeDomicileHost` harness with simulated apps and hardware controls.

### Native Wayland Session (Linux + Domicile)

Install Domicile: https://domicile-desktop.com/

```bash
# Run directly from TypeScript source
domicile ./desktop.tsx

# Hot-swap into a running Domicile session
domicile load-shell ./desktop.tsx

# Build standalone bundle
bun run build:shell
domicile ./dist/shell.js
```

### Debian Package (`.deb`)

Build a Debian binary package (`dist/piloti-desktop_<version>-1_all.deb`) from `data/files/` and `dist/shell.js`:

```bash
# Works on both Linux (uses dpkg-deb when available) and macOS (pure Node packager)
npm run build:deb

# Or build natively on Debian with debhelper
dpkg-buildpackage -us -uc -b

# Install on Debian / Ubuntu
sudo apt install ./dist/piloti-desktop_0.10.0-1_all.deb
```

This installs `/usr/bin/piloti`, `/usr/bin/piloti-session`, `/usr/bin/piloti-*` app commands, `/usr/share/wayland-sessions/piloti.desktop`, `/usr/share/applications/piloti-*.desktop`, `/usr/share/icons/Piloti/`, and `/usr/share/piloti-desktop/shell.js`.

### Tests, Typecheck & Build

```bash
bun test
bun run typecheck
bun run build
```

## Documentation

- [Guide](./docs/GUIDE.md) — where things are in the code and how to check changes (start here).
- [Architecture](./docs/ARCHITECTURE.md) — engines, shell, app modules and Domicile.
- [Linux](./docs/LINUX.md), [API](./docs/API.md), [Plugins](./docs/PLUGINS.md).
- More in `docs/`: native Linux notes, GNOME reuse, plugins, icons, app modules.

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Alt + Space` / `Meta + K` | Toggle Launcher (Search apps, windows, actions, URLs) |
| `Alt + Tab` / `Alt + Shift + Tab` | Cycle open windows with live thumbnails |
| `Meta + ↑` / `F3` | Toggle Overview |
| `Print` | Take interactive screenshot |
| `Meta + Return` | Launch terminal (`kitty`) |
| `Alt + ,` | Open System Settings |
| `Alt + N` | Toggle Control panel & Notifications |
| `Alt + [` / `Alt + ]` | Tile focused window left / right |
| `Alt + F` | Maximize / restore focused window |
| `Alt + M` | Minimize focused window |
| `Alt + W` | Close focused window |
