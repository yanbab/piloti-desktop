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
  `styles/components/<name>.css` (`ui-<name>`, `data-variant`, `data-size`,
  `@layer components`), usable without React. Done: button, switch, checkbox,
  input, window frame, grouped form, sidebar, menus, segmented control.

## Piloti geometry

Corners are concentric: outer radius = inner radius + gap, computed from tokens
in `piloti-macos.css`.

- Items and list rows: `--ui-radius-control` (5px).
- Menus: `--ui-radius-box` = control radius + 5px padding. Rows 22px, text 13px, side padding 9px; 20px
  check column only with check or radio items. Highlight: accent, white text.
- Control panel: modules use the menu radius; panel = that + 12px padding.
- Dock: square icons fill 56 of 64px (4.2px corners); padding is 7px. Corner =
  `size × 4.2/64 + 7px + size × 4/64`.

## Map

| Area | Files |
|---|---|
| Window manager, frame | `components/shell/WindowManager.tsx`, `components/ui/window.tsx` |
| App registration | `data/catalog.ts`, `WindowBody` in `WindowManager.tsx`, `launchApp` and `builtinExecMap` in `context/WindowsContext.tsx` |
| Menus | `components/shell/{MenuBar,AppMenuItems}.tsx`, `publishWindowMenuState` (`lib/engine/app-bridge.ts`) |
| Popups (one at a time) | `lib/shell/popup-layer.ts` |
| Floating windows | `lib/shell/{floating-window,pointer-drag}.ts`, `components/shell/PresentationOverlay.tsx` |
| Window presentations | `lib/shell/window-presentation.ts`, `context/PluginsContext.tsx`, `lib/plugins/types.ts` |
| Bundled plugins | `data/files/home/user/.config/piloti/plugins/` |
| Icon grid | `components/ui/icon-grid.tsx`, `lib/shell/{desktop-icons,drag-feedback}.ts` |
| Folder views | `components/ui/folder-icon-view.tsx`, `hooks/{use-folder-ops,use-external-file-drop,use-launcher-items}.ts`, `lib/shell/folder-items.ts` |
| Icons ([details](#icons)) | `lib/xdg/xdg-icon-theme.ts`, `lib/shell/{icon-accent-tint,shell-icon-names}.ts` |
| UI symbols ([details](./SYMBOLIC-ICONS.md)) | `components/ui/symbolic-icon.tsx`, `lib/shell/symbolic-icons.ts` |
| Web browser | `WebViewSurface`, `BrowserTabsSurface` (`WindowManager.tsx`), `BrowserTabBar.tsx`; tab groups in `WindowsContext.tsx`. A tab is a Domicile browser window; iframes must not move on reorder |
| Settings | `context/SettingsContext.tsx`, `piloti-settings-ini.ts` |
| App chrome | `components/elements/` (`AppWindow`, `HeaderBar`, `AppSplitView`…), fed by `shell/WindowAppChrome.tsx`. Start from `apps/HelloWorldApp.tsx`. Apps only lay out content (`tests/unit/app-styling.test.ts`) |
| Sidebar apps | `components/ui/adw-split-view.tsx` |

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

Names are listed in `src/data/catalog.ts` (`xdgIcons`),
`lib/shell/shell-icon-names.ts` and `lib/xdg/xdg-user-dirs.ts`.
`tests/unit/icon-theme-coverage.test.ts` resolves them all.

### Accent tinting

Only marked shapes are recolored (`lib/shell/icon-accent-tint.ts`).

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
(`context/AppsContext.tsx`).
