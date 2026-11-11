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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/context/DesktopStateContext";

export function DockPane() {
  const { settings, updateSettings } = useSettings();

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>Dock Behavior & Size</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Icon Size ({settings.dockSize}px)</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Base size of application tiles in the bottom Dock
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="w-44">
              <Slider
                min={38}
                max={68}
                value={[settings.dockSize]}
                onValueChange={(val) => {
                  const next = Array.isArray(val) ? val[0] : val;
                  if (typeof next === "number") updateSettings({ dockSize: next });
                }}
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Magnification</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Enlarge Dock icons smoothly as the pointer approaches
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.dockMagnification}
                onCheckedChange={(checked) =>
                  updateSettings({ dockMagnification: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          {settings.dockMagnification && (
            <GroupedFormRow>
              <GroupedFormRowLabel>
                <GroupedFormRowTitle>
                  Magnified Size ({settings.dockMagnificationSize}px)
                </GroupedFormRowTitle>
              </GroupedFormRowLabel>
              <GroupedFormRowControl className="w-44">
                <Slider
                  min={56}
                  max={96}
                  value={[settings.dockMagnificationSize]}
                  onValueChange={(val) => {
                    const next = Array.isArray(val) ? val[0] : val;
                    if (typeof next === "number") {
                      updateSettings({ dockMagnificationSize: next });
                    }
                  }}
                />
              </GroupedFormRowControl>
            </GroupedFormRow>
          )}

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                Automatically Hide and Show the Dock
              </GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Slide the Dock away until the pointer touches the bottom edge
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.dockAutoHide}
                onCheckedChange={(checked) =>
                  updateSettings({ dockAutoHide: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>Top Menu Bar Clock</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Use 24-Hour Clock</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.clock24Hour}
                onCheckedChange={(checked) =>
                  updateSettings({ clock24Hour: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Display the Time with Seconds</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.clockShowSeconds}
                onCheckedChange={(checked) =>
                  updateSettings({ clockShowSeconds: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}

