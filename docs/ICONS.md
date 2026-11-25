# Icons and accent colors

How Piloti finds icons, which ones follow the accent color, and how to add one.

## Theme chain

| Interface theme | Icon themes searched, in order          |
|-----------------|-----------------------------------------|
| Piloti          | Piloti → Papirus → Adwaita → hicolor    |
| Adwaita         | Adwaita → hicolor                       |

The chain follows each theme's `Inherits=` line (`Piloti/index.theme`
inherits `Papirus,Adwaita,hicolor`). The search goes theme by theme: within
one theme, every candidate name is tried before moving to the next theme.

- **On a real install:** only `Piloti/` and the `hicolor/…/piloti-*` icons
  come from our package. Papirus, Adwaita and hicolor (with the `org.gnome.*`
  app icons) come from the system.
- **In the web demo:** `data/files/usr/share/icons/` holds a minimal copy of
  each theme, read from the demo's data pack. It includes the GNOME app icons for
  Calculator, Snapshot, Loupe and Epiphany (from GNOME GitLab) and Papirus's
  `org.gnome.Snapshot` icon.

The names the shell asks for are listed in a few places:
- **App icons:** each catalog app's `xdgIcons` in `src/data/catalog.ts`. The
  Papirus or Piloti name comes first, then the GNOME id
  (`org.gnome.Console` …), then Piloti's own fallbacks.
- **Folders, trash, drives, file types, app grid:**
  `src/lib/shell/shell-icon-names.ts`.
- **User folders:** `src/lib/xdg/xdg-user-dirs.ts`.

`tests/unit/icon-theme-coverage.test.ts` resolves every one of them against
the bundled themes, for both interface themes. Run it after adding an app or
changing a theme. Under Adwaita, the drive icons and the login-screen app have
no bundled icon on purpose; the shell shows its own glyph instead.

## Accent-colored icons

An icon follows the accent color when it **marks** the shapes to recolor:

- **SVG:** `class="accent"`, `class="accent-darker"` or
  `class="accent-lighter"` for fills. Add a `-stroke` suffix for strokes
  (`accent-lighter-stroke`). Keep a real color in the file (`#5294e2`,
  `#4877b1`, `#8bbcf6`) so the icon still looks right outside Piloti.
- **Lottie:** a fill (`fl`) or stroke (`st`) item with `cl` set to one of those
  names. `scripts/generate-piloti-icons.mjs` adds them automatically to every
  fill or stroke drawn in a placeholder color.

The three shades:

| Class            | Color                          |
|------------------|--------------------------------|
| `accent`         | the accent                     |
| `accent-darker`  | the accent × (1 − 0.22)        |
| `accent-lighter` | the accent mixed with 40% white |

Use the lighter shade on dark icons. The factors come from the theme (see
below).

### How icons are recolored

`src/lib/shell/icon-accent-tint.ts` does the work:

- **SVG:** a `<style>` is injected that sets the fill or stroke of the marked
  classes, with `!important`, so it wins over `style="fill:…"`. The artwork
  itself is never rewritten.
- **Lottie:** the color of each marked item is set.

Icons without markers are returned untouched, whatever their name. Results are
cached, so changing the accent does not decode every icon again.

### Theme configuration

`Piloti/index.theme` carries a vendor section. GTK and Qt ignore it.

```ini
[X-Piloti Accent]
Accent=#5294e2
Darker=#4877b1
Lighter=#8bbcf6
DarkerFactor=0.22
LighterMix=0.4
InheritedIcons=folder;folder-*;user-home;user-desktop;user-trash-full;system-file-manager;preferences-desktop;preferences-system;text-x-generic
```

- `DarkerFactor` and `LighterMix` set the shade math.
- `InheritedIcons` lists icons from inherited themes (stock Papirus) that have
  no markers but draw the accent with the colors above. When one of them is
  loaded, `markInheritedAccentIcon` adds the classes. `*` matches any suffix.
- The first theme in the chain that has the section is the one used. The
  Adwaita interface theme has none, so GNOME icons keep their own colors. Our
  `hicolor/piloti-*` icons still follow the accent, because they carry markers.

## Adding an accent icon

1. **Our own icon:** draw it with the placeholder colors and add the classes.
   Put it in `Piloti/scalable/<context>/`, or in `hicolor/scalable/apps/` for a
   Piloti app icon that must also show under Adwaita.
2. **Animated icon:** add it to `ICONS` in `scripts/generate-piloti-icons.mjs`
   and draw the accent parts with `#5294e2`, `#4877b1` or `#8bbcf6`.
3. **Inherited icon:** add its name to `InheritedIcons`.
4. Run `node scripts/generate-piloti-icons.mjs`, then
   `~/.bun/bin/bun test tests/unit/icon-theme-coverage.test.ts`.

The coverage test fails if a Piloti-owned file uses a placeholder color
without a marker.

## Caches

Resolved icons are cached in the VFS:
- `~/.cache/piloti/dock-icons.json` (the dock icons)
- the XDG apps cache (icon paths)
- the icon index (`piloti.xdg-icon-index.v5`)

Bump `ICON_CACHE_VERSION` in `src/context/AppsContext.tsx` when resolution or
marking changes, so older cached icons are dropped.
