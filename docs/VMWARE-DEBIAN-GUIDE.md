# Running on Debian (VMware) with Domicile

Piloti develops in any browser (`bun run dev`) and runs natively under [Domicile](https://domicile-desktop.com/) on Debian Linux.

## Prerequisites on Debian

1. Enable **Accelerate 3D graphics** in VMware VM Settings → **Display**.
2. Install [Domicile](https://domicile-desktop.com/docs/install) and recommended desktop utilities:

```bash
sudo apt update
sudo apt install -y kitty firefox-esr nautilus pulseaudio-utils network-manager upower bluez
```

## Running & Hot-Reloading

```bash
bun install

# Option A: Run directly from TypeScript source
domicile ./desktop.tsx
domicile load-shell ./desktop.tsx

# Option B: Build and run standalone bundle
bun run build:shell
domicile ./dist/shell.js
bun run build:shell && domicile load-shell ./dist/shell.js
```

`domicile load-shell` hot-swaps the shell without closing running Wayland applications.
