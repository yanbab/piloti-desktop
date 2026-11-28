import {
  GroupedForm,
  GroupedFormGroup,
  GroupedFormRow,
  GroupedFormRowControl,
  GroupedFormRowLabel,
  GroupedFormRowTitle,
  GroupedFormSection,
  GroupedFormSectionTitle,
} from "@/ui/components/ui/grouped-form";
import { Switch } from "@/ui/components/ui/switch";
import { useDesktopSettings, useUpdateSettings } from "@/ui/context/DesktopStateContext";
import { _ } from "@/core/util/i18n";

export function TopBarPane() {
  const settings = useDesktopSettings(["clock24Hour", "clockShowDate", "clockShowDay", "showBatteryPercentage"]);
  const updateSettings = useUpdateSettings();
  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Clock & Date")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Use 24-Hour Clock")}</GroupedFormRowTitle>
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
              <GroupedFormRowTitle>{_("Show Day of Week")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.clockShowDay}
                onCheckedChange={(checked) =>
                  updateSettings({ clockShowDay: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Show Date")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.clockShowDate}
                onCheckedChange={(checked) =>
                  updateSettings({ clockShowDate: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Control Panel & Status")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Show Battery Percentage")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.showBatteryPercentage}
                onCheckedChange={(checked) =>
                  updateSettings({ showBatteryPercentage: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}

