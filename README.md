<p align="center">
  <img src="./docs/assets/piloti-icon.svg" alt="Piloti Desktop Icon" width="112" height="112" />
</p>

# Piloti Desktop

A fluid Linux Wayland desktop shell built on [Domicile](https://domicile-desktop.com/) combining **Apple Cupertino (Liquid Glass)** and **GNOME Adwaita (Libadwaita 1.6)** design systems.

---

## Features

- **Native Wayland Compositor Integration**: Renders real Linux Wayland apps inside `<app>` surfaces via Domicile with per-app geometry memory, edge snapping drop zones, and 8-edge resizing.
- **Dual Design Language**: Switch live between **Cupertino** and calibrated **GNOME Adwaita** (`#202024` / `#343437` surfaces, Adwaita accent colors, and native CSD support with no duplicate titlebars).
- **XDG Desktop & Icon Theme Spec**: Single-file [`xdg-desktop`](./src/lib/xdg-desktop.ts) module discovers installed `.desktop` applications and resolves real SVG/PNG icons across active icon themes (`Adwaita`, `hicolor`, `pixmaps`).
- **GNOME Stack & `gnome-control-center` Integration**: Two-way `GSettings` / `dconf` sync (`color-scheme`, `accent-color`, `clock-format`, `icon-theme`), PipeWire (`wpctl` / `pactl`), NetworkManager (`nmcli`), UPower, `power-profiles-daemon`, hardware Night Light (`setColorTemperature`), and `XDG_CURRENT_DESKTOP=GNOME` app launching.
- **Shell Chrome & Wayland Features**:
  - **Top Menu Bar** with workspace switcher, active capture controls, and DBusMenu system tray indicators
  - **Bottom Magnifying Dock** & **Right-Side Control Center / Notifications Panel**
  - **Command Palette (`Alt+Space`)** with unified menu material
  - **Task Switcher (`Alt+Tab`)** with live PNG window previews (`domicile.capture.preview`)
  - **Lock Screen (`domicile.session`)** & **XDG Portal Dialogs** (screenshots, screen casts, color picker, permissions)
  - **Zero-Offset `(0, 0)` SVG Cursors** for pixel-accurate clicks under Ozone/DRM & VMware `vmwgfx`

---

## Quick Start

### 1. Run in Browser (macOS / Linux Dev Harness)

```bash
bun install
bun run dev
```

Open `http://localhost:5173`.

### 2. Run on Linux under Domicile

```bash
# Run directly from TypeScript source
domicile ./desktop.tsx

# Hot-swap into a running Domicile session
domicile load-shell ./desktop.tsx

# Or build a standalone single-file bundle
bun run build:shell
domicile ./dist/shell.js
```

### 3. Tests & Typechecking

```bash
bun test
bun run typecheck
bun run build
```

---

## Documentation & Website

- **[Project Website (`docs/index.html`)](./docs/index.html)** (served directly when GitHub Pages is configured to `/docs`)
- **[Live Web Demo (`docs/demo/`)](./docs/demo/)** (built automatically on `bun run build` / `bun run build:web`)
- **[Documentation Index (`docs/README.md`)](./docs/README.md)**
- **[Architecture (`docs/architecture.md`)](./docs/architecture.md)**
- **[Components & Shortcuts (`docs/components-and-features.md`)](./docs/components-and-features.md)**
- **[Debian / VMware Guide (`docs/vmware-debian-guide.md`)](./docs/vmware-debian-guide.md)**

