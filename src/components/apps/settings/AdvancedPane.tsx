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
import { Switch } from "@/components/ui/switch";
import {
  _,
  getLocalePreference,
  getSystemLocale,
  type LocalePreference,
  setLocale,
  subscribeLocale,
} from "@/lib/i18n";
import { cn } from "@/lib/utils";
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
              <div className="inline-flex rounded-lg bg-black/8 p-0.5 dark:bg-white/10">
                {(["pc", "mac"] as const).map((model) => {
                  const selected = settings.computerModel === model;
                  return (
                    <button
                      key={model}
                      type="button"
                      onClick={() => updateSettings({ computerModel: model })}
                      className={cn(
                        "rounded-md px-3 py-1 text-[12px] font-medium transition-all",
                        selected
                          ? "bg-white text-black shadow-xs dark:bg-white/16 dark:text-white"
                          : "text-adw-label-secondary hover:text-adw-label"
                      )}
                    >
                      {model === "mac" ? "Mac" : "PC"}
                    </button>
                  );
                })}
              </div>
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
    </GroupedForm>
  );
}

