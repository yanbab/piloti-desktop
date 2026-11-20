import * as React from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  _,
  getLocalePreference,
  getSystemLocale,
  type LocalePreference,
  setLocale,
  subscribeLocale,
} from "@/lib/i18n";
import { useSettings } from "@/context/DesktopStateContext";

export function AdvancedPane() {
  const { settings, updateSettings } = useSettings();
  const [preference, setPreference] = React.useState<LocalePreference>(() =>
    getLocalePreference()
  );

  React.useEffect(() => {
    return subscribeLocale(() => {
      setPreference(getLocalePreference());
    });
  }, []);

  const systemLocale = getSystemLocale();
  const systemLanguageName = systemLocale === "fr" ? "Français" : "English";
  const defaultLabel = `${_("Default")} (${systemLanguageName})`;

  const languageItems = [
    { value: "default" as const, label: defaultLabel },
    { value: "en" as const, label: _("English") },
    { value: "fr" as const, label: _("French") },
  ];

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Advanced")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Language")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Select
                value={preference}
                items={languageItems}
                onValueChange={(val) => {
                  if (val === "default" || val === "en" || val === "fr") {
                    setLocale(val);
                    setPreference(getLocalePreference());
                  }
                }}
              >
                <SelectTrigger variant="borderless">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{defaultLabel}</SelectItem>
                  <SelectSeparator />
                  <SelectItem value="en">{_("English")}</SelectItem>
                  <SelectItem value="fr">{_("French")}</SelectItem>
                </SelectContent>
              </Select>
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Computer Model")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Select
                value={settings.computerModel}
                items={[
                  { value: "mac", label: "Mac" },
                  { value: "pc", label: "PC" },
                ]}
                onValueChange={(val) => {
                  if (val === "mac" || val === "pc") {
                    updateSettings({ computerModel: val });
                  }
                }}
              >
                <SelectTrigger variant="borderless">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mac">Mac</SelectItem>
                  <SelectItem value="pc">PC</SelectItem>
                </SelectContent>
              </Select>
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}

