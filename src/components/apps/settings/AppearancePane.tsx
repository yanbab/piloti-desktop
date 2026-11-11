import { CheckIcon, MoonIcon, SparklesIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSettings, useWindowManager } from "@/context/DesktopStateContext";
import { ACCENT_COLORS } from "@/data/catalog";
import { cn } from "@/lib/utils";

export function AppearancePane() {
  const { settings, updateSettings } = useSettings();
  const { launchApp } = useWindowManager();

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>Theme & Appearance</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Desktop Theme</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Switch between Apple Cupertino and GNOME Adwaita design systems
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div className="inline-flex items-center gap-1 rounded-[9px] bg-black/8 p-1 dark:bg-white/8">
                {(
                  [
                    { id: "cupertino", label: "Cupertino" },
                    { id: "adwaita", label: "Adwaita" },
                  ] as const
                ).map((theme) => {
                  const active = settings.uiTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => updateSettings({ uiTheme: theme.id })}
                      className={cn(
                        "rounded-[6px] px-3 py-1 text-[13px] font-medium transition-all",
                        active
                          ? "bg-white text-black shadow-xs dark:bg-white/18 dark:text-white"
                          : "text-mac-label-secondary hover:text-mac-label"
                      )}
                    >
                      {theme.label}
                    </button>
                  );
                })}
              </div>
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Color Scheme</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Syncs with Domicile compositor and client GTK/Qt windows
              </GroupedFormRowDescription>
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
                    {
                      id: "system",
                      label: "Auto",
                      icon: <SparklesIcon className="size-3.5" />,
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
                          ? "bg-white text-black shadow-xs dark:bg-white/18 dark:text-white"
                          : "text-mac-label-secondary hover:text-mac-label"
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
              <GroupedFormRowTitle>
                {settings.uiTheme === "adwaita"
                  ? "Adwaita Accent Color"
                  : "Accent Color"}
              </GroupedFormRowTitle>
              <GroupedFormRowDescription>
                {settings.uiTheme === "adwaita"
                  ? "Official GNOME 47 / Libadwaita 1.6 AdwAccentColor palette"
                  : "Highlights buttons, menus, selection rings, and active controls"}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div className="flex max-w-[280px] flex-wrap items-center justify-end gap-2">
                {ACCENT_COLORS.filter((c) =>
                  settings.uiTheme === "adwaita" ? c.inAdwaita : true
                ).map((color) => {
                  const selected = settings.accentColor === color.id;
                  const swatchHex =
                    settings.uiTheme === "adwaita"
                      ? color.adwaitaHex
                      : color.hex;
                  const swatchLabel =
                    settings.uiTheme === "adwaita"
                      ? color.adwaitaLabel ?? color.label
                      : color.label;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      title={swatchLabel}
                      aria-label={swatchLabel}
                      onClick={() => updateSettings({ accentColor: color.id })}
                      style={{ backgroundColor: swatchHex }}
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

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Liquid Glass Vibrancy</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Allow wallpaper tinting in windows, Dock, and menus
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.windowTranslucency}
                onCheckedChange={(checked) =>
                  updateSettings({ windowTranslucency: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>
          Window Decorations (CSD & GNOME Apps)
        </GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow className="py-3.5">
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Titlebar &amp; Frame Mode</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Auto omits server titlebars on GNOME / GTK4 / Libadwaita apps (`clientFrame`) so their native `AdwHeaderBar` renders without duplication
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Select
                value={settings.windowDecorationMode}
                onValueChange={(val) => {
                  if (val === "auto" || val === "csd" || val === "ssd") {
                    updateSettings({ windowDecorationMode: val });
                  }
                }}
              >
                <SelectTrigger variant="borderless">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    Auto (Respect GNOME / Wayland CSD)
                  </SelectItem>
                  <SelectItem value="csd">
                    Always Client-Side Decorations (CSD)
                  </SelectItem>
                  <SelectItem value="ssd">
                    Force Server-Side Titlebars (SSD)
                  </SelectItem>
                </SelectContent>
              </Select>
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Launch GNOME Files (Nautilus)</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Opens native `nautilus` with Libadwaita `AdwHeaderBar`
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => launchApp("nautilus", { forceNew: true })}
              >
                Open Nautilus
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}
