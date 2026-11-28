# Guide

Where things are and how to check them. Rules and commands:
[AGENTS.md](../AGENTS.md). Paths are under `src/`.
Also: [architecture](./ARCHITECTURE.md), [Linux](./LINUX.md), [API](./API.md),
[plugins](./PLUGINS.md).

## Themes and tokens

- **Themes.** Cupertino (`cupertino.css`): CupertinoUI's macOS 27 look.
  Adwaita (`adwaita.css`): GNOME-faithful. Piloti (`piloti-macos.css`, all under
  `:root[data-interface-theme="piloti"]`): Ventura, compact (controls ≤ 28 px),
  solid, no hover effects. Style per theme through `data-slot`, never by editing
  shared classes. Check visually in the Piloti demo.
- **Tokens, not values.** Text `text-ui-{title,body,small,
  caption}` (they follow the font settings; no fixed text sizes,
  line heights in CSS multiply by `--piloti-font-scale`); radius `rounded-ui-{control,
  box,window}`; height `h-/size-ui-control-{small,medium,large}`; surfaces `--ui-{window,group,sidebar,overlay}`; colour `--ui-*`, never `--adw-*`. On controls use `hover-fill:`
  (Adwaita only), never `hover:`.
- **Leaving Tailwind** widget by widget: plain CSS in
  `ui/styles/components/<name>.css` (`ui-<name>`, `data-variant`, `data-size`,
  `@layer components`), usable without React. Done: button, switch, checkbox,
  input, window frame, grouped form, sidebar, menus, segmented control.

- **Piloti soft accent.** `--ui-accent-soft` (80% accent, 20% white) fills
  selected sidebar rows, menu highlights and selected icon labels; colored
  icons are tinted with the same value (`resolveUiAccentHex`). Controls keep
  `--ui-accent`.

## Piloti geometry

Corners are concentric: outer radius = inner radius + gap, computed from tokens
in `piloti-macos.css`.

- Items and list rows: `--ui-radius-control` (5px).
- Menus: `--ui-radius-box` = control radius + 5px padding. Rows 22px, text 13px, side padding 9px; 20px
  check column only with check or radio items. Highlight: accent, white text.
- Control panel: modules use the menu radius; panel = that + 12px padding.
- Dock: square icons fill 56 of 64px (4.2px corners); padding is 7px. Corner =
  `size × 4.2/64 + 7px + size × 4/64`.

## Layout

| Folder | Holds |
|---|---|
| `ui/apps/<app>/` | One built-in app: its components and the helpers only it uses. `main.tsx` is its isolated module entry |
| `ui/shell/<feature>/` | Desktop, menu bar, Dock, launcher, overview, windows, notifications, session, dialogs |
| `ui/components/` | `ui/` widgets, `elements/` app chrome, `common/` pieces shared by apps and shell |
| `ui/context/`, `ui/hooks/`, `ui/dnd/` | Shared state, hooks, drag and drop |
| `platform/` | Adapters: `shared/` (what UI code calls), `native/` (Linux), `web/` (demo) |
| `core/ports/` | Interfaces: `Piloti`, `vfs`, settings, hardware, the public shell API, `AppHost` and `Apps` |
| `core/apps/` | The apps backend and the module IPC, plain enough for an app module |
| `core/<topic>/` | Plain logic: `state` (settings and `.ini` state), `xdg`, `config`, `files`, `windows`, `icons`, `plugins`, `system`, `util`; `data/` catalogs |

## Map

