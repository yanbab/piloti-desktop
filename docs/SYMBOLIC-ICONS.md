# Symbolic icons

The shell's UI symbols come from the icon theme through `<SymbolicIcon
name="…" fallback={LucideGlyph}>` (`ui/components/ui/symbolic-icon.tsx`), in the
text colour. Adwaita uses the theme; Piloti and Cupertino keep Lucide.

- Names are listed in `SYMBOLIC_ICONS` (`core/icons/shell-icon-names.ts`),
  standard name first. All are loaded together when the icon theme changes
  (`core/icons/symbolic-icons.ts`).
- The Lucide glyph is drawn when no theme in the chain has the name.
- A new name needs its demo SVGs: copy them, unmodified, from an installed
  system (`/usr/share/icons/Adwaita/symbolic/` and
  `Papirus/16x16/symbolic/`) into `core/data/files/usr/share/icons/<theme>/symbolic/`
  and list new folders in that `index.theme`. Don't draw them. The `.deb`
  leaves both out. Current copies: Debian `adwaita-icon-theme` 51.0
  (LGPL-3.0 or CC-BY-SA-3.0) and `papirus-icon-theme` 20260801 (GPL-3.0).

Import a Lucide name from `ui/components/ui/symbols.tsx` to get the themed one;
add it there when a new glyph is needed. Where the meaning differs from that
default (Chevron in a menu or a button, a charging battery), write
`<SymbolicIcon>` with the name.

## Lucide to symbolic names

Names without `-symbolic`, checked against Adwaita 51 unless marked "Papirus
only" (those stay Lucide). "—" has no standard name. GNOME has no dock or sparkles icon, and no
single spinner glyph (GTK draws it).

| Lucide | Symbolic | Note |
|---|---|---|
| AlertCircle | `dialog-error` |  |
| AlertTriangle | `dialog-warning` |  |
| AppWindow | `application-x-executable` | windows and apps without an icon |
| ArrowDownUp | `view-sort-descending` |  |
| ArrowLeft | `go-previous` |  |
| ArrowRight | `go-next` |  |
| ArrowUp | `go-up` |  |
| ArrowUpCircle | `software-update-available` |  |
| Battery | `battery-good` |  |
| BatteryCharging | `battery-good-charging` |  |
| BatteryLow | `battery-caution` |  |
| Bell | `preferences-system-notifications` |  |
| BellOff | `notifications-disabled` |  |
| BellRing | `alarm` |  |
| Blocks | `application-x-addon` |  |
| Bluetooth | `bluetooth-active` |  |
| BluetoothOff | `bluetooth-disabled` |  |
| Boxes | — |  |
| Briefcase | — | folder badge (emblem), no standard name (x-office-document is not it) |
| Calculator | `accessories-calculator` |  |
| Camera | `camera-photo` |  |
| Check | `object-select` |  |
| CheckCircle2 | `emblem-ok` | Papirus only |
| ChevronDown | `pan-down` |  |
| ChevronLeft | `go-previous` |  |
| ChevronRight | `pan-end` (menus, disclosure) / `go-next` |  |
| ChevronUp | `pan-up` |  |
| ChevronsUpDown | — | GTK drop-downs use pan-down |
| Circle | — | menu radio dot, drawn by the toolkit (media-record is the nearest) |
| Clock | `document-open-recent` |  |
| Code2 | `applications-development` | Papirus only |
| Columns2 | `view-dual` |  |
| Cpu | — | applications-system is the nearest |
| Crop | `image-crop` | Papirus only |
| Database | — | drive-harddisk is the nearest |
| Dock | — | `preferences-desktop-multitasking` is the nearest |
| Download | `folder-download` |  |
| Eject | `media-eject` |  |
| Eye | `view-reveal` |  |
| EyeOff | `view-conceal` |  |
| File | `text-x-generic` |  |
| FileText | `x-office-document` |  |
| Film | `video-x-generic` |  |
| Flame | `night-light` | used for Night Light |
| FlaskConical | `applications-science` |  |
| Folder | `folder` |  |
| FolderOpen | `folder-open` |  |
| Gamepad2 | `applications-games` |  |
| Gauge | `power-profile-power-saver` | the Power Saver tile; the Console's use has no standard name |
| Globe | `web-browser` |  |
| Heart | `emblem-favorite` | Papirus only |
| Home | `user-home` |  |
| House | `user-home` |  |
| Image | `image-x-generic` |  |
| Info | `help-about` |  |
| Keyboard | `input-keyboard` |  |
| Layers | — | no standard name (view-paged is the nearest) |
| LayoutGrid | `view-app-grid` (launcher) / `view-grid` (view switch) |  |
| LayoutTemplate | — |  |
| List | `view-list` |  |
| ListFilter | — | view-sort-descending is the nearest |
| Loader2 | — | keep the spinning glyph (`content-loading` is three still dots) |
| Lock | `system-lock-screen` (lock) / `network-wireless-encrypted` (secured network) |  |
| Maximize2 | `view-fullscreen` |  |
| Menu | `open-menu` |  |
| Mic | `audio-input-microphone` |  |
| Minimize2 | `view-restore` |  |
| Minus | `window-minimize` (window control) / `list-remove` |  |
| Monitor | `video-display` |  |
| Moon | `weather-clear-night` |  |
| Music | `audio-x-generic` |  |
| Music2 | `audio-x-generic` |  |
| Package | `package-x-generic` |  |
| Palette | `applications-graphics` |  |
| Pause | `media-playback-pause` |  |
| Pin | `view-pin` |  |
| PinOff | — |  |
| Pipette | `color-select` |  |
| Play | `media-playback-start` |  |
| Plus | `list-add` |  |
| Power | `system-shutdown` |  |
| Printer | `printer` |  |
| Puzzle | `application-x-addon` |  |
| RefreshCw | `view-refresh` |  |
| RotateCcw | `object-rotate-left` |  |
| RotateCw | `object-rotate-right` |  |
| Save | `document-save` |  |
| ScrollText | — | text-x-generic is the nearest |
| Search | `system-search` |  |
| Send | `mail-send` |  |
| Server | `network-server` |  |
| Settings | `emblem-system` |  |
| ShieldCheck | `security-high` |  |
| SkipBack | `media-skip-backward` |  |
| SkipForward | `media-skip-forward` |  |
| SlidersHorizontal | `preferences-system` (pane) / `emblem-system` (settings button) |  |
| Sparkles | — | no standard name |
| Speaker | `audio-speakers` |  |
| Square | `media-playback-stop` |  |
| Star | `starred` / `non-starred` |  |
| Sun | `display-brightness` (brightness) / `weather-clear` (light style) |  |
| SunMoon | — |  |
| Tag | — | folder badge, no standard name |
| Terminal | `utilities-terminal` |  |
| Trash2 | `user-trash` |  |
| TriangleAlert | `dialog-warning` |  |
| Type | `font-x-generic` |  |
| Usb | `drive-removable-media` |  |
| User | `avatar-default` |  |
| UserPlus | `contact-new` |  |
| Video | `camera-video` |  |
| Volume2 | `audio-volume-low` / `-medium` / `-high` | Adwaita only: Piloti and Cupertino draw Lucide `Volume` / `Volume1` / `Volume2` by level (`ui/components/common/SoundVolumeIcon.tsx`) |
| VolumeX | `audio-volume-muted` |  |
| Wifi | `network-wireless-signal-weak` / `-ok` / `-excellent` | Adwaita only: Piloti and Cupertino draw Lucide `WifiLow` / `WifiHigh` / `Wifi` by signal (`ui/components/common/WifiSignalIcon.tsx`) |
| WifiOff | `network-wireless-disabled` |  |
| Wrench | `applications-utilities` |  |
| X | `window-close` |  |
| ZoomIn | `zoom-in` |  |
| ZoomOut | `zoom-out` |  |

## Still drawn by Lucide

No standard name, Papirus-only names, spinners, and the favourite heart.

| File (`src/ui/components/`) | Icons |
|---|---|
| `ui/apps/app-store/AppStoreApp.tsx` | Briefcase, CheckCircle2, Code2, Layers, Sparkles |
| `ui/apps/console/ConsoleApp.tsx` | Cpu, Database, Gauge |
| `ui/apps/files/FilesApp.tsx` | Briefcase, Heart, Tag |
| `ui/apps/image-viewer/ImageViewerApp.tsx` | Crop |
| `ui/apps/piloti-demo/PilotiDemoApp.tsx` | Boxes |
| `ui/apps/settings/SettingsApp.tsx` | Dock |
| `ui/apps/settings/FontsPane.tsx` | ChevronsUpDown |
| `ui/apps/settings/WallpaperPane.tsx` | SunMoon |
| `ui/shell/overview/AltTabSwitcher.tsx` | Sparkles |
| `ui/shell/session/AuthPasswordCard.tsx` | Loader2 |
| `ui/shell/windows/BrowserExtensionsMenu.tsx` | PinOff |
| `ui/shell/launcher/Launcher.tsx` | Layers, LayoutTemplate |
| `ui/shell/dialogs/PortalDialogs.tsx` | Sparkles |
| `ui/shell/windows/WindowManager.tsx` | Loader2 |
| `ui/dropdown-menu.tsx` | Circle |
| `ui/icon-grid.tsx` | Briefcase, Heart, Tag |
| `ui/search-field.tsx` | ListFilter |
| `ui/select.tsx` | ChevronsUpDown |
