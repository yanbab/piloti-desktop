import * as React from "react";
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
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
import { useSettings } from "@/context/DesktopStateContext";
import { useOptionalPlugins } from "@/context/PluginsContext";
import { ACCENT_COLORS } from "@/data/catalog";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";
import { useThrottledColor } from "./use-throttled-color";

export function AppearancePane() {
  const { settings, updateSettings } = useSettings();
  const accentColorPicker = useThrottledColor(
    settings.customAccentHex || "#3584e4",
    (hex) => updateSettings({ customAccentHex: hex })
  );
  const pluginsCtx = useOptionalPlugins();
  const themePlugins = React.useMemo(
    () => (pluginsCtx?.plugins ?? []).filter((p) => p.kind === "theme"),
    [pluginsCtx?.plugins]
  );
  const activeInterfaceTheme = settings.interfaceTheme || "piloti";

  const layoutRaw = (settings.windowButtonLayout ?? ":close").trim();
  const isLeftPlacement =
    layoutRaw.indexOf(":") > 0 && !layoutRaw.startsWith(":");
  const hasMinimize = layoutRaw.toLowerCase().includes("minimize");
  const hasMaximize = layoutRaw.toLowerCase().includes("maximize");

  const updateButtonLayout = (next: {
    left?: boolean;
    minimize?: boolean;
    maximize?: boolean;
  }) => {
    const useLeft = next.left ?? isLeftPlacement;
    const min = next.minimize ?? hasMinimize;
    const max = next.maximize ?? hasMaximize;
    const buttons = useLeft
      ? ["close", ...(min ? ["minimize"] : []), ...(max ? ["maximize"] : [])]
      : [...(min ? ["minimize"] : []), ...(max ? ["maximize"] : []), "close"];
    const joined = buttons.join(",");
    updateSettings({
      windowButtonLayout: useLeft ? `${joined}:` : `:${joined}`,
    });
  };

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Appearance")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Theme")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div data-slot="segmented" className="inline-flex flex-wrap items-center gap-1 rounded-adw-item bg-black/8 p-1 dark:bg-white/8">
                {[
                  { id: "piloti", label: _("Piloti (Animated)") },
                  { id: "adwaita", label: "Adwaita" },
                  ...themePlugins.map((p) => ({ id: p.id, label: p.name })),
                ].map((theme) => {
                  const active = activeInterfaceTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      data-slot="segmented-item"
                      onClick={() =>
                        updateSettings({
                          interfaceTheme: theme.id,
                          iconTheme: theme.id === "adwaita" ? "Adwaita" : "Piloti",
                        })
                      }
                      className={cn(
                        "rounded-adw-control px-2.5 py-1 text-adw-body font-medium transition-all",
                        active
                          ? "bg-white text-black dark:bg-white/18 dark:text-white"
                          : "text-adw-label-secondary hover:text-adw-label"
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
              <GroupedFormRowTitle>{_("Style")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div data-slot="segmented" className="inline-flex items-center gap-1 rounded-adw-item bg-black/8 p-1 dark:bg-white/8">
                {(
                  [
                    {
                      id: "system",
                      label: _("Auto"),
                      icon: <MonitorIcon className="size-3.5" />,
                    },
                    {
                      id: "light",
                      label: _("Light"),
                      icon: <SunIcon className="size-3.5" />,
                    },
                    {
                      id: "dark",
                      label: _("Dark"),
                      icon: <MoonIcon className="size-3.5" />,
                    },
                  ] as const
                ).map((mode) => {
                  const active = settings.themeMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      data-slot="segmented-item"
                      onClick={() => updateSettings({ themeMode: mode.id })}
                      className={cn(
                        "flex items-center gap-1.5 rounded-adw-control px-2.5 py-1 text-adw-body font-medium transition-all",
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

          <GroupedFormRow className="flex-wrap gap-3 py-3.5">
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Accent Color")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="w-full sm:w-auto">
              <div className="flex max-w-full flex-wrap items-center justify-start gap-2 sm:max-w-[260px] sm:justify-end">
                <label
                  title={_("Custom Accent Color")}
                  aria-label={_("Custom Accent Color")}
                  style={{
                    background: settings.customAccentHex
                      ? settings.customAccentHex
                      : "conic-gradient(#ff3b30, #ff9500, #ffcc00, #28cd41, #007aff, #af52de, #ff2d55, #ff3b30)",
                  }}
                  className={cn(
                    "relative flex size-[18px] cursor-pointer items-center justify-center overflow-hidden rounded-full ring-1 ring-white/25 transition-transform hover:scale-110",
                    Boolean(settings.customAccentHex) && "scale-110 ring-white/60"
                  )}
                >
                  <input
                    type="color"
                    value={accentColorPicker.draft}
                    onChange={(e) => accentColorPicker.onChange(e.target.value)}
                    onBlur={accentColorPicker.flush}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  {settings.customAccentHex && (
                    <span className="pointer-events-none size-1.5 rounded-full bg-white shadow-xs" />
                  )}
                </label>
                {ACCENT_COLORS.map((color) => {
                  const selected =
                    !settings.customAccentHex &&
                    settings.accentColor === color.id;
                  return (
                    <button
                      key={color.id}
                      type="button"
                      title={_(color.label)}
                      aria-label={_(color.label)}
                      onClick={() =>
                        updateSettings({
                          accentColor: color.id,
                          customAccentHex: "",
                        })
                      }
                      style={{ backgroundColor: color.cssVar }}
                      className={cn(
                        "flex size-[18px] items-center justify-center rounded-full ring-1 ring-white/25 transition-transform hover:scale-110",
                        selected && "scale-110 ring-white/60"
                      )}
                    >
                      {selected && (
                        <span className="size-1.5 rounded-full bg-white shadow-xs" />
                      )}
                    </button>
                  );
                })}
              </div>
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("High Contrast")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.highContrast}
                onCheckedChange={(checked) =>
                  updateSettings({ highContrast: checked })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Window Controls")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Minimize Button")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={hasMinimize}
                onCheckedChange={(checked) =>
                  updateButtonLayout({ minimize: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Maximize Button")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={hasMaximize}
                onCheckedChange={(checked) =>
                  updateButtonLayout({ maximize: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Window Menu")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={settings.showWindowMenu}
                onCheckedChange={(checked) =>
                  updateSettings({ showWindowMenu: Boolean(checked) })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Button Placement")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div data-slot="segmented" className="inline-flex items-center gap-1 rounded-adw-item bg-black/8 p-1 dark:bg-white/8">
                {(
                  [
                    { id: "left", label: _("Left"), left: true },
                    { id: "right", label: _("Right"), left: false },
                  ] as const
                ).map((opt) => {
                  const active = isLeftPlacement === opt.left;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      data-slot="segmented-item"
                      onClick={() => updateButtonLayout({ left: opt.left })}
                      className={cn(
                        "rounded-adw-control px-2.5 py-1 text-adw-body font-medium transition-all",
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
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Desktop")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Show Desktop Icons")}</GroupedFormRowTitle>
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
              <GroupedFormRowTitle>{_("Icon Alignment")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div data-slot="segmented" className="inline-flex items-center gap-1 rounded-adw-item bg-black/8 p-1 dark:bg-white/8">
                {(
                  [
                    { id: "left", label: _("Left") },
                    { id: "right", label: _("Right") },
                  ] as const
                ).map((opt) => {
                  const active = (settings.desktopIconAlign ?? "left") === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      data-slot="segmented-item"
                      onClick={() =>
                        updateSettings({
                          desktopIconAlign: opt.id,
                          desktopIconPositions: {},
                        })
                      }
                      className={cn(
                        "rounded-adw-control px-2.5 py-1 text-adw-body font-medium transition-all",
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

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Open Files & Folders")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div data-slot="segmented" className="inline-flex items-center gap-1 rounded-adw-item bg-black/8 p-1 dark:bg-white/8">
                {(
                  [
                    { id: "single", label: _("Single Click") },
                    { id: "double", label: _("Double Click") },
                  ] as const
                ).map((opt) => {
                  const active = settings.fileActivationMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      data-slot="segmented-item"
                      onClick={() => updateSettings({ fileActivationMode: opt.id })}
                      className={cn(
                        "rounded-adw-control px-2.5 py-1 text-adw-body font-medium transition-all",
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
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Effects")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Reduce Transparency")}</GroupedFormRowTitle>
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
              <GroupedFormRowTitle>{_("Reduce Motion")}</GroupedFormRowTitle>
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
