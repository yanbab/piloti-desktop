import { PilotiLogo } from "@/components/shell/PilotiLogo";
import { Button } from "@/components/ui/button";
import {
  GroupedForm,
  GroupedFormGroup,
  GroupedFormRow,
  GroupedFormRowControl,
  GroupedFormRowDescription,
  GroupedFormRowLabel,
  GroupedFormRowTitle,
  GroupedFormSection,
  GroupedFormSectionTitle,
} from "@/components/ui/grouped-form";
import { Switch } from "@/components/ui/switch";
import {
  useSettings,
  useSystemBackends,
  useWindowManager,
} from "@/context/DesktopStateContext";
import { DEFAULT_HIDDEN_GNOME_PANELS } from "@/lib/gnome-bridge";

export function AboutPane() {
  const { isBrowserRuntime, settings, updateSettings } = useSettings();
  const { availableGnomePanels, gnomeCapabilities } = useSystemBackends();
  const { openGnomeSettings } = useWindowManager();

  const hiddenSet = new Set(settings.hiddenGnomePanels);
  const enabledCount = availableGnomePanels.filter(
    (panel) => !hiddenSet.has(panel.desktopId)
  ).length;
  const isDefaultFilter =
    settings.hiddenGnomePanels.length === DEFAULT_HIDDEN_GNOME_PANELS.length &&
    DEFAULT_HIDDEN_GNOME_PANELS.every((id) => hiddenSet.has(id));

  const setPanelEnabled = (desktopId: string, enabled: boolean) => {
    const next = enabled
      ? settings.hiddenGnomePanels.filter((id) => id !== desktopId)
      : Array.from(new Set([...settings.hiddenGnomePanels, desktopId]));
    updateSettings({ hiddenGnomePanels: next });
  };

  return (
    <GroupedForm>
      <GroupedFormSection>
        <div className="flex items-center gap-4 rounded-[16px] border border-mac-separator bg-mac-group p-4">
          <PilotiLogo className="size-16 drop-shadow-md" />
          <div>
            <h3 className="text-[16px] font-bold">
              Piloti Desktop Environment
            </h3>
            <p className="text-[12px] text-mac-label-secondary">
              Version 1.0.0 · Built on Domicile Wayland Compositor &amp; CupertinoUI / Adwaita
            </p>
          </div>
        </div>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>
          GNOME Stack &amp; Control Center
        </GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Two-Way GSettings / dconf Sync</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Syncs color scheme, Adwaita accent color, clock format, and icon theme with `org.gnome.desktop.interface`
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.syncGnomeSettings}
                onCheckedChange={(checked) =>
                  updateSettings({ syncGnomeSettings: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                Prefer Native `gnome-control-center`
              </GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Launches GNOME Settings with `XDG_CURRENT_DESKTOP=GNOME` when opening Settings on Linux
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.preferGnomeControlCenter}
                onCheckedChange={(checked) =>
                  updateSettings({ preferGnomeControlCenter: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow className="py-3">
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>GNOME Settings Panels</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Detected:{" "}
                {[
                  gnomeCapabilities.gnomeControlCenter && "gnome-control-center",
                  gnomeCapabilities.gsettings && "gsettings",
                  gnomeCapabilities.pipewire && "PipeWire",
                  gnomeCapabilities.networkManager && "NetworkManager",
                  gnomeCapabilities.powerProfiles && "power-profiles-daemon",
                ]
                  .filter(Boolean)
                  .join(" · ") ||
                  (isBrowserRuntime ? "Browser Harness" : "Probing…")}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div className="flex flex-wrap justify-end gap-1.5">
                {(
                  [
                    { id: "wifi", label: "Wi-Fi" },
                    { id: "bluetooth", label: "Bluetooth" },
                    { id: "sound", label: "Sound" },
                    { id: "power", label: "Power" },
                    { id: "printers", label: "Printers" },
                    { id: "users", label: "Users" },
                  ] as const
                ).map((p) => {
                  const isHidden = hiddenSet.has(`gnome-${p.id}-panel.desktop`);
                  return (
                    <Button
                      key={p.id}
                      size="sm"
                      variant="secondary"
                      disabled={isHidden}
                      title={
                        isHidden
                          ? `${p.label} is hidden in Available GNOME Settings Panels below`
                          : `Open ${p.label} in GNOME Settings`
                      }
                      onClick={() => openGnomeSettings(p.id)}
                      className="h-7 px-2.5 text-[11px]"
                    >
                      {p.label}
                    </Button>
                  );
                })}
              </div>
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>
          Available GNOME Settings Panels ({enabledCount}/
          {availableGnomePanels.length})
        </GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow className="py-3">
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Filter Panels Shown in GNOME Settings</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Disabled panels write isolated `Hidden=true` stubs to{" "}
                <code className="font-mono text-[11px]">
                  ~/.local/share/piloti-gcc/applications
                </code>{" "}
                so normal GNOME sessions are untouched.
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isDefaultFilter}
                  onClick={() =>
                    updateSettings({
                      hiddenGnomePanels: [...DEFAULT_HIDDEN_GNOME_PANELS],
                    })
                  }
                  className="h-7 px-2.5 text-[11px]"
                >
                  Reset Defaults
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => openGnomeSettings()}
                  className="h-7 px-2.5 text-[11px]"
                >
                  Open GNOME Settings…
                </Button>
              </div>
            </GroupedFormRowControl>
          </GroupedFormRow>

          {availableGnomePanels.map((panel) => {
            const isEnabled = !hiddenSet.has(panel.desktopId);
            return (
              <GroupedFormRow key={panel.desktopId}>
                <GroupedFormRowLabel>
                  <GroupedFormRowTitle className="flex items-center gap-2">
                    <span>{panel.name}</span>
                    {panel.mutterOnly && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        Mutter-only
                      </span>
                    )}
                  </GroupedFormRowTitle>
                  <GroupedFormRowDescription>
                    {panel.comment
                      ? `${panel.comment} · ${panel.desktopId}`
                      : panel.desktopId}
                  </GroupedFormRowDescription>
                </GroupedFormRowLabel>
                <GroupedFormRowControl>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) =>
                      setPanelEnabled(panel.desktopId, Boolean(checked))
                    }
                  />
                </GroupedFormRowControl>
              </GroupedFormRow>
            );
          })}
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>Keyboard Shortcuts</GroupedFormSectionTitle>
        <GroupedFormGroup>
          {[
            {
              key: "Alt + Space",
              desc: "Open Command Palette (Apps, Windows, System Actions)",
            },
            { key: "Alt + Tab", desc: "Open Window Switcher with Live Previews" },
            { key: "Print", desc: "Take Interactive Screenshot (Area / Window)" },
            { key: "Meta + Return", desc: "Launch Terminal (`kitty`)" },
            { key: "Alt + ,", desc: "Open System Settings" },
            {
              key: "Alt + N",
              desc: "Toggle Right-Side Notifications & Quick Settings Panel",
            },
            {
              key: "Alt + [  /  Alt + ]",
              desc: "Tile Focused Window to Left / Right Half",
            },
            { key: "Alt + F", desc: "Zoom / Maximize Focused Window" },
            { key: "Alt + M", desc: "Minimize Focused Window into Dock" },
            { key: "Alt + W", desc: "Close Focused Window" },
          ].map((item) => (
            <GroupedFormRow key={item.key}>
              <GroupedFormRowLabel>
                <GroupedFormRowTitle>{item.desc}</GroupedFormRowTitle>
              </GroupedFormRowLabel>
              <GroupedFormRowControl>
                <code className="rounded-md bg-black/8 px-2 py-0.5 font-mono text-[11px] font-semibold dark:bg-white/12">
                  {item.key}
                </code>
              </GroupedFormRowControl>
            </GroupedFormRow>
          ))}
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}

