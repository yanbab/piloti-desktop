# FAQ

## Are checkboxes and radio boxes styled as Adwaita?
- **Standalone Checkbox** (`src/components/ui/checkbox.tsx`): Yes — `size-4 rounded-[4px]`, `data-checked:border-adw-accent data-checked:bg-adw-accent`, and `focus-visible:adw-focus-ring`. (`src/components/shell/PortalDialogs.tsx` still uses a raw `<input type="checkbox">`.)
- **Menu Checkbox & Radio Items** (`src/components/ui/context-menu.tsx`, `dropdown-menu.tsx`, `menubar.tsx`, `menu-styles.ts`): Styled with Adwaita `MENU_CHECK_ITEM_CLASS` and render a bare `CheckIcon` or `CircleIcon` indicator on the left (matching GTK4/Libadwaita popover menus rather than boxed checkboxes/radios). There is currently no standalone `RadioGroup` UI component in `src/components/ui/`.

## How can I trigger the BSOD screen from the Console?
In the in-shell **Console** REPL:
```js
bsod()
```
Or with a custom message:
```js
bsod("Custom error message")
```
From browser DevTools Console:
```js
window.dispatchEvent(new CustomEvent("residence:bsod", { detail: new Error("Manual BSOD test") }))
```

## Why did Nautilus still lack themed icons outside GNOME?
GTK4 / Libadwaita queries `org.freedesktop.portal.Settings` (`org.gnome.desktop.interface` → `icon-theme`) on D-Bus *before* falling back to `~/.config/gtk-4.0/settings.ini`. Outside GNOME:
1. `XDG_CURRENT_DESKTOP` may not be `GNOME` (or `xdg-desktop-portal-gnome` / `xdg-desktop-portal-gtk` is inactive or returning `Adwaita`).
2. `DBUS_SESSION_BUS_ADDRESS` / `dconf` may differ from the host GNOME session.
3. Custom icon themes in `~/.local/share/icons` may need `gtk-update-icon-cache -f -t ~/.local/share/icons/<Theme>`.
4. **`gtk-icon-theme-name = gnome` fallback bug**: Running `Gtk.Settings.get_default().get_property("gtk-icon-theme-name")` in Piloti printed `gnome`, and `GTK_DEBUG=icontheme` showed GTK4 only scanning `/usr/share/icons/hicolor` and `/org/gtk/libgtk/icons/` (never `Adwaita`). On Debian, if `/usr/share/icons/gnome` is missing or incomplete, GTK4 drops straight to `hicolor` instead of `Adwaita`. Fix by checking `gsettings get org.gnome.desktop.interface icon-theme` / `~/.config/gtk-3.0/settings.ini` / `~/.config/gtk-4.0/settings.ini` and setting the theme to `'Adwaita'`.

You can inspect what GTK4 resolves with:
```bash
GTK_DEBUG=icontheme nautilus --new-window 2>&1 | head -n 50
```

## Why didn't `<meta name="theme-color">` tint a cross-origin web view in browser mode?
Cross-origin iframes block `contentDocument` access, and many sites (such as `https://www.towergame.app/`) do not send `Access-Control-Allow-Origin` headers, so browser `fetch()` is blocked by CORS. In Vite dev mode, `/__web_meta` in `vite.config.ts` fetches the HTML head server-side to extract `<title>` and `<meta name="theme-color">`, and discovered colors are cached in `localStorage` (`piloti.web-theme-colors.v1`).

## Do we respect app requested window sizes?
Partially — there are three places in `src/context/WindowsContext.tsx` that override or clamp requested sizes:
1. **Built-in shell apps** (`launchApp`, ~line 1568): `minSize` defaults to `{ width: 620, height: 400 }` whenever `builtinDef.minSize` is omitted, which forces smaller `defaultSize` entries (such as `text-editor` at `520×380`) up to `620×400`.
2. **Wayland apps** (`domicile.windows`, ~line 567): Precedence is `sessionRestore` → `settings.savedWindowBounds` → `{ width: w.width > 200 ? w.width : 760, height: w.height > 150 ? w.height : 500 }`, clamped to `minWidth: w.minWidth ?? 320` and `minHeight: w.minHeight ?? 220`. Anything requesting `<= 200×150` falls back to `760×500`.
3. **WebView windows** (~line 455): Uses `bw.width` / `bw.height` only if above `200×150` (and not overridden by `savedWindowBounds`), with a minimum of `420×300`.

## Does the WM respect GTK / Wayland client requests?
- **Interactive `WindowRequest`s**: Yes — `src/context/WindowsContext.tsx` and `src/components/shell/WindowManager.tsx` handle `Maximize`, `Unmaximize`, `Minimize`, `Fullscreen`, `Move` (and `Unfullscreen` headerbar drag), and `Resize` (`DOMICILE_RESIZE_EDGE_MAP`).
- **Minimum size**: Yes — `w.minWidth` / `w.minHeight` (falling back to `320×220`) are passed to `clampWindowBounds` and `Window`.
- **Maximum size**: No — `w.maxWidth` / `w.maxHeight` are not currently forwarded to `Window`'s `maxSize`.
- **Initial size**: Partially — `sessionRestore` and `savedWindowBounds` override `w.width`/`w.height`, and requested sizes `<= 200×150` fall back to `760×500`.



