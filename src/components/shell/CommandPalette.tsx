import * as React from "react";
import {
  BellRingIcon,
  CameraIcon,
  Columns2Icon,
  LayersIcon,
  LockIcon,
  Maximize2Icon,
  MoonIcon,
  PaletteIcon,
  SettingsIcon,
  SunIcon,
  VideoIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  useApps,
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
import { APP_CATALOG } from "@/data/catalog";
import { resolveXdgVisualStyle } from "@/context/AppsContext";
import { AppSquircleIcon } from "./AppSymbol";

export function CommandPalette() {
  const { settings, updateSettings } = useSettings();
  const {
    pushNotification,
    lockSession,
    takeScreenshot,
    startScreenRecording,
  } = useSystemBackends();
  const { installedXdgApps, getAppIconUrl } = useApps();
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    windows,
    focusedWindowId,
    launchApp,
    launchXdgApp,
    openWebUrl,
    openGnomeSettings,
    focusWindow,
    tileWindow,
    toggleMaximizeWindow,
    openAltTab,
  } = useWindowManager();

  const runAndClose = (fn: () => void) => {
    setCommandPaletteOpen(false);
    fn();
  };

  return (
    <CommandDialog
      open={commandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
      title="Piloti Command Palette"
      description="Search applications, open windows, and system actions (Alt+Space)"
    >
      <Command>
        <CommandInput placeholder="Search" />
        <CommandList className="max-h-[380px]">
          <CommandEmpty>No matching apps, windows, or system commands.</CommandEmpty>

          {/* Open Windows Group */}
          {windows.length > 0 && (
            <>
              <CommandGroup heading="Open Windows">
                {windows.map((win) => (
                  <CommandItem
                    key={win.id}
                    value={`window ${win.title} ${win.appId}`}
                    onSelect={() => runAndClose(() => focusWindow(win.id))}
                  >
                    <AppSquircleIcon
                      iconName={win.iconName}
                      iconUrl={win.iconUrl ?? getAppIconUrl(win.appId)}
                      gradient={win.gradient}
                      className="size-5 rounded-[5px]"
                      glyphClassName="size-3"
                    />
                    <span className="truncate font-medium">{win.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Installed XDG & Web Applications Group */}
          {(installedXdgApps.length > 0 ||
            settings.installedWebApps.length > 0) && (
            <>
              <CommandGroup heading="Applications">
                {installedXdgApps.map((entry) => {
                  const style = resolveXdgVisualStyle(entry);
                  return (
                    <CommandItem
                      key={entry.desktopId}
                      value={`xdg desktop app ${entry.name} ${entry.genericName ?? ""} ${entry.comment ?? ""} ${entry.desktopId} ${entry.keywords.join(" ")} ${entry.categories.join(" ")}`}
                      onSelect={() => runAndClose(() => launchXdgApp(entry))}
                    >
                      <AppSquircleIcon
                        iconName={style.iconName}
                        iconUrl={entry.iconUrl ?? getAppIconUrl(entry.desktopId)}
                        gradient={style.gradient}
                        className="size-5 shrink-0 rounded-[5px]"
                        glyphClassName="size-3"
                      />
                      <span className="truncate font-medium">{entry.name}</span>
                    </CommandItem>
                  );
                })}
                {settings.installedWebApps.map((webApp) => (
                  <CommandItem
                    key={webApp.id}
                    value={`web app ${webApp.title} ${webApp.url}`}
                    onSelect={() => runAndClose(() => openWebUrl(webApp.url))}
                  >
                    <AppSquircleIcon
                      iconName="globe"
                      iconUrl={webApp.iconUrl}
                      gradient="from-sky-500 to-indigo-600"
                      className="size-5 shrink-0 rounded-[5px]"
                      glyphClassName="size-3"
                    />
                    <span className="truncate font-medium">{webApp.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Piloti Built-in Apps (Settings & Console) */}
          <CommandGroup heading="System">
            {APP_CATALOG.filter((app) => Boolean(app.builtinComponent)).map(
              (app) => (
                <CommandItem
                  key={app.id}
                  value={`app launch ${app.name} ${app.shortName} ${app.description} ${app.category}`}
                  onSelect={() => runAndClose(() => launchApp(app.id))}
                >
                  <AppSquircleIcon
                    iconName={app.iconName}
                    iconUrl={getAppIconUrl(app.id)}
                    gradient={app.gradient}
                    className="size-5 rounded-[5px]"
                    glyphClassName="size-3"
                  />
                  <span className="truncate font-medium">{app.name}</span>
                </CommandItem>
              )
            )}
          </CommandGroup>

          <CommandSeparator />

          {/* System Actions Group */}
          <CommandGroup heading="System Actions">
            <CommandItem
              value="open gnome settings control center system"
              onSelect={() => runAndClose(() => openGnomeSettings())}
            >
              <SettingsIcon className="size-4" />
              <span className="truncate font-medium">Open GNOME Settings</span>
            </CommandItem>

            <CommandItem
              value="take screenshot capture area window"
              onSelect={() => runAndClose(() => void takeScreenshot())}
            >
              <CameraIcon className="size-4" />
              <span className="truncate font-medium">Take Interactive Screenshot</span>
            </CommandItem>

            <CommandItem
              value="record screen video screencast"
              onSelect={() => runAndClose(() => void startScreenRecording())}
            >
              <VideoIcon className="size-4" />
              <span className="truncate font-medium">Record Screen</span>
            </CommandItem>

            <CommandItem
              value="switch theme adwaita gnome cupertino macos design language"
              onSelect={() =>
                runAndClose(() =>
                  updateSettings({
                    uiTheme: settings.uiTheme === "adwaita" ? "cupertino" : "adwaita",
                  })
                )
              }
            >
              <PaletteIcon className="size-4" />
              <span className="truncate font-medium">
                Switch Theme to{" "}
                {settings.uiTheme === "adwaita"
                  ? "Cupertino (macOS)"
                  : "Adwaita (GNOME)"}
              </span>
            </CommandItem>

            <CommandItem
              value="toggle dark light mode appearance theme"
              onSelect={() =>
                runAndClose(() =>
                  updateSettings({
                    themeMode: settings.themeMode === "dark" ? "light" : "dark",
                  })
                )
              }
            >
              {settings.themeMode === "dark" ? (
                <SunIcon className="size-4" />
              ) : (
                <MoonIcon className="size-4" />
              )}
              <span className="truncate font-medium">
                Switch to {settings.themeMode === "dark" ? "Light" : "Dark"} Appearance
              </span>
            </CommandItem>

            <CommandItem
              value="switch windows alt tab overview"
              onSelect={() => runAndClose(() => openAltTab())}
            >
              <LayersIcon className="size-4" />
              <span className="truncate font-medium">Open Window Switcher</span>
            </CommandItem>

            {focusedWindowId && (
              <>
                <CommandItem
                  value="tile window left snap half"
                  onSelect={() =>
                    runAndClose(() => tileWindow(focusedWindowId, "left"))
                  }
                >
                  <Columns2Icon className="size-4" />
                  <span className="truncate font-medium">Tile Focused Window to Left Half</span>
                </CommandItem>

                <CommandItem
                  value="tile window right snap half"
                  onSelect={() =>
                    runAndClose(() => tileWindow(focusedWindowId, "right"))
                  }
                >
                  <Columns2Icon className="size-4" />
                  <span className="truncate font-medium">Tile Focused Window to Right Half</span>
                </CommandItem>

                <CommandItem
                  value="maximize zoom focused window fullscreen"
                  onSelect={() =>
                    runAndClose(() => toggleMaximizeWindow(focusedWindowId))
                  }
                >
                  <Maximize2Icon className="size-4" />
                  <span className="truncate font-medium">Toggle Maximize Focused Window</span>
                </CommandItem>
              </>
            )}

            <CommandItem
              value="change wallpaper background desktop"
              onSelect={() =>
                runAndClose(() => launchApp("settings", { payload: "wallpaper" }))
              }
            >
              <PaletteIcon className="size-4" />
              <span className="truncate font-medium">Change Desktop Wallpaper</span>
            </CommandItem>

            <CommandItem
              value="configure dock magnification size"
              onSelect={() =>
                runAndClose(() => launchApp("settings", { payload: "dock" }))
              }
            >
              <SettingsIcon className="size-4" />
              <span className="truncate font-medium">Configure Dock & Menu Bar</span>
            </CommandItem>

            <CommandItem
              value="mute unmute sound audio volume"
              onSelect={() =>
                runAndClose(() => updateSettings({ muted: !settings.muted }))
              }
            >
              {settings.muted ? (
                <Volume2Icon className="size-4" />
              ) : (
                <VolumeXIcon className="size-4" />
              )}
              <span className="truncate font-medium">
                {settings.muted ? "Unmute System Audio" : "Mute System Audio"}
              </span>
            </CommandItem>

            <CommandItem
              value="send test notification toast"
              onSelect={() =>
                runAndClose(() =>
                  pushNotification({
                    appName: "Command Palette",
                    summary: "Test Notification Dispatched",
                    body: "Notifications appear in the right-side Menubar panel.",
                  })
                )
              }
            >
              <BellRingIcon className="size-4" />
              <span className="truncate font-medium">Send Test Notification</span>
            </CommandItem>

            <CommandItem
              value="lock screen session security"
              onSelect={() => runAndClose(() => lockSession())}
            >
              <LockIcon className="size-4" />
              <span className="truncate font-medium">Lock Session</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
