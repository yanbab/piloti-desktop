import * as React from "react";
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

export function DisplaysPane() {
  const domicile = useDomicile();
  const displays = useDisplays() ?? [];
  const { isBrowserRuntime, settings, updateSettings } = useSettings();
  const { pushNotification } = useSystemBackends();
  const [addingVirtual, setAddingVirtual] = React.useState(false);

  const handleAddVirtualDisplay = async () => {
    if (isBrowserRuntime) {
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
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>
          {_("Connected & Virtual Displays")} ({displays.length})
        </GroupedFormSectionTitle>
        <GroupedFormGroup>
          {displays.map((d, idx) => (
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
  );
}

