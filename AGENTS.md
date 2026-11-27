# AGENTS.md

Instructions for coding agents. This is the only copy: `CLAUDE.md` imports it.

Piloti Desktop: a Linux Wayland desktop shell (React 19, Tailwind, Adwaita
tokens, base-ui) on `@domicile-desktop/react`. One UI tree runs on two engines:
native Domicile and a browser demo.

## Read first

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md): engines, files, state, windows.
  Read it before changing code.
- [docs/GUIDE.md](./docs/GUIDE.md): code map, themes and tokens, checks in the demo, icons.
- [docs/LINUX.md](./docs/LINUX.md), [docs/API.md](./docs/API.md), [docs/PLUGINS.md](./docs/PLUGINS.md).

## Commands

Bun may not be on PATH: use `~/.bun/bin/bun`.

- `npm run dev`: browser demo on http://localhost:5173. `window.piloti` drives it.
- `npm run typecheck` and `npm test`: run routinely. One test:
  `bun test tests/unit/xdg-mimeapps.test.ts` (`-t "name"` to filter).
- `npm run lint`: React hooks rules, warnings only; add none.
- `npm run test:e2e` and the VM are long: only when asked.
- `npm run build` (web → `docs/demo/`, shell → `dist/shell.js`), `build:greeter`,
  `build:apps`, `build:deb` (→ `dist/piloti-desktop_<ver>-1_all.deb`).

After changing:

- `data/files/` (icons, default tree): `node scripts/generate-piloti-icons.mjs`.
- the settings table (`lib/config/piloti-settings-ini.ts`) or its defaults:
  `bun scripts/generate-gschemas.ts` (a test checks).
- the shell API: update `docs/API.md`.

## Code rules

- **Engines.** Components and contexts go through `lib/engine/`. Never call Linux
  CLIs or `piloti.processes` directly: add a function to
  `engine/system-commands.ts`. Prefer a capability (`realFilesystem`,
  `systemServices`, `simulatedHardware`) over checking the engine. The native
  bundle imports neither the web engine nor the demo files.
- **Layout.** A helper only one app or shell feature uses stays in its folder
  (`apps/<app>/`, `shell/<feature>/`); shared logic goes in `lib/<topic>/`,
  shared UI in `components/`.
- **Domicile** is received as `piloti: Piloti` (`usePiloti()`), not `domicile`.
- **Files:** `piloti.vfs`. Domicile's own file calls go through
  `hostFiles(piloti)`, never `piloti.files`. Don't import `web-vfs.ts` in new code.
- Tests hold lists of old importers (`engine-native`, `web-vfs`): they may only
  shrink.
- No VFS module may load before the native entry knows `$HOME`.
- **State** goes in `.ini` files through `vfs-state.ts`, so they stay editable;
  no raw `localStorage` keys (small per-viewer UI prefs excepted).
- File operations in Folders and Desktop use `engine/fs-undo.ts`
  (`*WithUndo`, `recordCreated`).
- Opening a file or folder: `hooks/use-open-path.ts` and `lib/files/open-file.ts`.
- XDG code stays in `lib/xdg/` (keep the tsconfig and Vite aliases up to date).
- **Drag and drop:** dnd-kit for items; `startPointerDrag`
  (`lib/dnd/pointer-drag.ts`) to move or resize surfaces. Timings, curves,
  threshold and ghost lift come from `lib/dnd/drag-feedback.ts`. A drop never
  animates back to its start first.
- **Performance:** throttle or debounce drags, colour pickers and sliders so VFS
  writes, `.desktop` scans and subprocesses don't run at frame rate. Check
  re-renders in Console ▸ Infos ▸ Performance.
- **Text:** wrap in `_()` (`lib/core/i18n.ts`) and update `src/locales/fr.json`
  and `es.json`.
- **Icons:** don't redraw app icons, use Papirus. Piloti's animated Lottie icons
  are only for stateful targets (folders, trash).

Paths without a root are under `src/`.

## Workflow

- Commit or push only when asked. No co-author trailer.
- One session, one worktree, unless told to use the main checkout:
  `git worktree add .claude/worktrees/<name> -b <name> main`, `npm ci`,
  `npm run dev -- --port <free>`. Merge or open a PR when asked, then
  `git worktree remove`.
- In the main checkout, others may be editing: read `git diff` first, commit
  explicit paths, never `git add -A`.
- `_docs/` (local, not in git): `ROADMAP.md` (scheduled work), `BACKLOG.md`
  (unscheduled, by area), `DONE.md`, `NOTES.md` (ideas, measurements).

## Testing

- Unit and functional tests are pure TypeScript.
- UI checks: see "Checking in the demo" in the guide. Playwright (Chrome channel)
  runs from the project folder: `node --input-type=module < script.mjs`.
- Dev-server module instances differ from the app's: create test state through
  the UI or app actions, not by importing VFS modules in the page.

## Linux VM

- VM: `/Users/yanbab/Virtual Machines.localized/Debian with Piloti` (VMware).
- Build there with `scripts/vm-build.sh` (the shared `node_modules` are macOS
  ones). `scripts/vm-dev.sh` is the edit loop without a `.deb`.

## Release

Bump `package.json`, add a `debian/changelog` entry signed
` -- yanbab <yanbab@gmail.com>  <date>`, `build:deb`, commit, tag `vX.Y.Z`,
`gh release create` with the `.deb`. Author is yanbab.

Update `CHANGELOG.md` in the release commit (latest first): version, date,
release notes, and the commits since the last tag
(``git log --no-merges --format='- `%h` %s' vPREV..HEAD``).
