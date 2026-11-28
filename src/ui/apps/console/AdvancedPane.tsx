import { PortalTestButtons } from "@/ui/components/elements/portal-test-buttons";
import { hostFiles } from "@/core/files/host-files";
import { VFS_HOME } from "@/core/state/vfs-home";
import * as React from "react";
import { useCapabilities } from "@/ui/hooks/use-capabilities";
import { usePiloti } from "@/platform/shared/piloti";
import { UsbIcon } from "@/ui/components/ui/symbols";
import {
  useSystemBackends,
  useWindowActions,
  useDesktopSettings,
  useUpdateSettings,
} from "@/ui/context/DesktopStateContext";
import {
  setXdgAppBadgeCount,
  setXdgAppProgress,
  setXdgAppUrgent,
} from "@/core/xdg/xdg-badge-count";
import { Button } from "@/ui/components/ui/button";
import {
  GroupedForm,
  GroupedFormExpanderRow,
  GroupedFormGroup,
  GroupedFormRow,
  GroupedFormRowControl,
  GroupedFormRowDescription,
  GroupedFormRowLabel,
  GroupedFormRowTitle,
  GroupedFormSection,
  GroupedFormSectionTitle,
} from "@/ui/components/ui/grouped-form";
import { Switch } from "@/ui/components/ui/switch";
import { _ } from "@/core/util/i18n";
import { DEFAULT_HIDDEN_GNOME_PANELS } from "@/core/system/gnome-panels";
import {
  buildAutostartOverrideDesktopContent,
  mergeAutostartEntries,
  parseAutostartDesktopFile,
  type XdgAutostartEntry,
} from "@/core/xdg/xdg-autostart";
import { WEB_VFS_HOME } from "@/core/files/vfs-paths";
import {
  SIMULATED_USB_PATH,
  toggleSimulatedUsb,
  useSimulatedUsbMounted,
} from "@/core/ports/demo-usb";

