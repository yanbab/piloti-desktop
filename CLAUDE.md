# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Piloti Desktop: a Linux Wayland desktop shell (React 19 + Tailwind + Adwaita tokens + base-ui) on `@domicile-desktop/react`. One UI tree runs on two engines: native Domicile and a browser demo. `AGENTS.md` has the project conventions (read it); the essentials are repeated below.

**Start with `docs/GUIDE.md`**: map of the code, theme/token rules and how to check changes in the demo.

## Commands

- `npm run dev` — browser demo at http://localhost:5173 (fake Domicile host, in-browser VFS). `window.piloti` exposes `desktop` (the shell's windows), `settings` and all of Domicile's desktop for scripted/E2E checks.
- `npm run typecheck` (`tsc --noEmit`) and `npm test` (`bun test tests/unit tests/functional`) — run routinely. Bun may not be on PATH: use `~/.bun/bin/bun`.
- Single test: `~/.bun/bin/bun test tests/unit/xdg-mimeapps.test.ts` (add `-t "name"` to filter).
- `npm run test:e2e` (Playwright) and the Debian VM are long; only run when asked.
- `npm run build` (web → `docs/demo/`, shell → `dist/shell.js`), `build:greeter`, `build:deb` (→ `dist/piloti-desktop_<ver>-1_all.deb`). Inside the Linux VM use `scripts/vm-build.sh` instead: the shared folder's `node_modules` are macOS ones.
- After changing anything under `data/files/` (icons, default tree): `node scripts/generate-piloti-icons.mjs`.
- After changing the desktop settings table (`lib/config/piloti-settings-ini.ts`) or its defaults: `~/.bun/bin/bun scripts/generate-gschemas.ts` (the GSettings schema; a test checks it).
- Release flow: bump `package.json` + add a `debian/changelog` entry, `build:deb`, commit, tag `vX.Y.Z`, `gh release create` with the `.deb`. Stay on 0.10.x. Author is yanbab; no Claude co-author trailer; changelog signed ` -- yanbab <yanbab@gmail.com>  <date>`.
- `_docs/` (gitignored, local) holds project management only: `TODO.md` (with checkboxes), `ROADMAP.md`, `NOTES.md` (ideas). Reference docs live in `docs/`.

## Architecture

**Two engines, one UI.** `src/piloti-desktop.tsx` + `src/lib/engine-native/` is the Wayland session (Domicile APIs, `processes.run`, gsettings, D-Bus, files and inotify via `piloti.vfs`); `src/piloti-web.tsx` + `src/lib/engine-web/` is the browser build. `src/lib/engine/` holds engine-agnostic bridges (`fs-bridge.ts`, `app-bridge.ts`, `vfs-state.ts`). Components and contexts must go through these, never call Linux CLIs directly. Code receives Domicile's desktop as `piloti: Piloti` (`usePiloti()` in components, `engine/piloti.ts`), not `domicile`. Files are reached with `piloti.vfs` (`ports/vfs.ts`, async; `engine-native/vfs.ts` and `engine-web/vfs.ts`). Domicile's own calls, where something needs them, go through `hostFiles(piloti)` (`engine/host-files.ts`), never `piloti.files` (a unit test checks). Each entry point calls `setEngine()` (`src/lib/engine/engine.ts`: `Engine` + capability flags `realFilesystem`/`systemServices`/`simulatedHardware`); prefer a capability over `isBrowserRuntime`/`isWebEngine()` when behaviour differs. The native bundle must not import the web engine or the demo VFS seed (`piloti-web.tsx` injects it with `setVfsSeed`). On native the disk is the only copy of files: no mirror. system features use Domicile's `@domicile-desktop/system-*` libraries and GNOME/freedesktop services (see `docs/LINUX.md`). `scripts/vm-dev.sh` is the no-.deb edit loop inside the Linux VM.

