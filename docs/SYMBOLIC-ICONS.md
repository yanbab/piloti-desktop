# Symbolic icons

The shell's UI symbols come from the icon theme through `<SymbolicIcon
name="…" fallback={LucideGlyph}>` (`components/ui/symbolic-icon.tsx`), in the
text colour. Piloti and Adwaita use the theme; Cupertino keeps Lucide.

- Names are listed in `SYMBOLIC_ICONS` (`lib/shell/shell-icon-names.ts`),
  standard name first. All are loaded together when the icon theme changes
  (`lib/shell/symbolic-icons.ts`).
- The Lucide glyph is drawn when no theme in the chain has the name.
- A new name needs its demo SVGs: copy them, unmodified, from an installed
  system (`/usr/share/icons/Adwaita/symbolic/` and
  `Papirus/16x16/symbolic/`) into `data/files/usr/share/icons/<theme>/symbolic/`
  and list new folders in that `index.theme`. Don't draw them. The `.deb`
  leaves both out. Current copies: Debian `adwaita-icon-theme` 51.0
  (LGPL-3.0 or CC-BY-SA-3.0) and `papirus-icon-theme` 20260801 (GPL-3.0).

## Lucide to symbolic names

Names without `-symbolic`, checked against Adwaita 51 unless marked "Papirus
only". "—" has no standard name. GNOME has no dock or sparkles icon, and no
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
| Volume2 | `audio-volume-high` |  |
| VolumeX | `audio-volume-muted` |  |
| Wifi | `network-wireless-signal-excellent` |  |
| WifiOff | `network-wireless-disabled` |  |
| Wrench | `applications-utilities` |  |
| X | `window-close` |  |
| ZoomIn | `zoom-in` |  |
| ZoomOut | `zoom-out` |  |

## Still drawn by Lucide

| File (`src/components/`) | Icons |
|---|---|
| `apps/AppStoreApp.tsx` | ArrowUpCircle, Blocks, Briefcase, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Code2, FlaskConical, Gamepad2, Globe, Layers, Music, Package, Palette, Puzzle, RefreshCw, Server, SlidersHorizontal, Sparkles, Type, Wrench, X |
| `apps/CalculatorApp.tsx` | X |
| `apps/CameraApp.tsx` | Camera, Mic, Video |
| `apps/ConsoleApp.tsx` | AppWindow, Bell, Cpu, Database, Gauge, LayoutGrid, Monitor, Settings |
| `apps/FileItemContextMenu.tsx` | ChevronRight |
| `apps/FilesApp.tsx` | AlertCircle, ArrowLeft, Briefcase, ChevronDown, ChevronRight, Clock, Download, Eject, FileText, Folder, Heart, Home, Image, LayoutGrid, List, Monitor, Music, Tag, Trash2, Usb, Video, X |
| `apps/ImageViewerApp.tsx` | Check, Crop, Maximize2, RotateCcw, RotateCw, Save, X, ZoomIn, ZoomOut |
| `apps/LoginScreenApp.tsx` | ArrowLeft, ArrowRight, Battery, BatteryCharging, Check, ChevronDown, Monitor, Power, User, UserPlus, Volume2, VolumeX, Wifi, WifiOff |
| `apps/PilotiDemoApp.tsx` | Bell, Boxes, ChevronDown, Folder, House, Image, Menu, Monitor, Moon, Palette, SlidersHorizontal, Sun, Type, Volume2 |
| `apps/SettingsApp.tsx` | Dock |
| `apps/SystemMonitorApp.tsx` | X |
| `apps/TextEditorApp.tsx` | Save, SlidersHorizontal |
| `apps/XtermTerminalApp.tsx` | ChevronDown |
| `apps/demo/ElementsPage.tsx` | Info, Plus, Save |
| `apps/settings/AdvancedPane.tsx` | FolderOpen, Plus, Puzzle, RefreshCw, Trash2, Usb |
| `apps/settings/AppearancePane.tsx` | Monitor, Moon, Sun |
| `apps/settings/FontsPane.tsx` | Check, ChevronsUpDown, Search |
| `apps/settings/SecurityPane.tsx` | ChevronDown, ShieldCheck |
| `apps/settings/WallpaperPane.tsx` | ArrowUp, Film, Folder, Image, Plus, SunMoon |
| `shell/AltTabSwitcher.tsx` | Sparkles |
| `shell/AppSymbol.tsx` | AppWindow, Globe |
| `shell/AuthPasswordCard.tsx` | ArrowLeft, ArrowRight, Eye, EyeOff, Loader2 |
| `shell/BrowserExtensionsMenu.tsx` | Pin, PinOff, Puzzle, Settings |
| `shell/Launcher.tsx` | BellRing, Calculator, Camera, Columns2, Globe, Layers, LayoutTemplate, Lock, Maximize2, Moon, Palette, Puzzle, Settings, Sun, Video, Volume2, VolumeX |
| `shell/LockScreen.tsx` | Bell, Lock |
| `shell/NicePathLabel.tsx` | Home |
| `shell/OsdOverlay.tsx` | Sun, Volume2, VolumeX |
| `shell/Overview.tsx` | Plus |
| `shell/PortalDialogs.tsx` | AlertTriangle, AppWindow, Camera, Eye, EyeOff, File, Folder, Image, Keyboard, Monitor, Pipette, Printer, ShieldCheck, Sparkles, Usb, User, Video, X |
| `shell/PowerActionDialog.tsx` | AlertTriangle |
| `shell/WindowManager.tsx` | Loader2 |
| `ui/checkbox.tsx` | Check |
| `ui/command.tsx` | Check, Search |
| `ui/dialog.tsx` | X |
| `ui/dropdown-menu.tsx` | Check, ChevronRight, Circle |
| `ui/grouped-form.tsx` | ChevronDown, ChevronRight |
| `ui/icon-grid.tsx` | AlertCircle, Briefcase, Heart, Tag |
| `ui/info-pane.tsx` | Info |
| `ui/list-view.tsx` | ChevronDown, ChevronUp |
| `ui/search-field.tsx` | ListFilter, Search |
| `ui/select.tsx` | Check, ChevronsUpDown |
| `ui/toast.tsx` | X |
