# Reusing GNOME's tech base

Piloti is an alternate shell for the stack GNOME Shell sits on. Domicile gives a
shell three primitives (files, processes, a D-Bus client with `call` and
`match`) and says desktop features are TypeScript libraries on top of them. The
compositor already is the `org.freedesktop.Notifications` server, the portal
backend, idle/lock, and the system tray host. Everything below is what Piloti
adds on top, and what GNOME Shell does for the same job.

Rule: a D-Bus interface or GSettings key that GNOME apps already use beats a
CLI parse or a private file.

## Today (src/lib/engine-native) vs GNOME's way

| Feature | Piloti now | What GNOME Shell uses | Move to | Notes |
|---|---|---|---|---|
| Appearance, fonts, icon theme, wallpaper, WM prefs | `gsettings`/`dconf watch` shell-outs | GSettings `org.gnome.desktop.interface/background/wm.preferences` (dconf) | keep keys, call/watch through D-Bus (`ca.desrt.dconf`) or a persistent `gsettings monitor` process | Writes stay: GTK apps read these keys. Dark/light also goes out through the Settings portal (`domicile.theme`). |
| Notification settings | gsettings | `org.gnome.desktop.notifications` (+ per-app children) | same | Already mirrored. |
| Wi-Fi, radio, networks | `nmcli` | NetworkManager `org.freedesktop.NetworkManager` (system bus): devices, access points, `PropertiesChanged` | D-Bus | Events instead of polling. |
| Battery, power source | `upower` CLI / sysfs | UPower `org.freedesktop.UPower` DisplayDevice (`Percentage`, `State`, `TimeToEmpty`) | D-Bus | |
| Power profiles | `powerprofilesctl` | `net.hadess.PowerProfiles` | D-Bus | |
| Brightness | `brightnessctl` | logind `Session.SetBrightness` (no root) or gsd-power | D-Bus (logind) | |
| Power off, reboot, suspend, logout, lock | `systemctl`, `loginctl` | logind `Manager.PowerOff/Reboot/Suspend`, `Session.Terminate/Lock` | D-Bus | `org.gnome.SessionManager` only exists under gnome-session. |
| Volume, sinks | `wpctl`, `pactl` | libgvc (PulseAudio protocol) | keep CLI; `pactl subscribe` for events through `processes.spawn` | PipeWire has no D-Bus API. |
| Media player | `playerctl` | MPRIS `org.mpris.MediaPlayer2.*` | D-Bus (`dbus.match` NameOwnerChanged + PropertiesChanged) | |
| Bluetooth | none yet | BlueZ `org.bluez` | D-Bus | |
| Removable drives | simulated USB, `lsblk` | UDisks2 `org.freedesktop.UDisks2` ObjectManager | D-Bus | Replaces `usb-drive.ts` on native. |
| Time zone, NTP, locale, hostname | none / files | `timedate1`, `locale1`, `hostname1` | D-Bus | For Settings and About. |
| User name, avatar, language | files | AccountsService `org.freedesktop.Accounts` | D-Bus | Login screen, About. |
| Open a folder / reveal a file | spawn `nautilus` (45 call sites) | `org.freedesktop.FileManager1` (ShowFolders, ShowItems), `xdg-open`/OpenURI portal | D-Bus | Honours the user's default file manager. |
| Trash, recents, thumbnails | XDG specs in `src/lib/xdg` | same specs | done | `recently-used.xbel` shared with GTK. |
| App search in the launcher | own index | `org.gnome.Shell.SearchProvider2` (providers listed in `/usr/share/gnome-shell/search-providers/*.ini`) | D-Bus | Free results from Files, Calculator, Software, Contacts. |
| Install / update | `flatpak`, `apt` + `pkexec` | PackageKit `org.freedesktop.PackageKit`, libflatpak | PackageKit for apt; keep flatpak CLI | Polkit prompt comes from the portal agent. |
| Calendar events (menubar) | none | Evolution Data Server `org.gnome.evolution.dataserver.*` | D-Bus, optional | |
| Location, night light | none | GeoClue2; colour via mutter | skip | Mutter is not here. |
| Keyboard layouts | Domicile config | `org.gnome.desktop.input-sources` | mirror the key | Domicile owns the real layout. |
| Piloti's own settings | `~/.config/piloti/*.ini` | GSettings schema | `org.piloti.*` schema installed by the .deb | Optional: keeps one store and lets `dconf-editor` and `gsettings` see it. Costs a schema compile in postinst. Decide before moving any more state. |

## Not available here

Mutter's interfaces (`org.gnome.Mutter.*`), `org.gnome.Shell.*`, gnome-session's
`SessionManager` and gsd's MediaKeys grab: the compositor is Domicile. Use its
APIs (displays, keybindings, idle, lock) instead.

Open question: a shell can call D-Bus but nothing in Domicile's docs lets it own
a bus name. ScreenSaver, SessionManager and inhibitor endpoints that GNOME apps
call would need that. Ask Domicile before building on it.

## Order

1. Power: logind (power actions, brightness) and UPower (battery).
2. NetworkManager (replaces the largest `nmcli` code).
3. MPRIS, then UDisks2 (drops the simulated USB on native).
4. FileManager1 in place of spawning Nautilus.
5. Search providers in the launcher.
6. Decide the `org.piloti` schema, then migrate state in one go.

Each step is a port with a native adapter and an in-memory one for the web demo,
as with `FileStore`.
