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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useSettings, useSystemBackends } from "@/context/DesktopStateContext";

export function DisplaysPane() {
  const domicile = useDomicile();
  const displays = useDisplays() ?? [];
  const { isBrowserRuntime, settings, updateSettings } = useSettings();
  const { pushNotification } = useSystemBackends();
  const [addingVirtual, setAddingVirtual] = React.useState(false);

  const handleAddVirtualDisplay = async () => {
    if (isBrowserRuntime) {
      pushNotification({
        appName: "Displays",
        summary: "Virtual Display (Cast Mode)",
        body: "Under Domicile Linux, creates a headless 1920×1080 virtual monitor for TV casting.",
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
            appName: "Displays",
            summary: `Virtual Display Added (${vm.output})`,
            body: "1920×1080 @ 60Hz ready for casting.",
          });
        },
        Err: (err) => {
          pushNotification({
            appName: "Displays",
            summary: "Virtual Display Unavailable",
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
          Connected & Virtual Displays ({displays.length})
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
                <span className="rounded-full bg-adw-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-adw-accent">
                  {idx === 0 ? "Primary Output" : "Extended"}
                </span>
              </GroupedFormRowControl>
            </GroupedFormRow>
          ))}

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Add Virtual Cast Monitor</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Button
                size="sm"
                variant="secondary"
                disabled={addingVirtual}
                onClick={() => void handleAddVirtualDisplay()}
              >
                {addingVirtual ? "Adding…" : "Add 1080p Virtual"}
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>Brightness & Color</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                Brightness ({settings.brightness}%)
              </GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="w-48">
              <Slider
                min={25}
                max={100}
                value={[settings.brightness]}
                onValueChange={(val) => {
                  const next = Array.isArray(val) ? val[0] : val;
                  if (typeof next === "number") {
                    updateSettings({ brightness: next });
                  }
                }}
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Night Light</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.nightLight}
                onCheckedChange={(checked) =>
                  updateSettings({ nightLight: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}