export function AdvancedPane() {
  const progressDemoTimerRef = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearInterval(progressDemoTimerRef.current), []);
  const piloti = usePiloti();
  const settings = useDesktopSettings(["activeWorkspace", "debugMode", "dockFolders", "hiddenGnomePanels", "notificationsEnabled", "remoteDevtools", "showFileExtensionBadges", "volume"]);
  const updateSettings = useUpdateSettings();
  const { systemServices, compositor } = useCapabilities();
  const usbMounted = useSimulatedUsbMounted();
  const { launchApp, openWebUrl } = useWindowActions();
  const { pushNotification } = useSystemBackends();
  const [autostartEntries, setAutostartEntries] = React.useState<XdgAutostartEntry[]>([]);
  const [startupExpanded, setStartupExpanded] = React.useState(false);

  const loadAutostart = React.useCallback(async () => {
    const userDir = `${WEB_VFS_HOME}/.config/autostart`;
    if (!systemServices) {
      const userFiles = ((await piloti.vfs.list(userDir)) ?? []).filter(
        (e) => e.kind === "file" && e.name.endsWith(".desktop")
      );
      const parsed = (
        await Promise.all(
          userFiles.map(async (e) =>
            parseAutostartDesktopFile(e.name, e.path, (await piloti.vfs.readText(e.path)) ?? "", "user")
          )
        )
      ).filter((x): x is XdgAutostartEntry => Boolean(x));
      setAutostartEntries(mergeAutostartEntries([], parsed));
      return;
    }
    const readDirEntries = async (dir: string, source: "user" | "system") => {
      const list = await hostFiles(piloti).readDir(dir).then((r) =>
        r.match({ Ok: (items) => items, Err: () => [] })
      );
      const out: XdgAutostartEntry[] = [];
      for (const item of list) {
        if (!item.name.endsWith(".desktop")) continue;
        const full = `${dir}/${item.name}`;
        const raw = await hostFiles(piloti).readText(full).then((r) =>
          r.match({ Ok: (txt) => txt, Err: () => "" })
        );
        const parsed = parseAutostartDesktopFile(item.name, full, raw, source);
        if (parsed) out.push(parsed);
      }
      return out;
    };
    const [sys, usr] = await Promise.all([
      readDirEntries("/etc/xdg/autostart", "system"),
      readDirEntries(".config/autostart", "user"),
    ]);
    setAutostartEntries(mergeAutostartEntries(sys, usr));
  }, [piloti, systemServices]);

  React.useEffect(() => {
    void loadAutostart();
  }, [loadAutostart]);

  const toggleAutostart = React.useCallback(
    async (entry: XdgAutostartEntry, enabled: boolean) => {
      const content = buildAutostartOverrideDesktopContent(entry, enabled);
      if (!systemServices) {
        const dir = `${WEB_VFS_HOME}/.config/autostart`;
        await piloti.vfs.createDir(dir);
        await piloti.vfs.write(`${dir}/${entry.id}`, content);
      } else {
        await hostFiles(piloti).createDir(".config/autostart");
        await hostFiles(piloti).write(
          `.config/autostart/${entry.id}`,
          new TextEncoder().encode(content)
        );
      }
      await loadAutostart();
    },
    [piloti, systemServices, loadAutostart]
  );

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("General")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Restart Piloti")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Button type="button" size="sm" variant="secondary" onClick={() => window.location.reload()}>
                {_("Restart")}
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Debug mode")}</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                {_("Show the desktop as it loads, to profile startup")}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.debugMode}
                onCheckedChange={(checked) => updateSettings({ debugMode: Boolean(checked) })}
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Remote DevTools")}</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                {_("Expose Chrome DevTools on localhost:9222 on next login")}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!settings.remoteDevtools}
                onClick={() => openWebUrl("chrome://inspect")}
              >
                {_("Inspect")}
              </Button>
              <Switch
                checked={settings.remoteDevtools}
                onCheckedChange={(checked) => updateSettings({ remoteDevtools: Boolean(checked) })}
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("File Extension Badges")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.showFileExtensionBadges !== false}
                onCheckedChange={(checked) =>
                  updateSettings({ showFileExtensionBadges: checked })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Startup services")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormExpanderRow
            title={_("Autostart entries")}
            description={
              autostartEntries.length === 0
                ? _("No XDG autostart entries")
                : _("%d entries", autostartEntries.length)
            }
            expanded={startupExpanded}
            onToggle={() => setStartupExpanded((v) => !v)}
          />
          {startupExpanded &&
            (autostartEntries.length === 0 ? (
              <GroupedFormRow>
                <GroupedFormRowLabel>
                  <GroupedFormRowTitle>{_("No XDG autostart entries")}</GroupedFormRowTitle>
                  <GroupedFormRowDescription>
                    {_("Entries in ~/.config/autostart/*.desktop and /etc/xdg/autostart appear here.")}
                  </GroupedFormRowDescription>
                </GroupedFormRowLabel>
              </GroupedFormRow>
            ) : (
              autostartEntries.map((entry) => (
                <GroupedFormRow key={entry.id}>
                  <GroupedFormRowLabel>
                    <GroupedFormRowTitle>{entry.name}</GroupedFormRowTitle>
                    <GroupedFormRowDescription>
                      {entry.comment || entry.exec || entry.id}
                    </GroupedFormRowDescription>
                  </GroupedFormRowLabel>
                  <GroupedFormRowControl>
                    <Switch
                      checked={entry.enabled}
                      onCheckedChange={(checked) =>
                        void toggleAutostart(entry, Boolean(checked))
                      }
                    />
                  </GroupedFormRowControl>
                </GroupedFormRow>
              ))
            ))}
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Portals")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <PortalTestButtons />
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Testing")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Full GNOME Settings")}</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                {_(
                  "Show all GNOME Control Center panels instead of hiding panels already managed by Piloti Settings."
                )}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                aria-label={_("Full GNOME Settings")}
                checked={settings.hiddenGnomePanels.length === 0}
                onCheckedChange={(checked) =>
                  updateSettings({
                    hiddenGnomePanels: checked
                      ? []
                      : [...DEFAULT_HIDDEN_GNOME_PANELS],
                  })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Runtime Engine")}</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                {_("Active engine: %s.", compositor ? "engine:native" : "engine:web")}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Simulated USB Pen Drive")}</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                {usbMounted
                  ? _("Mounted at %s", SIMULATED_USB_PATH)
                  : _("Simulate plugging in a removable USB flash drive")}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Button
                type="button"
                size="sm"
                variant={usbMounted ? "outline" : "default"}
                className="gap-1.5"
                onClick={toggleSimulatedUsb}
              >
                <UsbIcon className="size-3.5" />
                {usbMounted ? _("Eject USB Drive") : _("Mount USB Drive")}
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Send Test Notification")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={!settings.notificationsEnabled}
                onClick={() =>
                  pushNotification({
                    appName: "Piloti System",
                    summary: "Wayland Compositor Synced",
                    body: `Workspace ${settings.activeWorkspace} active · Volume ${settings.volume}%`,
                    actions: [
                      {
                        key: "notifications-settings",
                        label: "Notification Settings",
                      },
                    ],
                  })
                }
              >
                {_("Normal")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!settings.notificationsEnabled}
                onClick={() =>
                  pushNotification({
                    appName: "System Monitor",
                    summary: "Critical Battery / Alert Preview",
                    body: "Urgent notifications stay pinned until you dismiss them.",
                    urgency: "critical",
                  })
                }
              >
                {_("Urgent")}
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Dock Badge & Progress")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const count = Math.floor(Math.random() * 9) + 1;
                  setXdgAppBadgeCount("app-store", count);
                }}
              >
                {_("Badge")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  // One demo run at a time; cleared on unmount.
                  window.clearInterval(progressDemoTimerRef.current);
                  let p = 0;
                  progressDemoTimerRef.current = window.setInterval(() => {
                    p += 0.1;
                    if (p >= 1) {
                      window.clearInterval(progressDemoTimerRef.current);
                      setXdgAppProgress("app-store", undefined);
                    } else {
                      setXdgAppProgress("app-store", p);
                    }
                  }, 120);
                }}
              >
                {_("Progress")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setXdgAppProgress("app-store", null);
                  window.setTimeout(() => setXdgAppProgress("app-store", undefined), 2200);
                }}
              >
                {_("Indeterminate")}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setXdgAppUrgent("app-store", true)}
              >
                {_("Attention")}
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Dock Folder Stack")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const current = settings.dockFolders ?? [];
                  const testFolder = `${VFS_HOME}/Documents`;
                  if (!current.includes(testFolder)) {
                    updateSettings({ dockFolders: [...current, testFolder] });
                  }
                }}
              >
                {_("Dock Documents")}
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}

