# Piloti Desktop Documentation

Welcome to the documentation for **Piloti Desktop** — a Linux Wayland desktop shell built on [Domicile](https://domicile-desktop.com/), supporting both **Apple Cupertino** and **GNOME Adwaita** design systems.

---

## Documentation Index

- **[Landing Page (`./index.html`)](./index.html)** — Flathub & GNOME-inspired project website under `docs/` (ready for GitHub Pages).
- **[Architecture & Dual-Runtime Bridge (`./architecture.md`)](./architecture.md)** — Modular context providers (`SettingsContext`, `SystemBackendsContext`, `AppsContext`, `WindowsContext`), Domicile Wayland integration, and the Browser/macOS development harness.
- **[Components, Shortcuts & Features (`./components-and-features.md`)](./components-and-features.md)** — Walkthrough of the Top Menubar, DBusMenu Tray, Bottom Dock, CSD/SSD Window Manager, `Alt+Tab` Live Previews, `Alt+Space` Command Palette, Control Center, Portal Dialogs, Lock Screen, and System Settings.
- **[Debian / VMware Testing Guide (`./vmware-debian-guide.md`)](./vmware-debian-guide.md)** — Running, hot-reloading, and bundling Piloti inside Debian Linux with Domicile.
- **[Original Prompt (`./prompt.md`)](./prompt.md)** & **[Implementation Notes (`./implementation.md`)](./implementation.md)**.

---

## Quick Start

### 1. Run in Browser / macOS (Development Mode)

```bash
bun install
bun run dev
```

Open `http://localhost:5173` in your browser. System Settings opens automatically alongside simulated XDG `.desktop` apps and Adwaita SVG icons.

### 2. Run on Linux with Domicile

```bash
# Run directly from TypeScript source
domicile ./desktop.tsx

# Hot-swap into a running Domicile session without closing Wayland apps
domicile load-shell ./desktop.tsx

# Or build a standalone single-file shell bundle
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

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Alt + Space` (or `⌘ + K`) | Open **Command Palette** (XDG apps, windows, system actions) |
| `Alt + Tab` / `Alt + Shift + Tab` | Open **Task Switcher** with live Wayland window thumbnails |
| `Print` | Take interactive **Screenshot** (drag area, window, or full screen) |
| `Meta + Return` | Launch **Terminal** (`kitty`) |
| `Alt + ,` | Open **System Settings** (or `gnome-control-center` when enabled) |
| `Alt + N` | Toggle right-side **Quick Settings & Notifications Panel** |
| `Alt + [` / `Alt + ]` | Tile focused window to Left Half / Right Half of screen |
| `Alt + F` | Toggle Zoom / Maximize on focused window |
| `Alt + M` | Minimize focused window into the Dock |
| `Alt + W` | Close focused window |
