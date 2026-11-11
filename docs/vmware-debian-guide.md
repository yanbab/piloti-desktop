# Testing & Running on Debian (VMware) with Domicile

Piloti is designed so you can develop rapidly on macOS in a browser and then test or run natively inside a **Debian Linux** virtual machine (VMware Fusion / Workstation) under [Domicile](https://domicile-desktop.com/).

---

## 1. Prerequisites on Debian

Inside your Debian VM:

1. **Enable 3D Acceleration in VMware**:
   - In VMware VM Settings → **Display**, enable **Accelerate 3D graphics** so Wayland clients and Chromium GPU compositing run smoothly.
2. **Install Domicile**:
   - Follow the official [Domicile installation guide](https://domicile-desktop.com/docs/install) for Debian / Nix.
3. **Install Recommended Desktop Utilities**:
   ```bash
   sudo apt update
   sudo apt install -y kitty firefox-esr nautilus pulseaudio-utils network-manager upower bluez
   ```

---

## 2. Running Piloti in Domicile

Clone or share this repository folder into your Debian VM.

### Option A: Direct TypeScript Execution (`domicile ./desktop.tsx`)

Domicile includes a built-in bundler that resolves `@domicile-desktop/*` and React automatically:

```bash
cd piloti-desktop
bun install # or npm install
domicile ./desktop.tsx
```

When you make edits to any file in `src/` or `desktop.tsx`, hot-swap the running shell in place without closing your open Wayland windows:

```bash
domicile load-shell ./desktop.tsx
```

### Option B: Pre-Bundled Single Module (`dist/shell.js`)

For production use or maximum startup speed, bundle the entire shell (including Tailwind CSS v4 and CupertinoUI styles inlined into the module) using `vite.shell.config.ts`:

```bash
bun run build:shell
domicile ./dist/shell.js
```

To reload after rebuilding:

```bash
bun run build:shell && domicile load-shell ./dist/shell.js
```

---

## 3. Verifying Wayland Integration in Debian

Once Piloti starts inside Debian:
1. **Launch a Native Terminal**: Press `Meta + Return` or open `Alt + Space` (`Command Palette`) and select **Kitty Terminal**.
2. **Verify Floating `<app>` Windows**: Drag the Kitty window by its CupertinoUI titlebar, resize its edges/corners, minimize it into the Dock with the yellow traffic light button, and restore it from the Dock.
3. **Verify `Alt + Tab`**: Open several Wayland apps (e.g., `kitty`, `firefox`, `nautilus`) alongside **System Settings**, then press `Alt + Tab` to switch between them.
4. **Verify Notifications**: Inside `kitty`, run:
   ```bash
   notify-send "Build Complete" "Piloti shell compiled in 420ms"
   ```
   Click the clock on the right side of the top Menubar to see the notification in the **Notifications & Quick Settings Panel**.
5. **Verify Theme Switching**: Open **System Settings → Appearance** (or toggle **Dark Mode** in the Quick Settings panel). Both the Piloti shell and GTK/Qt/Firefox client windows will transition between Dark and Light themes via `domicile.theme.set(...)`.