| Area | Files |
|---|---|
| Window manager, frame | `ui/shell/windows/WindowManager.tsx`, `ui/components/ui/window.tsx`; window contents: `WindowBody.tsx` and `*Surface.tsx` |
| App registration | `core/data/catalog.ts`, `BUILTIN_APPS` in `ui/shell/windows/WindowBody.tsx`, `launchApp` and `builtinExecMap` in `ui/context/WindowsContext.tsx` |
| Menus | `ui/shell/menubar/MenuBar.tsx`, `ui/components/common/AppMenuItems.tsx`, `publishWindowMenuState` (`platform/shared/app-bridge.ts`) |
| Popups (one at a time) | `ui/hooks/popup-layer.ts` |
| Floating windows | `core/windows/floating-window.ts`, `ui/dnd/pointer-drag.ts`, `ui/shell/windows/PresentationOverlay.tsx` |
| Window presentations | `core/windows/window-presentation.ts`, `ui/context/PluginsContext.tsx`, `core/plugins/types.ts` |
| Bundled plugins | `data/files/usr/share/piloti/plugins/`; the demo-only example is in `data/files/home/user/.config/piloti/plugins/` |
| Icon grid | `ui/components/ui/icon-grid.tsx`, `core/files/desktop-icons.ts`, `ui/dnd/drag-feedback.ts` |
| Folders tree | `ui/components/ui/folder-tree-view.tsx`, `ui/hooks/use-folder-tree.ts`, `core/files/folder-tree.ts` |
| Item drag and drop | `ui/dnd/{item-drop,drag-ghost}.ts`, `ui/shell/dock/dock-pins.ts` |
| Folder views | `ui/components/ui/folder-icon-view.tsx`, `ui/hooks/{use-folder-ops,use-external-file-drop,use-launcher-items}.ts`, `core/files/folder-items.ts` |
| Icons ([details](#icons)) | `core/xdg/xdg-icon-theme.ts`, `core/icons/{icon-accent-tint,shell-icon-names}.ts` |
| UI symbols ([details](./SYMBOLIC-ICONS.md)) | `ui/components/ui/symbolic-icon.tsx`, `core/icons/symbolic-icons.ts` |
| Web browser | `WebViewSurface.tsx`, `BrowserTabsSurface.tsx`, `BrowserTabBar.tsx`; tab groups in `WindowsContext.tsx`. A tab is a Domicile browser window; iframes must not move on reorder |
| Settings | `ui/context/SettingsContext.tsx`, `piloti-settings-ini.ts` |
| Separate apps | `ui/apps/module-app.tsx` (module runtime); hosts in `platform/shared/app-{shell,module}-host.ts`; `core/apps/module-channel.ts`; list in `core/data/app-modules.ts` |
| App chrome | `ui/components/elements/` (`AppWindow`, `HeaderBar`, `AppSplitView`…), fed by `ui/shell/windows/WindowAppChrome.tsx`. Start from `ui/apps/hello/HelloWorldApp.tsx`. Apps only lay out content (`tests/unit/app-styling.test.ts`) |
| Sidebar apps | `ui/components/ui/adw-split-view.tsx` |

## Checking in the demo

- `window.piloti` drives the shell ([API](./API.md)).
- The demo VFS is seeded once: new bundled files are missing from an existing
  profile. Import with `?raw` and `piloti.vfs.write`.
- After changing `data/files/`: `node scripts/generate-piloti-icons.mjs`.
- Icons are cached: check theme changes on `127.0.0.1` instead of `localhost`.
- An error the source doesn't have may be a stale file: `touch` it, reload.
- Drag and drop: dispatch `PointerEvent`s (down on the element, move and up on
  `window`). Test editing shortcuts with synthetic `KeyboardEvent`s.
- Measure alignment with a `Range` around text.

## Icons

### Themes

| Interface theme | Searched in order |
|---|---|
| Piloti | Piloti, Papirus, Adwaita, hicolor |
| Adwaita | Adwaita, hicolor |

The chain follows `Inherits=`. All candidate names are tried in one theme before
the next. Installed systems provide Papirus, Adwaita and hicolor; we ship
Piloti and `hicolor/…/piloti-*`. The demo has minimal copies in
`data/files/usr/share/icons/`.

Names are listed in `src/core/data/catalog.ts` (`xdgIcons`),
`core/icons/shell-icon-names.ts` and `core/xdg/xdg-user-dirs.ts`.
`tests/unit/icon-theme-coverage.test.ts` resolves them all.

### Accent tinting

Only marked shapes are recolored (`core/icons/icon-accent-tint.ts`).

| Class | Color | Placeholder |
|---|---|---|
| `accent` | accent | `#5294e2` |
| `accent-darker` | 22% darker | `#4877b1` |
| `accent-lighter` | 40% white; for dark icons | `#8bbcf6` |

- **SVG:** set the class; add `-stroke` for strokes.
- **Lottie:** set `cl` on a fill or stroke. The generator does this for
  placeholder colors.

`Piloti/index.theme` has an `[X-Piloti Accent]` section with the colors,
`DarkerFactor`, `LighterMix` and `InheritedIcons` (unmarked Papirus icons to
tint; `*` matches a suffix). Adwaita has none, so GNOME icons keep their colors.

### Add an accent icon

1. Draw with placeholder colors:
   - static: add classes; put it in `Piloti/scalable/` (or
     `hicolor/scalable/apps/` if Adwaita needs it);
   - animated: add it to `ICONS` in `scripts/generate-piloti-icons.mjs`;
   - inherited: add its name to `InheritedIcons`.
2. `node scripts/generate-piloti-icons.mjs`
3. `~/.bun/bin/bun test tests/unit/icon-theme-coverage.test.ts`

### Caches

Dock icons (`~/.cache/piloti/dock-icons.json`), XDG apps and the icon index.
When resolution or marking changes, bump `ICON_CACHE_VERSION`
(`ui/context/AppsContext.tsx`).
