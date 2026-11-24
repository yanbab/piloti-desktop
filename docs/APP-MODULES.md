# Middle-ground app architecture: shell utilities in-shell, heavy apps in their own document

Status: proposal, revised after reading Domicile's `APP-MODULES.md` and the "Build an app" page (docs/apps/build). Nothing here is implemented beyond what section 1 describes.

## 1. Where we are today

- The shell (`piloti-desktop.tsx` native, `piloti-web.tsx` browser) renders everything in one React tree: panels, dock, launcher, and every built-in app. One JS context, one crash domain, one main thread.
- Web only: `IsolatedAppFrame.tsx` loads the same page with `?piloti_app=<id>&windowId=...` in an iframe; `piloti-web.tsx` mounts one app (calculator, text-editor, image-viewer) for that param. Messages go through `lib/engine/app-bridge.ts`.
- Native: `shell.js` is a single bundle (`vite.shell.config.ts`, `inlineDynamicImports`, CSS injected into the module). Domicile `<webview>` is used only for third-party sites (WebViewSurface in `WindowManager`).

## 2. What Domicile actually offers (from the docs)

Two kinds of non-shell app:

1. **Web app**: a site in an app window (`domicile open --app <url>`, `domicile install-app <url>`). It shares the browser profile. This is what Piloti uses for third-party sites. Not suitable for our own apps (they need files/processes and our code).
2. **App module**: a JS module whose `main(root, domicile)` Domicile calls, exactly like a shell's `Shell(root, domicile)`. This is the native mechanism for our heavy apps. Facts that shape the design:
   - Launch: `domicile open --app /path/to/entry.js`. The engine serves the module's directory at `domicile://app-<id>/` and opens a **new app window** (a real window, not content inside our shell's DOM). Domicile's own Settings and History are built this way.
   - Build: bundle like the shell. Vite with `base: "./"`, `preserveEntrySignatures: "exports-only"`, one entry, `entryFileNames: "<name>.js"`. React helper: `mount(Component)` from `@domicile-desktop/react/mount`; `useAppDomicile()` inside React. Build then open; no dev server or HMR is documented.
   - Isolation: each app root gets its own origin (hash of the directory path), so `localStorage`/IndexedDB/cookies are per app directory. Every file under the root is served, nothing outside it. Pages are cross-origin isolated (`SharedArrayBuffer` works). Domicile sets no CSP. This is a separate document (own JS realm); whether it is a separate OS process is still not stated, but it is a separate guest page.
   - API: `AppDomicile` has only `files` (read/write/create_dir/read_dir/stat/watch), `processes` (spawn, stdin, kill) and `dbus` (call, match). Relative paths start at home. Calls return `Result`. The compositor refuses everything else (`permission_denied`): windows, focus, input, lock, theme, screenshot, shell commands. **Apps receive no desktop events** and cannot control windows. `prefers-color-scheme` and `prefers-reduced-motion` follow the desktop automatically.
   - Trust: apps are trusted like native programs (files, processes, D-Bus, may load remote code). Their processes, watches and matches end when the document closes.
   - Multiple windows of one app share an origin and coordinate through `BroadcastChannel`/Web Locks. Nothing is said about app-to-shell messaging.
   - Shipping: a directory plus a `.desktop` entry with `Exec=domicile open --app /usr/share/<app>/<app>.js`. This matches what we already ship in `data/files/usr/share/applications` and `usr/bin/piloti-*`.

Consequence: the native isolated host is **not** an iframe or postMessage bridge to the shell. It is a separate window with a narrow capability set (files, processes, dbus). So the shell and the app can only talk through the filesystem and D-Bus. That changes the bridge design below.

## 3. Goal and split

Keep light, tightly coupled shell utilities in the shell: menubar, dock, launcher, overview, control panel, notifications, window manager, desktop icons, portal dialogs, Settings, and for now Files (it shares drag and drop with the desktop). Candidates to isolate: Image Viewer, Text Editor, Camera, Calculator, Console, App Store, future media/visualisation apps. Rule: an app can leave when it needs only files, settings, theme, a title and a menu from the shell.

Gains: crash and hang containment, a separate main thread, lazy loading of heavy dependencies, a real permission boundary (a camera stream held in an app document is invisible to the shell).

## 4. Core idea: one app component, three hosts

Layers:

1. **App component** (`src/components/apps/FooApp.tsx`): UI only, props `{windowId, isCsd, initialPath}`. It reaches the outside only through a typed `HostApi` (section 5), never through shell contexts directly.
2. **Hosts** implement `HostApi`:
   - **In-shell host**: backed directly by the existing contexts. Today's behaviour.
   - **Iframe host (web build)**: postMessage RPC to the shell (what `useIsolatedAppBridge` does now).
   - **App-module host (native)**: implemented on `AppDomicile` (`files`, `dbus`, `processes`) with no shell hop for file access.
3. **Entries**: one tiny file per app. Web: an HTML page per app. Native: an `AppMain` via `mount(FooApp)` wrapped in the app-module host provider.

Catalog gets `runIn: "shell" | "isolated"`; `WindowManager` picks in-shell component, `IsolatedAppFrame` (web) or "launch app module window" (native) from it, so an app can be flipped back for debugging.

## 5. HostApi: what apps need, and how each travels natively

Because natively the app has only files/dbus/processes, each capability needs a concrete channel. Proposed, simplest first:

| Need | Native channel (app module) | Web channel (iframe) |
|---|---|---|
| Files (list/read/write/watch/trash) | `domicile.files` directly (shell not involved). Reuse `engine-native` fs code under `fs-bridge`, minus the shell VFS cache. | postMessage fs RPC to shell VFS |
| Settings, theme, accent, fonts, locale | Read and `watch` the shell's VFS-backed `.ini` files (`piloti-settings-ini.ts`). They are real files natively, so this is natural and needs no new protocol. Dark/light also comes free via `prefers-color-scheme`. | `piloti:theme-sync` message |
| App menu state, headerbar actions, title | Shell and app agree on a small D-Bus service (e.g. `org.piloti.Shell`, per-window methods and signals), or a spool dir in `$XDG_RUNTIME_DIR/piloti/<windowId>/` watched by both. D-Bus preferred (events, request/response). | existing `publishWindowMenuState`/`app-action` messages |
| Window close/minimize/maximize/geometry | Not allowed for apps (compositor refuses). Must be shell/compositor driven; app only draws content. See 8. | messages |
| Open file/URL/other app | `processes.spawn` of `xdg-open` / `piloti-*` command, or D-Bus call to the shell | message |
| Notifications | D-Bus `org.freedesktop.Notifications` directly | message |
| Capture activity (camera/mic dots) | App's tracking (the same `installCaptureTracking()`) writes `camera|mic|none` to the per-window state (D-Bus signal or file); the shell merges. | message |
| Clipboard / drag-drop | Web APIs inside the app window; cross-window DnD is limited (see 9) | messages |

Keep `HostApi` request/response plus events, JSON-serialisable, versioned. Define the TypeScript interface once (`src/lib/engine/host-api.ts`); the message schemas and the D-Bus method list are generated or checked against it so they cannot drift.

## 6. Build: sharing code, compiling differently

One repo, shared source, three kinds of output:

- `vite.base.ts`: common aliases (`@`, xdg aliases currently duplicated in `vite.config.ts` and `vite.shell.config.ts`), React plugin, Tailwind, `cssInTheModule`.
- **Shell** (unchanged): `src/piloti-desktop.tsx` to `dist/shell.js`, `src/piloti-web.tsx` to `docs/demo/`.
- **Native app modules**: a script `scripts/build-apps.mjs` loops over an app list and runs Vite once per app: input `src/apps/<id>/main.tsx` (`export const main = mount(...)`), output `dist/apps/<id>/<id>.js` with `base: "./"`, `preserveEntrySignatures: "exports-only"`, `inlineDynamicImports: true`, CSS injected into the module (Domicile writes the document; no stylesheet link). One directory per app means separate origins and storage per app for free. Package each directory under `/usr/share/piloti-desktop/apps/<id>/` in the `.deb` via `build-deb.mjs`, and point the `.desktop` `Exec=domicile open --app .../<id>.js` (today `piloti-<id>` scripts in `data/files/usr/bin` can just wrap that).
- **Web iframe apps**: Vite multi-page build, one `apps/<id>/index.html` per app, shared chunks split automatically so React and the UI kit are cached across apps. Replaces the `?piloti_app=` branches in `piloti-web.tsx`.
- Each app directory is its own JS realm, so React and the UI kit are duplicated per native app (an estimated 150-300 KB each; not measured). Acceptable; keep isolated apps free of shell contexts and lazy-load heavy libs. Do not try to share a React instance across realms.
- `isBrowserRuntime` and engine branching stay behind `fs-bridge.ts`; the app document must not create its own `web-vfs` (current isolated apps import it in `app-bridge.ts`, which creates a second in-memory VFS; remove that).
- Dev loop gap: app modules are build-then-open with no HMR. For daily development, run the same component in-shell or as an iframe under `npm run dev` (Vite HMR), and only use the app-module build to verify the native host. That is a good reason to keep all three hosts.

