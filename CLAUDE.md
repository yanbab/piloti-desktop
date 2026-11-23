# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Piloti Desktop: a Linux Wayland desktop shell (React 19 + Tailwind + Adwaita tokens + base-ui) on `@domicile-desktop/react`. One UI tree runs on two engines: native Domicile and a browser demo. `AGENTS.md` has the project conventions (read it); the essentials are repeated below.

## Commands

- `npm run dev` — browser demo at http://localhost:5173 (fake Domicile host, in-browser VFS). `window.__PILOTI__` exposes `windows`, `settings` for scripted/E2E checks.
- `npm run typecheck` (`tsc --noEmit`) and `npm test` (`bun test tests/unit tests/functional`) — run routinely. Bun may not be on PATH: use `~/.bun/bin/bun`.
- Single test: `~/.bun/bin/bun test tests/unit/xdg-mimeapps.test.ts` (add `-t "name"` to filter).
- `npm run test:e2e` (Playwright) and the Debian VM are long; only run when asked.
- `npm run build` (web → `docs/demo/`, shell → `dist/shell.js`), `build:greeter`, `build:deb` (→ `dist/piloti-desktop_<ver>-1_all.deb`).
- After changing anything under `data/files/` (icons, default tree): `node scripts/generate-piloti-icons.mjs`.
- Release flow: bump `package.json` + add a `debian/changelog` entry, `build:deb`, commit, tag `vX.Y.Z`, `gh release create` with the `.deb`. Stay on 0.10.x. Author is yanbab; no Claude co-author trailer; changelog signed ` -- yanbab <yanbab@gmail.com>  <date>`.
- `docs/index.html` is a separate landing page owned by someone else — don't edit it. `_docs/` is gitignored (local plans).

## Architecture

**Two engines, one UI.** `src/piloti-desktop.tsx` + `src/lib/engine-native/` is the Wayland session (Domicile APIs, `processes.run`, gsettings, D-Bus, inotify via `watchNativeDir`); `src/piloti-web.tsx` + `src/lib/engine-web/` is the browser build. `src/lib/engine/` holds engine-agnostic bridges (`fs-bridge.ts`, `app-bridge.ts`, `vfs-state.ts`). Components and contexts must go through these, never call Linux CLIs directly. Always check `isBrowserRuntime` when behaviour differs.

**Filesystem.** `web-vfs.ts` is an in-memory VFS (localStorage + IndexedDB blobs, debounced flush, cross-tab sync) used directly in the browser and as a cache on native. Native listings come from `domicile.files`, and mutating ops in `fs-bridge.ts` (`moveFsEntry`, `copyFsEntry`, `trashFsEntry`…) update the VFS and shell out (`mv`, `cp -a`, `gio trash`). Subscribe with `subscribeWebVfs(listener, watch)` using path filters (exact/children/subtree) to avoid wake-ups. Persistent shell state lives in VFS-backed `.ini` files (`vfs-state.ts`, `piloti-settings-ini.ts`), not raw localStorage keys (small per-viewer UI prefs like panel widths are the exception). `src/lib/engine/fs-undo.ts` is the shared undo/redo history for file operations; route Folders/Desktop file ops through its `*WithUndo` / `recordCreated` helpers.

**XDG layer** (`src/lib/xdg/`): mimeapps, `.desktop` entries, icon themes, trash, recents, thumbnails. `src/hooks/use-open-path.ts` + `src/lib/shell/open-file.ts` are the single "open a file/folder" path (mimeapps → installed apps → built-ins); Folders, Desktop and dock stacks all use it.

**Shell state & rendering.** Contexts in `src/context/` are split to avoid re-render storms: `useWindowManagerSelector`, `useChromeSettings`, stable `useWindowActions`; the window store is an external store (`window-manager-store.ts`). Big shell components (MenuBar, Dock, Launcher) are `React.memo` + `countRender`. Window/app wiring: `src/data/catalog.ts` defines apps, their menus and `actionId`s; menu clicks arrive as `piloti:app-action` events `{windowId, actionId}` and apps publish enabled/checked state with `publishWindowMenuState`. Typed shell events live in `src/lib/shell/shell-events.ts`. Apps in `src/components/apps/` (Folders = `FilesApp`, Notepad = `TextEditorApp`, etc.); `DesktopIconsApp` is the spatial desktop and shares `components/ui/icon-grid.tsx` with Folders.

**UI primitives.** `components/ui/` holds Adwaita-style widgets: `adw-split-view` (sidebar apps; resizable via `resizable-panel.tsx`), `icon-grid` (dnd-kit drag; the DragOverlay ghost is a DOM clone of the dragged items, and on the spatial desktop neighbours slide aside via `pushItemsToCells`), `Dock.tsx` (pinned reordering uses dnd-kit sortable with a springy shuffle), `grouped-form`, menus. Wrap UI text in `_()` and keep `src/locales/fr.json` / `es.json` updated.

**Performance rules.** Throttle/debounce rapid updates (drags, colour pickers, sliders) so VFS writes, `.desktop` scans and subprocesses don't run at frame rate. Verify no re-render regressions with the Console ▸ Infos ▸ Performance panel.

## Testing notes

Unit/functional tests are pure-TS (`bun test`). For UI verification, drive the dev server with Playwright (Chrome channel) from the project directory (`node --input-type=module < script.mjs` so `playwright` resolves). Dev-server module instances differ from the app's, so create test state through the UI/app actions, not by importing VFS modules in the page.
