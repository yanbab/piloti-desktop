# Linux integration

See also [ARCHITECTURE.md](./ARCHITECTURE.md).

## Wayland notes

Seen with `domicile 1.2.0-1`; recheck on newer releases.

| Client | Behaviour | Status |
|---|---|---|
| GTK2 | Needs server decorations; `GTK` category must not imply CSD | Fixed |
| GTK3 | Wants client decorations, gets server: endless loop | Compositor bug |
| GTK3 | `unset_fullscreen` at startup: ignored unless a press is held | Fixed |
| GTK3, Firefox, Chromium | `xdg_toplevel.move` ignored (`cprussin/domicile#2049`) | Alt/Super + drag |
| GTK4 | Headerbar drag sends `unset_fullscreen`: taken as a move | Worked around |
| `<app>` | Pointer capture is lost: use window listeners | Fixed |
| CSD | Keep inner resize strips narrow | Fixed |

On VMware (`vmwgfx`) clicks land 6 px right, 4 px down: the engine omits the
cursor hotspot (`drmModeSetCursor2`).

## Portals

Domicile handles D-Bus and permissions; `PortalDialogs.tsx` draws and answers.
Done: Screenshot, ScreenCast, PickColor, Access, Account, Wallpaper,
InputCapture, USB, Inhibit, FileChooser, AppChooser, GlobalShortcuts,
DynamicLauncher, RemoteDesktop, Print.

## Admin prompts

Piloti starts an installed polkit agent (`ensurePolkitAgent`), found through its
`/etc/xdg/autostart` entry. The `.deb` recommends `mate-polkit`; without an
agent `pkexec` is refused.

Root apps (Synaptic) draw through X: Piloti grants `si:localuser:root` on its
Xwayland display with `xhost` (`x11-xserver-utils`).

## XDG coverage

`core/xdg/`: base and user directories, desktop entries, icon themes, MIME apps,
trash, recents, thumbnails (read), autostart, session restore, web apps, global
menus. Also sound cues and a `greetd` greeter.

## Desktop actions

App context menus (Dock, app grid) come from Desktop Actions in the `.desktop`
file, as in GNOME Shell.

```ini
[Desktop Entry]
Type=Application
Name=My App
Exec=my-app %U
Actions=new-window;

[Desktop Action new-window]
Name=New Window
Exec=my-app --new-window
```

- `Actions` sets the order; each id needs its group.
- `Name` can be localised (`Name[fr]`). GNOME ignores an action's `Icon`.
- Actions are static: an app can't change them at runtime.

### GNOME's menu, for reference

1. The app's open windows
2. Its desktop actions
3. Shell items: New Window (unless defined, or `SingleMainWindow=true`), pin or
   unpin, App Details, discrete GPU launch, Quit

## Reusing GNOME

Piloti is an alternate shell on the stack under GNOME Shell. The Domicile
compositor already serves notifications, portals, idle and lock, and the tray.

**Rule:** a D-Bus interface or GSettings key that GNOME apps use beats parsing a
CLI or a private file. Each move is a port with a native and a demo adapter.

| Feature | Now | Target |
|---|---|---|
| Appearance, fonts, wallpaper, WM prefs | `gsettings`, `dconf` | linked keys (`usr/share/piloti/gsettings-links.ini`), `dconf watch` |
| Notification settings | gsettings | done |
| Power actions, brightness | `systemctl`, `loginctl`, `brightnessctl` | logind |
| Battery, power profiles | `upower`, `powerprofilesctl` | UPower, `net.hadess.PowerProfiles` |
| Network | `nmcli` | NetworkManager D-Bus |
| Media player | `playerctl` | MPRIS |
| Removable drives, CDs | UDisks2 (`platform/native/drives.ts`) | done; no automount |
| Volume | `wpctl`, `pactl` | keep; events from `pactl subscribe` |
| Bluetooth | none | BlueZ |
| Time, locale, hostname, user | files or none | `timedate1`, `locale1`, `hostname1`, AccountsService |
| Open or reveal folders | spawns `nautilus` | `org.freedesktop.FileManager1`, OpenURI |
| Launcher search | own index | `org.gnome.Shell.SearchProvider2` |
| Install, update | `flatpak`, `apt` | PackageKit; keep `flatpak` |
| Trash, recents, thumbnails | XDG specs | done |
| Keyboard layouts | Domicile config | mirror `input-sources` |
| Calendar | none | Evolution Data Server (optional) |
| Own settings | `.ini` files | maybe an `org.piloti` GSettings schema |

### Not available

Mutter, `org.gnome.Shell` (as a service), gnome-session and gsd media keys: use
Domicile's APIs. Nothing documents a shell owning a bus name (ScreenSaver,
SessionManager, inhibitors): ask Domicile first.
