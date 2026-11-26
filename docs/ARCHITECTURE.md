# Architecture

One React tree (shell and built-in apps) on two engines. Code map:
[GUIDE.md](./GUIDE.md) · Linux, Wayland, XDG: [LINUX.md](./LINUX.md) ·
API: [API.md](./API.md).

```
UI (React)  ─►  piloti: Domicile's desktop + vfs, settings, desktop…
                  ├─ native engine  →  Domicile, the disk, D-Bus, gsettings
                  └─ web engine     →  fake host, browser storage (demo)
```

## Engines

| | Native | Web (demo) |
|---|---|---|
| Entry | `src/piloti-desktop.tsx` | `src/piloti-web.tsx` |
| Code | `lib/engine-native/` | `lib/engine-web/` |
| Files | the disk | browser storage |
| System | D-Bus, gsettings, processes | simulated |

- Check capabilities (`realFilesystem`, `systemServices`, `simulatedHardware`),
  not the engine.
- The native bundle never imports the web engine or the demo files.
- On Linux: Domicile renders the shell, its compositor runs Wayland and
  portals, Piloti draws the desktop. A Wayland bug can sit in any of them.

## Data

| What | API | Stored in |
|---|---|---|
| Files | `piloti.vfs`; views use `useVfsList` / `useVfsText`… | the disk |
| Settings | schema + key (`defineSettings`, `useDesktopSettings`) | `~/.config/piloti/settings.ini`, `apps/<app>.ini` |
| Shell state | `engine/vfs-state.ts`, read synchronously | `~/.local/state/piloti/`, `~/.cache/piloti/` |

- **One cache** (TanStack Query) for file reads; one watch per path, shared.
  The shell's own file operations update open views at once.
- **Settings** are what the user chose; window bounds, history and caches are
  state.
- File operations users can undo go through `engine/fs-undo.ts`.

## Shell

- `DesktopStateProvider` nests settings, system backends, windows and apps.
  Components subscribe to slices, so a change re-renders only what uses it.
- Windows keep their DOM order and are hidden with CSS, so iframes don't reload.
- Bounds and workspace are saved per URL, document or app.
- New webview windows stay hidden until ready (2.5 s limit).

## App modules

Small utilities run in the shell. Heavier apps can run in their own document,
for crash and performance isolation (not a sandbox).

| Host | How |
|---|---|
| In shell (default) | a React component |
| Web, isolated | `IsolatedAppFrame` iframe, messages via `engine/app-bridge.ts` |
| Native, isolated | a Domicile app module in its own window |

Domicile app module:

- Exports `main` (`mount(Component)`); run with `domicile open --app /path/app.js`.
- Own origin and storage per directory; gets `files`, `processes`, `dbus` only.
  It talks to the shell through files or D-Bus.
- Shown in a `<webview>`; the shell draws its controls and drag strip
  (`data/app-modules.ts`).
- Built with `npm run build:apps` → `dist/apps/<id>/` (`hello`, `text-editor`).

Notepad talks to a `TextEditorHost` port (`engine/text-editor-host.ts`). View ▸
Open New Windows Separately sets `run-in=isolated`; without an installed module
it opens in the shell.

Learned in the VM: set `color-scheme: light dark` or the page stays white; no
`SharedArrayBuffer`; the window is 0×0 at first render; dark mode and accent
come from the Settings portal; the file to open is passed in
`~/.cache/piloti/text-editor-open`.

## Domicile

Chromium as the Wayland compositor; the desktop is a web page. A shell is a
module exporting `Shell`; each window is an `<app app-id>` element placed with
CSS. Piloti is one such shell.

```tsx
import { mount } from "@domicile-desktop/react/mount";
import { useWindows } from "@domicile-desktop/react/windows";

const Desktop = () => (
  <main>{useWindows().map((w) => <app app-id={w.appId} key={w.appId} />)}</main>
);
export const Shell = mount(Desktop);
```

- `domicile ./shell.tsx` runs it; `domicile load-shell` reloads in place and
  keeps windows. A shell that fails keeps the running one.
- React ignores `on…` props on `<app>`: put handlers on a wrapper.
- CSP is `script-src 'self' 'wasm-unsafe-eval'`: no `eval`, no inline scripts.
- Domicile 1.3 sends shell commands as `{ words, sent }` and waits for
  `shell.answer` (SDK 3).

Docs: [how it works](https://domicile-desktop.com/docs/how-it-works) ·
[writing shells](https://domicile-desktop.com/docs/shells/writing) ·
[system access](https://domicile-desktop.com/docs/shells/system-access) ·
[SDK](https://domicile-desktop.com/docs/reference/sdk) ·
[React](https://domicile-desktop.com/docs/reference/react) ·
[CLI](https://domicile-desktop.com/docs/reference/cli) ·
[release notes](https://domicile-desktop.com/docs/release-notes)