**Filesystem.** `piloti.vfs` is the one file API: async, rejects on failure, writes through symlinks. `vfs.watch(path, onChange)` calls once when in place (load there) and then on changes; on Linux it watches folders only (not recursive), shared and capped because inotify instances are scarce. `fs-bridge.ts` adds naming policy and listings for Folders/Desktop. `web-vfs.ts` (localStorage + IndexedDB) is the demo's storage; new code must not import it (a test holds the list of old users, which may only shrink). Piloti's own config and state files are the exception held in memory: read synchronously through `vfs-state.ts` (`.ini` files, `piloti-settings-ini.ts`), backed on Linux by `engine-native/state-store.ts`, which follows the disk; no raw localStorage keys (small per-viewer UI prefs are the exception). `src/lib/engine/fs-undo.ts` is the shared undo/redo history for file operations; route Folders/Desktop file ops through its `*WithUndo` / `recordCreated` helpers. No VFS module may load before the native entry knows `$HOME` (tests check). Plan and measurements: `_docs/PLAN-VFS.md`.

**XDG layer** (`src/lib/xdg/`): mimeapps, `.desktop` entries, icon themes, trash, recents, thumbnails. `src/hooks/use-open-path.ts` + `src/lib/shell/open-file.ts` are the single "open a file/folder" path (mimeapps → installed apps → built-ins); Folders, Desktop and dock stacks all use it.

**Shell state & rendering.** Contexts in `src/context/` are split to avoid re-render storms: `useWindowManagerSelector`, `useDesktopSettings([...])` (components ask for the settings they read), stable `useWindowActions`; the window store is an external store (`window-manager-store.ts`). Big shell components (MenuBar, Dock, Launcher) are `React.memo` + `countRender`. Window/app wiring: built-in apps are described by `data/files/usr/share/applications/piloti-*.desktop` (`X-Piloti-*` keys: id, component, size, pin, order…), read at start by `engine/app-catalog.ts`; `src/data/catalog.ts` holds their menus and `actionId`s; menu clicks arrive as `piloti:app-action` events `{windowId, actionId}` and apps publish enabled/checked state with `publishWindowMenuState`. Typed shell events live in `src/lib/shell/shell-events.ts`. Apps in `src/components/apps/` (Folders = `FilesApp`, Notepad = `TextEditorApp`, etc.); `DesktopIconsApp` is the spatial desktop and shares `components/ui/icon-grid.tsx` with Folders.

**UI primitives.** `components/ui/` holds Adwaita-style widgets: `adw-split-view` (sidebar apps; resizable via `resizable-panel.tsx`), `icon-grid` (dnd-kit drag; the DragOverlay ghost is a DOM clone of the dragged items, and on the spatial desktop neighbours slide aside via `pushItemsToCells`), `Dock.tsx` (pinned reordering uses dnd-kit sortable with a springy shuffle), `grouped-form`, menus. Wrap UI text in `_()` and keep `src/locales/fr.json` / `es.json` updated.

**Drag and drop.** Two kinds, one feel. Items (icons, dock tiles, lists, grids) use dnd-kit; moving or resizing surfaces (launcher, floating presentations, split handles) use plain pointer events via `startPointerDrag` (`src/lib/shell/pointer-drag.ts`: threshold, listeners, pointercancel, cleanup) and the geometry in `floating-window.ts`. Every easing, duration, threshold and ghost lift comes from `src/lib/shell/drag-feedback.ts` (`liftGhost`, `settleFromOffset`, `settleSurface`, `dragShuffleCss`…); don't hard-code new curves. A drop never animates back to its start before reaching its new place: the ghost flies back only when nothing moved, and surfaces must not reset `translate` to measure themselves.

**Performance rules.** Throttle/debounce rapid updates (drags, colour pickers, sliders) so VFS writes, `.desktop` scans and subprocesses don't run at frame rate. Verify no re-render regressions with the Console ▸ Infos ▸ Performance panel.

## Testing notes

Unit/functional tests are pure-TS (`bun test`). For UI verification, drive the dev server with Playwright (Chrome channel) from the project directory (`node --input-type=module < script.mjs` so `playwright` resolves). Dev-server module instances differ from the app's, so create test state through the UI/app actions, not by importing VFS modules in the page.
