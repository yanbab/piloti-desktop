GNOME Shell populates right-click context menu items in the Dash (and App Grid) using **Desktop Actions** from the **freedesktop.org Desktop Entry Specification**.

### 1. The XDG Standard: Desktop Actions

In an application's `.desktop` file (located in `/usr/share/applications/` or `~/.local/share/applications/`), custom context menu entries are defined using the `Actions` key in the main `[Desktop Entry]` group, paired with corresponding `[Desktop Action <ActionName>]` sections.

Here is the standard structure (for example, `org.example.App.desktop`):

```ini
[Desktop Entry]
Type=Application
Name=My App
Exec=my-app %U
Icon=org.example.App
# Semicolon-separated list of action identifiers
Actions=new-window;open-preferences;

[Desktop Action new-window]
Name=New Window
Exec=my-app --new-window

[Desktop Action open-preferences]
Name=Preferences
Exec=my-app --preferences

```

* **`Actions=`**: A semicolon-separated list of identifier strings (`new-window`, `open-preferences`). Order here determines the display order in the menu.
* **`[Desktop Action <identifier>]`**: Each identifier must have a matching group header.
* **`Name=`**: The human-readable label displayed in the Dash context menu (supports localization via `Name[fr]=...`).
* **`Exec=`**: The command executed when clicked.
* **`Icon=`** *(Optional)*: Part of the XDG spec, though GNOME Shell's Dash intentionally ignores action icons and only displays text labels.
* **`OnlyShowIn=` / `NotShowIn=**` *(Optional)*: Restricts specific actions to certain desktop environments (e.g., `OnlyShowIn=GNOME;`).

---

### 2. How GNOME Shell Builds the Full Dash Context Menu

When you right-click an app icon in the GNOME Dash, GNOME Shell (`appDisplay.js`) assembles the menu from three distinct sources in order:

1. **Open Windows List** *(Runtime state)*: Lists any currently open windows belonging to that `WM_CLASS` / app ID so you can switch directly to them.
2. **Static XDG Desktop Actions** *(From the `.desktop` file)*: Reads the `Actions=` list via `GDesktopAppInfo.list_actions()` and creates a menu item for each `[Desktop Action ...]` group.
3. **Built-in Shell Actions** *(Generated dynamically by GNOME Shell)*:
* **New Window**: Added automatically if the app does not already define a `new-window` action and isn't marked as single-window (`SingleMainWindow=true` in the `.desktop` file).
* **Pin to Dash / Unpin**: Managed by GNOME Shell's `org.gnome.shell favorite-apps` GSettings key.
* **App Details**: Opens the application's page in GNOME Software (via D-Bus/PackageKit/Flatpak integration).
* **Launch using Discrete Graphics Card**: Shown automatically on multi-GPU systems if `PrefersNonDefaultGPU=true` is not already set (or vice versa).
* **Quit**: Shown if the application currently has running windows.



### 3. Dynamic Menu Items (What XDG Does *Not* Support)

Unlike macOS Dock menus or Windows Jump Lists, the XDG Desktop Entry spec is strictly static—an app cannot dynamically push recent files or runtime state changes into its Dash context menu over D-Bus (Ubuntu's Unity/ayatana launcher extensions historically added custom dynamic quicklists, which upstream GNOME Shell does not support). To change available actions, the `.desktop` file itself must be modified and picked up by GIO's file monitor.