import * as React from "react";
import { CheckIcon, MoonIcon, SunIcon } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/context/DesktopStateContext";
import { ACCENT_COLORS } from "@/data/catalog";
import { cn } from "@/lib/utils";
import { discoverInstalledIconThemes } from "@/lib/xdg-icon-theme";

export function AppearancePane() {
  const domicile = useDomicile();
  const { settings, updateSettings } = useSettings();
  const [installedIconThemes, setInstalledIconThemes] = React.useState<string[]>([
    "Adwaita",
  ]);

  React.useEffect(() => {
    let cancelled = false;
    void discoverInstalledIconThemes(domicile.files).then((themes) => {
      if (!cancelled && themes.length > 0) {
        setInstalledIconThemes(themes);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [domicile.files]);

  const iconThemeOptions = React.useMemo(() => {
    const set = new Set(installedIconThemes);
    if (settings.iconTheme) set.add(settings.iconTheme);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [installedIconThemes, settings.iconTheme]);

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>Appearance</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Style</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div className="inline-flex items-center gap-1 rounded-[9px] bg-black/8 p-1 dark:bg-white/8">
                {(
                  [
                    {
                      id: "light",
                      label: "Light",
                      icon: <SunIcon className="size-3.5" />,
                    },
                    {
                      id: "dark",
                      label: "Dark",
                      icon: <MoonIcon className="size-3.5" />,
                    },
                  ] as const
                ).map((mode) => {
                  const active = settings.themeMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => updateSettings({ themeMode: mode.id })}
                      className={cn(
                        "flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[13px] font-medium transition-all",
                        active
                          ? "bg-white text-black dark:bg-white/18 dark:text-white"
                          : "text-adw-label-secondary hover:text-adw-label"
                      )}
                    >
                      {mode.icon}
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow className="py-3.5">
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Accent Color</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div className="flex max-w-[280px] flex-wrap items-center justify-end gap-2">
                {ACCENT_COLORS.map((color) => {
                  const selected = settings.accentColor === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      title={color.label}
                      aria-label={color.label}
                      onClick={() => updateSettings({ accentColor: color.id })}
                      style={{ backgroundColor: color.hex }}
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full shadow-inner transition-transform hover:scale-110",
                        selected &&
                        "scale-110 ring-2 ring-white ring-offset-2 ring-offset-zinc-900"
                      )}
                    >
                      {selected && (
                        <CheckIcon
                          className="size-3 text-white drop-shadow-xs"
                          strokeWidth={3}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </GroupedFormRowControl>
          </GroupedFormRow>

          {/* <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Icon Theme</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Select
                value={settings.iconTheme || "Adwaita"}
                onValueChange={(val) => {
                  if (val) updateSettings({ iconTheme: val });
                }}
              >
                <SelectTrigger variant="borderless">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {iconThemeOptions.map((themeName) => (
                    <SelectItem key={themeName} value={themeName}>
                      {themeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </GroupedFormRowControl>
          </GroupedFormRow> */}


        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>Desktop</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Show Desktop Icons</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.desktopIconsEnabled}
                onCheckedChange={(checked) =>
                  updateSettings({ desktopIconsEnabled: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Open Files &amp; Folders</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div className="inline-flex items-center gap-1 rounded-[9px] bg-black/8 p-1 dark:bg-white/8">
                {(
                  [
                    { id: "single", label: "Single Click" },
                    { id: "double", label: "Double Click" },
                  ] as const
                ).map((opt) => {
                  const active = settings.fileActivationMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateSettings({ fileActivationMode: opt.id })}
                      className={cn(
                        "rounded-[6px] px-2.5 py-1 text-[13px] font-medium transition-all",
                        active
                          ? "bg-white text-black dark:bg-white/18 dark:text-white"
                          : "text-adw-label-secondary hover:text-adw-label"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </GroupedFormRowControl>
          </GroupedFormRow>
          {/* 
          {settings.desktopIconsEnabled &&
            Object.keys(settings.desktopIconPositions).length > 0 && (
              <GroupedFormRow>
                <GroupedFormRowLabel>
                  <GroupedFormRowTitle>Reset Icon Layout</GroupedFormRowTitle>
                </GroupedFormRowLabel>
                <GroupedFormRowControl>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => updateSettings({ desktopIconPositions: {} })}
                  >
                    Reset Positions
                  </Button>
                </GroupedFormRowControl>
              </GroupedFormRow>
            )} 
             */}


        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>Effects</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Reduce Transparency</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={!settings.moreTransparency}
                onCheckedChange={(checked) =>
                  updateSettings({ moreTransparency: !Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Reduce Motion</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.reduceMotion}
                onCheckedChange={(checked) =>
                  updateSettings({ reduceMotion: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}
