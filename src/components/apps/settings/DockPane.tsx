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
import { useSettings } from "@/context/DesktopStateContext";
import { cn } from "@/lib/utils";

export function DockPane() {
  const { settings, updateSettings } = useSettings();

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>Dock Behavior & Size</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Position on Screen</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div className="flex items-center gap-0.5 rounded-lg bg-black/6 p-0.5 dark:bg-white/8">
                {(["left", "bottom", "right"] as const).map((pos) => {
                  const active = settings.dockPosition === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => updateSettings({ dockPosition: pos })}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[12px] capitalize",
                        active
                          ? "bg-adw-sidebar-selection font-medium text-adw-label"
                          : "text-adw-label-secondary active:bg-black/10 dark:active:bg-white/12"
                      )}
                    >
                      {pos}
                    </button>
                  );
                })}
              </div>
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Size</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="w-44">
              <Slider
                min={32}
                max={128}
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
              <GroupedFormRowTitle>Zoom</GroupedFormRowTitle>
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
                <GroupedFormRowTitle>Zoom Size</GroupedFormRowTitle>
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
                Automatically Hide and Show
              </GroupedFormRowTitle>
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
    </GroupedForm>
  );
}

