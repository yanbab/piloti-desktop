# Project Habits & Conventions (`Piloti Desktop`)

Guidelines for LLM coding agents working in `residence-desktop-environment`.

## Architecture & Directory Layout

Piloti Desktop is a Linux Wayland desktop shell built on `@domicile-desktop/react` and React/Tailwind/Adwaita primitives, sharing one UI tree across two runtime engines:

- **`src/piloti-desktop.tsx`** + **`src/lib/engine-native/`**: Native Domicile Wayland session entry (`vite.shell.config.ts` -> `dist/shell.js`, plus `src/piloti-greeter.tsx` -> `dist/greeter.js`). Communicates with Linux subsystems via Domicile APIs (Wayland, GSettings, D-Bus menus, PipeWire/wpctl, nmcli, UPower, Flatpak, `xwayland-satellite`, `greetd`).
- **`src/piloti-web.tsx`** + **`src/lib/engine-web/`**: Browser dev/demo entry (`index.html` + `vite.config.ts` -> `docs/demo/`). Uses `createBrowserDomicile()`, in-browser `web-vfs.ts`, virtual icons, and serves static OS files from `/__fs/`.
- **`src/lib/engine/`**: Unified runtime selector & engine-agnostic bridges (`engine-override.ts`, `fs-bridge.ts`, `app-bridge.ts`, `vfs-state.ts`).
- **`src/lib/xdg/`**: FreeDesktop (`XDG`) specs implementation (basedir, `.desktop` parsing, icon themes, mimeapps, user-dirs, trash, autostart, recents XBEL, global app menus, session management, thumbnails, web app `.desktop` sync). Always keep XDG modules inside `src/lib/xdg/` (keep tsconfig/Vite path aliases `"xdg-basedir"`, `"xdg-desktop-entry"`, `"xdg-icon-theme"` updated if files move).
- **`src/lib/config/`**, **`src/lib/shell/`**, **`src/lib/plugins/`**, **`src/lib/core/`**: INI/storage config, shell domain logic (window bounds, desktop icons, launcher, notifications, sound, terminal), plugin loader, and core utilities (`utils.ts`, `i18n.ts`, `perf-log.ts`, `console-store.ts`, `system-info.ts`).
- **Engine isolation**: Keep UI components (`src/components/`) and contexts (`src/context/`) decoupled from direct Linux CLI/GNOME calls; go through `src/lib/engine-native/` vs `src/lib/engine-web/` and `src/lib/engine/`.

## Data Tree, State & Settings

- **Canonical filesystem (`data/files/`)**: Holds default `/home/user/...` starter files, `.desktop` entries, `/usr/bin/piloti*` launchers, and icon themes (`Piloti`, `Papirus`, `Adwaita`, `hicolor`).
  - Files outside `/home/user` are served directly as static assets in `engine:web` via `/__fs/` and indexed at `/__fs_tree.json`.
  - After changing files or icons under `data/files/`, regenerate virtual icons and tree index with:
    ```bash
    node scripts/generate-piloti-icons.mjs
    ```
- **VFS-backed `.ini` state**: Persist settings and shell state through VFS (`src/lib/engine/vfs-state.ts`, `src/lib/config/piloti-settings-ini.ts`, `src/lib/engine-web/web-vfs.ts`) using GSettings-style `.ini` files (e.g. `/home/user/.config/piloti/settings.ini`) rather than raw `localStorage` keys so files remain live-editable in Text Editor / Folders.
- **Performance on rapid controls**: Throttle/debounce rapid UI updates (color pickers via `useThrottledColor`, sliders, window drags) so VFS serialization, `.desktop` scans, and `gsettings` subprocesses do not run at 60-120Hz.

## UI, Apps & Iconography

- **Built-in App Names & Commands**:
  - **Folders** (`nautilus`, `piloti-files`)
  - **Desktop Settings** (`settings`, `piloti-settings`)
  - **Desktop Console** (`console`, `piloti-console`)
  - **Desktop Shell** (`terminal`, `piloti-shell`)
  - **Applications** (`app-store`, `piloti-applications`)
- **Icon Themes**: `Piloti` inherits `Papirus,Adwaita,hicolor`. Do not redraw standard app icons—use Papirus icons and keep Piloti's `animated/` Lottie assets focused on stateful interactive targets (`folder`, `folder-open`, `user-trash`, `user-trash-full`, `text-x-generic`, `application-x-zerosize`).
- **Window Frame & Dock**:
  - `Window` / `WindowTitlebar` (`src/components/ui/window.tsx`) defers pointer capture behind a drag movement threshold (`startPendingInteractiveDrag`) so single clicks and titlebar/headerbar double-clicks (maximize/unmaximize) always work in both CSD and SSD modes.
  - Dock icon sizes span **`18px` to `96px`**.
  - In `Folders` (`FilesApp.tsx`), the item count pill and icon-size slider float above the scrollable view, and the slider container has no background or border.
- **Localization**: Wrap UI text with `_()` (`src/lib/core/i18n.ts`) and keep `src/locales/fr.json` and `src/locales/es.json` updated alongside new strings.

## Testing & VM Workflow

- **Fast local checks (run routinely)**:
  ```bash
  npm run typecheck
  npm test
  ```
- **Long tests (E2E Playwright & VM checks)**: **Do NOT run `npm run test:e2e` or VM tests on every routine edit.** Run them only when explicitly requested or when validating end-to-end regressions (browser UI interactions, compositor integration).
- **Debian VM**: If VM access is needed and the VM is not running, start VMware with:
  `"/Users/yanbab/Virtual Machines.localized/Debian with Piloti"`
  (e.g., via `vmrun` or opening the `.vmwarevm` bundle at `/Users/yanbab/Virtual Machines.localized/Debian with Piloti`).

