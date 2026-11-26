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

## Piloti geometry (radii and margins)

Corners are concentric: an outer radius = the inner radius + the gap between
them. All in `piloti-macos.css`, computed from tokens, not hard-coded:

- **Items** (menu items, sidebar items, list rows): `--adw-radius-item` (5px).
- **Menus**: `--adw-radius-menu` = item radius + the 5px menu padding (10px).
  Items: 22px rows, 13px text, 9px side padding; a 20px check column only in
  menus with check or radio items. Highlight = accent, white text (same as
  the sidebar selection).
- **Control panel**: modules and pills use the menu radius; the panel is
  menu radius + its 12px padding. Its list rows are menu items.
- **Dock**: square app icons take 56 of their 64 pixels (4px margin, 4.2px
  corners). The dock has 7px around its tiles (6px + the 1px border on the
  sides), so the gap around the first square icon is `7px + size × 4/64`, and
  the dock corner = icon corner (`size × 4.2/64`) + that gap. Icons of other
  shapes (e.g. the round Camera) are not taken into account.

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
| Folder views (desktop + Folders) | `components/ui/folder-icon-view.tsx` (arrangement `flow` / `manual` / `desktop`, layouts), `hooks/use-folder-ops.ts` (drop, paste, trash, rename), `use-external-file-drop.ts`, `use-launcher-items.ts`, `lib/shell/folder-items.ts` |
| Icons & accent tinting | `lib/xdg/xdg-icon-theme.ts`, `lib/shell/icon-accent-tint.ts`, `lib/shell/shell-icon-names.ts`, `Piloti/index.theme [X-Piloti Accent]`; details in `docs/_ICONS.md` (local) |
| Web pages / Web Browser | `WebViewSurface` + `BrowserTabsSurface` in `WindowManager.tsx`; the tab strip is `BrowserTabBar.tsx` (dnd-kit sortable like the Dock, horizontal only; pulling a tab 48 px off the bar detaches it); `openWebUrl` / `launchApp("browser")` / tab groups (`browserTabGroups`, `openBrowserTab`, `reorderBrowserTabs`, `detachBrowserTab`) in `WindowsContext.tsx`. A tab is a Domicile browser window; a window is a group keyed by its first tab; a detached tab gets its own key (`<tabId>~<n>`) and meta; the window is listed at the first of its tabs in Domicile's list order, so reordering never moves iframes |
| Settings model | `context/SettingsContext.tsx` (INI-backed, `piloti-settings-ini.ts`) |
| App header and content (chrome) | `components/elements/` (`AppWindow`, `AppContent`, `HeaderBar`, `HeaderButton`, `AppSplitView`): window controls, menu and CSD/SSD come from `AppChromeProvider` (set by `shell/WindowAppChrome.tsx`), not from app props. Use these in apps; `HeaderBar.Outlet`/`.Portal` let a page add header controls. The shell's server-side titlebar (`ShellTitlebar`) and web view headers use it too; Calculator and Login Screen are hand-built. Start a new app from `apps/HelloWorldApp.tsx`. Apps lay content out only: `tests/unit/app-styling.test.ts` caps colour/type/radius/shadow classes per file |
| Split view (sidebar apps) | `components/ui/adw-split-view.tsx` (title aligned to content via `data-slot="page-title"`) |

## Checking in the web demo (`npm run dev`)
- `window.piloti` (Domicile's desktop plus the shell's calls,
  `lib/engine/piloti.ts`): `desktop.launchApp(id)`, `.list`, `.minimize/close/
  toggleMaximize(id)`, `settings.get()/update({...})`, `plugins.list`,
  `piloti.files.write(relPath, text)`.
- The demo VFS (localStorage) is seeded once: new bundled files (plugins…)
  don't appear in an existing profile. Copy them with
  `import('/data/files/…?raw')` + `piloti.files.write`.
- After changing `data/files/` run `node scripts/generate-piloti-icons.mjs`.
- Drag & drop: dispatch `PointerEvent`s (down on the element, move/up on
  `window`/`document`); automation key presses don't trigger editing commands
  (Ctrl/Cmd+A), test handlers with synthetic `KeyboardEvent`s.
- Measure alignment with a `Range` around text nodes, not element boxes.
- Unit tests: `~/.bun/bin/bun test tests/unit tests/functional`;
  icon coverage `tests/unit/icon-theme-coverage.test.ts`.
