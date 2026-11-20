<p align="center">
  <img src="./docs/assets/piloti-icon.svg" alt="Piloti Desktop Icon" width="112" height="112" />
</p>

# Piloti Desktop

An hybrid Web/Linux desktop shell built on [Domicile](https://domicile-desktop.com/), a Chromium based Wayland compositor.

It allows nice experiments when boundaries between web and native apps are not so important anymore.


## Features

### Shell
- Wayland window management
- Unified menu bar & system tray
- Application launcher
- Window overview & workspaces
- Dock & Trash
- Desktop icons
- Notifications & Control Panel
- Alt+Tab window switcher
- Lock screen & power actions
- GNOME Adwaita light/dark/high-contrast themes & wallpapers
- User CSS/JS plugins (`~/.config/piloti/plugins/`) & Chrome extensions in Web windows

### Apps
- Files (Web) (`metadata::emblems` & `mimeapps.list` XDG support)
- Web Terminal (pipes, redirects, history, `piloti` CLI)
- Notepad (Markdown & JSON preview, `.config/Piloti/notepad.ini` prefs)
- Calculator & Image Viewer
- App Store (Web & Flatpak)
- Desktop Settings
- DevTools (Console, Logs, State & VFS Inspector, Storage)

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

### Tests, Typecheck & Build

```bash
bun test
bun run typecheck
bun run build
```

## Documentation

- [Architecture & Shell API](./docs/ARCHITECTURE.md) — Runtime architecture, spatial window manager, VFS/DnD design, and Shell REPL API.
- [Roadmap](./docs/ROADMAP.md) — Milestones and actionable tasks across shell, apps, design system, and testing.

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
