# Agent guide — where things are, how to check them

Short map for coding agents, to start fast and avoid re-reading the tree.
Conventions are in `AGENTS.md`, commands in `CLAUDE.md`.

## Ground rules
- **Two themes.** Adwaita (`adwaita.css`) stays GNOME-faithful; Piloti
  (`piloti-macos.css`, every rule under `:root[data-interface-theme="piloti"]`)
  is old macOS Ventura: compact (controls ≤ 28 px), solid, no hover effects.
  Style per theme through `data-slot` hooks, never by editing shared classes.
- **Tokens, not values.** Text `text-adw-{body,callout,subheadline,footnote,
  caption,title-1..3,large-title,headline}`; radii `rounded-adw-{control,item,
  group,menu,popover,window}`; heights `h-/size-adw-control-{mini,small,medium,
  large}`; colours `--adw-*`. Hover effects use `hover-fill:` (Adwaita only),
  never `hover:` on controls. Check visually in the **Piloti demo** app.
- Wrap UI text in `_()`, add fr/es keys. No co-author trailer in commits.
- **One session, one worktree.** Several agent sessions run on this repo at
  once; never write in the main checkout unless you are told to. Start in your
  own worktree: `git worktree add .claude/worktrees/<name> -b <name> main`
  (`.claude/` is gitignored), run `npm ci` there (node_modules is not shared),
  and give the dev server its own port (`npm run dev -- --port <free port>`).
  Commit on your branch, then merge into `main` from the main checkout (or
  open a PR) when the user asks; remove the worktree afterwards
  (`git worktree remove`).
- **If you must use the main checkout:** commit with explicit paths
  (`git add <files>`), never `git add -A`, and read `git diff` first: other
  sessions' uncommitted edits are in the same tree.

## Map
| Area | Files |
|---|---|
| Window manager, window chrome | `components/shell/WindowManager.tsx`, `components/ui/window.tsx` |
| App windows registration | `data/catalog.ts` (`BuiltinAppId`, menus), `WindowManager.tsx` `WindowBody`, `context/WindowsContext.tsx` (`launchApp`, `builtinExecMap`) |
| Menu bar / app menus | `components/shell/MenuBar.tsx`, `components/shell/AppMenuItems.tsx` (catalog items + published state), `publishWindowMenuState` / `useWindowMenuState` (`lib/engine/app-bridge.ts`) |
| One popup at a time | `lib/shell/popup-layer.ts` (`usePopupSurface`; Base UI menu roots register automatically) |
| Floating windows (launcher, PiP) | `lib/shell/floating-window.ts` (margin 6, snap 28, rubber band), `lib/shell/pointer-drag.ts`, `components/shell/PresentationOverlay.tsx` |
| Window presentations (PiP, scaled) | `lib/shell/window-presentation.ts`; plugin API `ctx.windows.*` in `context/PluginsContext.tsx`, types `lib/plugins/types.ts` |
| Plugins (bundled) | `data/files/home/user/.config/piloti/plugins/*` |
| Icon grid (desktop + Folders) | `components/ui/icon-grid.tsx`, geometry `lib/shell/desktop-icons.ts` (`computeGridMetrics`, `moveItemsInSpatialGrid`), drag look `lib/shell/drag-feedback.ts` |
| Icons & accent tinting | `lib/xdg/xdg-icon-theme.ts`, `lib/shell/icon-accent-tint.ts`, `lib/shell/shell-icon-names.ts`, `Piloti/index.theme [X-Piloti Accent]`; details in `docs/_ICONS.md` (local) |
| Web pages / Web Browser | `WebViewSurface` + `BrowserTabsSurface` in `WindowManager.tsx`; `openWebUrl` / `launchApp("browser")` / tab groups (`browserTabGroups`, `openBrowserTab`) in `WindowsContext.tsx`. A tab is a Domicile browser window; a window is a group keyed by its first tab |
| Settings model | `context/SettingsContext.tsx` (INI-backed, `piloti-settings-ini.ts`) |
| Split view (sidebar apps) | `components/ui/adw-split-view.tsx` (title aligned to content via `data-slot="page-title"`) |

## Checking in the web demo (`npm run dev`)
- `window.__PILOTI__`: `windows.launchApp(id)`, `.list`, `.minimize/close/
  toggleMaximize(id)`, `settings.get()/update({...})`, `plugins.list`,
  `domicile.files.write(relPath, text)`.
- The demo VFS (localStorage) is seeded once: new bundled files (plugins…)
  don't appear in an existing profile. Copy them with
  `import('/data/files/…?raw')` + `domicile.files.write`.
- After changing `data/files/` run `node scripts/generate-piloti-icons.mjs`.
- Drag & drop: dispatch `PointerEvent`s (down on the element, move/up on
  `window`/`document`); automation key presses don't trigger editing commands
  (Ctrl/Cmd+A), test handlers with synthetic `KeyboardEvent`s.
- Measure alignment with a `Range` around text nodes, not element boxes.
- Unit tests: `~/.bun/bin/bun test tests/unit tests/functional`;
  icon coverage `tests/unit/icon-theme-coverage.test.ts`.
