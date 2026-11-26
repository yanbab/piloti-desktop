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
import { useDesktopSettings, useUpdateSettings } from "@/context/DesktopStateContext";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";

export function DockPane() {
  const settings = useDesktopSettings(["dockAutoHide", "dockMagnification", "dockMagnificationSize", "dockPosition", "dockSize"]);
  const updateSettings = useUpdateSettings();
  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Dock Behavior & Size")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Position on Screen")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div className="flex items-center gap-0.5 rounded-ui-item bg-black/6 p-0.5 dark:bg-white/8">
                {(
                  [
                    { id: "left", label: _("Left") },
                    { id: "bottom", label: _("Bottom") },
                    { id: "right", label: _("Right") },
                  ] as const
                ).map((pos) => {
                  const active = settings.dockPosition === pos.id;
                  return (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => updateSettings({ dockPosition: pos.id })}
                      className={cn(
                        "rounded-ui-control px-2.5 py-1 text-ui-callout capitalize",
                        active
                          ? "bg-ui-sidebar-selection font-medium text-ui-label"
                          : "text-ui-label-secondary active:bg-black/10 dark:active:bg-white/12"
                      )}
                    >
                      {pos.label}
                    </button>
                  );
                })}
              </div>
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Size")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="w-44">
              <Slider
                min={18}
                max={96}
                value={[Math.max(18, Math.min(96, settings.dockSize))]}
                onValueChange={(val) => {
                  const next = Array.isArray(val) ? val[0] : val;
                  if (typeof next === "number")
                    updateSettings({ dockSize: Math.min(96, Math.max(18, next)) });
                }}
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Hide")}</GroupedFormRowTitle>
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

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Zoom")}</GroupedFormRowTitle>
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

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle
                className={cn(!settings.dockMagnification && "opacity-45")}
              >
                {_("Zoom Size")}
              </GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="w-44">
              <Slider
                disabled={!settings.dockMagnification}
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
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}

