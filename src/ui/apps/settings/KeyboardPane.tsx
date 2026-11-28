import * as React from "react";
import {
  GroupedForm,
  GroupedFormGroup,
  GroupedFormRow,
  GroupedFormRowControl,
  GroupedFormRowLabel,
  GroupedFormRowTitle,
  GroupedFormSection,
} from "@/ui/components/ui/grouped-form";
import { Segmented } from "@/ui/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { useDesktopSettings, useUpdateSettings } from "@/ui/context/DesktopStateContext";
import { _ } from "@/core/util/i18n";
import { CONFIG_LAYOUTS as LAYOUTS, useKeymaps } from "@/ui/hooks/keyboard";

export function KeyboardPane() {
  const settings = useDesktopSettings(["computerModel", "keyboardLayout"]);
  const updateSettings = useUpdateSettings();
  const { active } = useKeymaps();
  const layout = settings.keyboardLayout || active || "us";

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Keyboard language")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Select
                value={layout}
                onValueChange={(value) => updateSettings({ keyboardLayout: String(value) })}
              >
                <SelectTrigger aria-label={_("Keyboard language")}>
                  <SelectValue>
                    {_(LAYOUTS.find((l) => l.id === layout)?.label ?? layout)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LAYOUTS.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {_(l.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </GroupedFormRowControl>
          </GroupedFormRow>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Shortcut keys")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Segmented
                value={settings.computerModel}
                onChange={(computerModel) => updateSettings({ computerModel })}
                options={[
                  { id: "pc", label: "PC" },
                  { id: "mac", label: "Mac" },
                ]}
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}
