import * as React from "react";
import {
  GroupedForm,
  GroupedFormGroup,
  GroupedFormRow,
  GroupedFormRowControl,
  GroupedFormRowLabel,
  GroupedFormRowTitle,
  GroupedFormSection,
} from "@/components/ui/grouped-form";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/context/DesktopStateContext";
import { _ } from "@/lib/core/i18n";
import { useKeymaps } from "@/lib/engine/keyboard";

/** The layouts the shipped compositor config names. */
const LAYOUTS = [
  { id: "fr", label: "French" },
  { id: "us", label: "English (US)" },
];

export function KeyboardPane() {
  const { settings, updateSettings } = useSettings();
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
