import * as React from "react";
import { useCapabilities } from "@/hooks/use-capabilities";
import { useDisplays } from "@domicile-desktop/react/displays";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import { Button } from "@/components/ui/button";
import {
  GroupedForm,
  GroupedFormGroup,
  GroupedFormRow,
  GroupedFormRowControl,
  GroupedFormRowLabel,
  GroupedFormRowTitle,
  GroupedFormSection,
  GroupedFormSectionTitle,
} from "@/components/ui/grouped-form";
import {
  useSettings,
  useSystemBackends,
} from "@/context/DesktopStateContext";
import { _ } from "@/lib/core/i18n";
import {
  ComputerHardwareIllustration,
  MonitorHardwareIllustration,
} from "@/components/shell/AboutComputerDialog";
import { DesktopBackgroundLayers } from "@/components/shell/DesktopBackgroundLayers";

/** What the header and list show for one screen. */
interface ScreenEntry {
  name: string;
  resolution: string;
  kind: "laptop" | "monitor";
}

/** The web demo adds a pretend external screen, to show a two-screen setup. */
const DEMO_EXTERNAL_SCREEN: ScreenEntry = {
  name: "Studio Display",
  resolution: "2560 × 1440",
  kind: "monitor",
};

export function DisplaysPane() {
  const domicile = useDomicile();
  const displays = useDisplays() ?? [];
  const { settings, updateSettings } = useSettings();
  const { systemServices } = useCapabilities();
  const { pushNotification } = useSystemBackends();
  const [addingVirtual, setAddingVirtual] = React.useState(false);

  const screens: ScreenEntry[] = [
    ...displays.map((d, idx) => ({
      name: d.name,
      resolution: `${d.modeWidth || d.width} × ${d.modeHeight || d.height}`,
      kind: (idx === 0 ? "laptop" : "monitor") as ScreenEntry["kind"],
    })),
    ...(systemServices ? [] : [DEMO_EXTERNAL_SCREEN]),
  ];

  const handleAddVirtualDisplay = async () => {
    if (!systemServices) {
      pushNotification({
        appName: _("Displays"),
        summary: _("Virtual Display (Cast Mode)"),
        body: _(
          "Under Domicile Linux, creates a headless 1920×1080 virtual monitor for TV casting."
        ),
      });
      return;
    }
    setAddingVirtual(true);
    try {
      const res = await domicile.displays.addVirtual({
        name: "Cast-1080p",
        width: 1920,
        height: 1080,
        refreshMhz: 60000,
        scale: 1,
      });
      res.match({
        Ok: (vm) => {
          pushNotification({
            appName: _("Displays"),
            summary: `${_("Virtual Display Added")} (${vm.output})`,
            body: _("1920×1080 @ 60Hz ready for casting."),
          });
        },
        Err: (err) => {
          pushNotification({
            appName: _("Displays"),
            summary: _("Virtual Display Unavailable"),
            body: err.message,
          });
        },
      });
    } finally {
      setAddingVirtual(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Same header strip as Wallpaper: each screen with its wallpaper. */}
      <div
        data-slot="displays-preview"
        className="flex shrink-0 items-end justify-center gap-8 border-b border-adw-separator bg-adw-window/60 px-6 pt-3 pb-4"
      >
        {screens.map((screen) => {
          const Illustration =
            screen.kind === "laptop" ? ComputerHardwareIllustration : MonitorHardwareIllustration;
          return (
            <div key={screen.name} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
              <Illustration
                className="h-24 w-38 shrink-0 drop-shadow-md"
                screenContent={<DesktopBackgroundLayers />}
              />
              <div className="flex min-w-0 flex-col">
                <span className="max-w-44 truncate text-adw-body font-semibold text-adw-label">
                  {screen.name}
                </span>
                <span className="text-adw-footnote tabular-nums text-adw-label-secondary">
                  {screen.resolution}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>
          {_("Connected & Virtual Displays")} ({screens.length})
        </GroupedFormSectionTitle>
        <GroupedFormGroup>
          {screens.map((d, idx) => (
            <GroupedFormRow key={d.name}>
              <GroupedFormRowLabel>
                <GroupedFormRowTitle className="font-semibold">
                  {d.name}
                </GroupedFormRowTitle>
              </GroupedFormRowLabel>
              <GroupedFormRowControl>
                <span className="rounded-full bg-adw-accent/15 px-2.5 py-0.5 text-adw-subheadline font-semibold text-adw-accent">
                  {idx === 0 ? _("Primary Output") : _("Extended")}
                </span>
              </GroupedFormRowControl>
            </GroupedFormRow>
          ))}

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Add Virtual Cast Monitor")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Button
                size="sm"
                variant="secondary"
                disabled={addingVirtual}
                onClick={() => void handleAddVirtualDisplay()}
              >
                {addingVirtual ? _("Adding…") : _("Add 1080p Virtual")}
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Workspaces")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                {_("Dynamic Workspaces")} ({settings.workspaceCount})
              </GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={settings.workspaceCount <= 1}
                onClick={() =>
                  updateSettings({
                    workspaceCount: Math.max(1, settings.workspaceCount - 1),
                    activeWorkspace: Math.min(
                      settings.activeWorkspace,
                      Math.max(1, settings.workspaceCount - 1)
                    ),
                  })
                }
              >
                -
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={settings.workspaceCount >= 8}
                onClick={() =>
                  updateSettings({
                    workspaceCount: Math.min(8, settings.workspaceCount + 1),
                  })
                }
              >
                +
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
      </div>
    </div>
  );
}