## 7. State ownership

- Shell owns window list, app registry, notifications, and (web) the VFS. Native, the real filesystem is the source of truth for both sides, and `files.watch` keeps them in sync.
- App documents own private UI state and open-document state only. Persistent app state goes through `files.write` into the same `.ini`/state files the shell uses, never into the app's localStorage (different origin per app directory, and not visible to the shell).
- Several windows of one isolated app share an origin and can use `BroadcastChannel` among themselves (Notepad tabs, etc.).

## 8. Window chrome and window management (needs a spike)

**Confirmed from the local Domicile docs (`docs/SHELL-BROWSER-WINDOWS.md`, `BUILD-AN-APP.md`): an app window is a browser window.** `domicile open --app` and `browser.openApp(url, {id, reuse})` list the window in `domicile.browser.windows` with `isApp: true` and `appId`, and the shell draws it as `<webview window="id">`, exactly like our existing web-app windows (`WebViewSurface`). So an isolated app module is a `<webview>` in our shell, and `WindowsContext` already syncs these (`browserWindows`, `appId`). It is not an `<app>` (Wayland surface) element.

Apps cannot move, close or maximize their windows; our window manager frames the `<webview>`, so drag, snap, close and minimize come from the shell exactly as for web-app windows.

Open questions for a spike (Image Viewer first):

1. Does the shell draw the titlebar around external app windows (like webview windows), or is the app expected to draw its own CSD? Recommendation: shell-drawn titlebar, with the app supplying title, menu items and headerbar buttons through the D-Bus/state channel in section 5. If that proves too heavy, keep CSD inside the app window and make the shell frame chromeless; mixing the two is what makes windows feel inconsistent.
2. How the shell maps an `app-<id>` window to our `windowId` (launch args or window title/app-id convention).
3. Launch-origin animation and snap for webview windows (already supported for our web apps).
4. Is each app window a separate OS process? (Not stated in the docs.)

## 9. Hard parts

- **Drag and drop across windows**: dragging from Files to an isolated app (or app to desktop/dock) crosses Wayland windows. Browser DnD does not work across them. Use file paths via the shell: shell resolves the target window and tells the app (D-Bus `OpenPath`/`Drop`); keep existing `residence:file-drag` broadcast for in-shell targets. Web iframes: keep `pointer-events: none` on frames during drags (already done for webviews).
- **Global shortcuts and focus**: a focused app window keeps keyboard focus; Alt+Space, Super and window switching must be handled by the compositor/shell, not by apps (apps get no desktop events). Check the keybinding layer covers external windows.
- **Capture dots**: handled by section 5 (apps report). The dots remain correct for in-shell apps because they share the realm.
- **Startup latency**: a new document and window costs time. Show the shell frame/launch animation at once, preload pinned apps when idle, and keep tiny apps (Calculator) in-shell if the cost is not worth it.
- **Security**: apps are trusted like native programs, so do not treat isolation as a sandbox for untrusted code; it is crash/perf isolation plus per-app storage. The D-Bus service must check the caller's window id.
- **Testing**: unit tests stay pure TS. Add a `HostApi` contract test run against the in-shell host and a fake remote host. Playwright can cover the iframe host on the demo; native app modules need the Debian VM.

## 10. Migration plan

1. Extract `HostApi` and the in-shell host; port Calculator, Image Viewer and Text Editor to it (no behaviour change). Remove direct `web-vfs` imports from `app-bridge.ts`.
2. Add `vite.base.ts`, per-app entries, and the web multi-page build; remove the `piloti_app` branches in `piloti-web.tsx`.
3. Add `runIn` to the catalog; make `WindowManager` choose the host.
4. Native spike with Image Viewer: `scripts/build-apps.mjs`, `mount()` entry, `.desktop` `Exec=domicile open --app`, files via `domicile.files`, settings via watched `.ini`. Answer the section 8 questions before going wider.
5. Design the shell/app D-Bus (or spool) channel: title, menu, actions, capture state, open-path.
6. Move Camera, then Console and App Store; harden drag-drop and shortcuts.

## 11. Summary

Make each heavy app an engine- and host-agnostic component behind a typed `HostApi`. Natively, ship it as a Domicile app module (own directory, own origin, own window; Vite build per app, `mount()` entry, `domicile open --app` in the `.desktop`), using `domicile.files` and the shared `.ini` files for data and settings, and a small D-Bus channel for title/menu/capture state. On web, run the same component in an iframe with the existing postMessage bridge. Keep the shell as owner of windows, chrome and notifications, and keep the in-shell host as the dev and fallback path. The main unknowns are window chrome for app-module windows and the shell/app channel, so spike those with Image Viewer before committing to the rest.

## 12. Spike results (v0.10.6 in the Debian VM, 2026-11-23)

Ran `domicile open --app /usr/share/piloti-desktop/apps/hello/hello.js` against the live session (needs `DOMICILE_SOCK=/run/user/1000/domicile-ipc.<pid>.sock`).

- It works. Window opens as a `<webview>` browser window; origin is `domicile://app-<hash>` (per-directory, as documented); `localStorage` persists; `files.readDir` and `files.write` work (report written to `~/`); no `piloti`/`domicile` globals leak into the page.
- `prefers-color-scheme` follows the desktop (dark), but the page background stays white unless the app sets `color-scheme: light dark`. Every entry must do that (or apply our theme tokens at load).
- `crossOriginIsolated` was false here, despite the docs; do not rely on `SharedArrayBuffer` yet.
- Our shell framed it with the **browser-window chrome** (back button, URL "domicile://app-…", shield/extension icons, window controls), and the menubar app name shows the raw URL. So app-module windows currently take the generic webview path in `WindowsContext`/`WindowManager`. To integrate them we must detect `isApp` + `appId` and (a) hide the address bar, (b) use the catalog title/icon, (c) map `appId` to a catalog entry. This confirms the "shell draws the chrome" model in section 8 is needed.
- The settings file is `~/.config/piloti/settings.ini` (not `piloti.ini`); apps can read it with `files` for theme sync (my first probe used a wrong name).
- Window size read 0x0 at first render; apps must wait for layout/resize before measuring.

## 13. Text Editor as an app module (2026-11-23, VM)

- `TextEditorApp` now talks to a `TextEditorHost` port (`src/lib/engine/text-editor-host.ts`). Shell hosts: `text-editor-host-shell.tsx` (`ShellTextEditorApp`). Module host: `src/apps/text-editor/host.ts` on `domicile.files` (path map `/home/user/x` -> home-relative `x`; state, prefs and the opened file preloaded before mount; rename and metadata are no-ops for now).
- Entry `src/apps/text-editor/main.tsx`; built by `npm run build:apps` to `dist/apps/text-editor/text-editor.js` (CSS injected into the module, 1.5 MB: pulls in catalog via app-bridge, trim later). Theme from `settings.ini` (`org.piloti.desktop.interface`). File to open is handed over via `~/.cache/piloti/text-editor-open` until module launch arguments exist.
- Verified in the VM: opens `~/spike-note.txt`, shows its content and name, own header (save, prefs), dark theme. Not yet verified: editing and saving, drag strip, close.
- Shell side: `src/data/app-modules.ts` recognises our modules by `domicile://app-<sha256(dir)[:32]>`; `AppModuleSurface` gives CSD modules a bare webview plus shell-drawn window controls and a declarative drag strip (no per-pixel `-webkit-app-region`; there is no page->shell message channel in the webview element).

## 14. D-Bus from an app module (VM, 2026-11-24)

`dbus.call` on the session bus works from a module: `org.freedesktop.portal.Settings.Read("org.freedesktop.appearance", "color-scheme")` returned `1` (prefer dark) and `accent-color` returned `(-1,-1,-1)` (unset). So modules can follow dark/light and accent through the standard Settings portal (and `dbus.match` for `SettingChanged`), instead of watching `settings.ini`. Not yet tried: `dbus.match`, FileChooser, Notification, OpenURI portals.
