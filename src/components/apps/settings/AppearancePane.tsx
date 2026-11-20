import * as React from "react";
import { CheckIcon, MoonIcon, SunIcon } from "lucide-react";
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
import { ACCENT_COLORS } from "@/data/catalog";
import { _ } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function AppearancePane() {
  const { settings, updateSettings } = useSettings();

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
              <GroupedFormRowTitle>{_("Style")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div className="inline-flex items-center gap-1 rounded-[9px] bg-black/8 p-1 dark:bg-white/8">
                {(
                  [
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

          <GroupedFormRow className="flex-wrap gap-3 py-3.5">
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Accent Color")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="w-full sm:w-auto">
              <div className="flex max-w-full flex-wrap items-center justify-start gap-2 sm:max-w-[280px] sm:justify-end">
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
                <label
                  title={_("Custom Accent Color")}
                  aria-label={_("Custom Accent Color")}
                  style={{
                    background: settings.customAccentHex
                      ? settings.customAccentHex
                      : "conic-gradient(#ef4444, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)",
                  }}
                  className={cn(
                    "relative flex size-5 cursor-pointer items-center justify-center overflow-hidden rounded-full shadow-inner transition-transform hover:scale-110",
                    Boolean(settings.customAccentHex) &&
                      "scale-110 ring-2 ring-white ring-offset-2 ring-offset-zinc-900"
                  )}
                >
                  <input
                    type="color"
                    value={settings.customAccentHex || "#3584e4"}
                    onChange={(e) =>
                      updateSettings({ customAccentHex: e.target.value })
                    }
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  {settings.customAccentHex && (
                    <CheckIcon
                      className="pointer-events-none size-3 text-white drop-shadow-xs"
                      strokeWidth={3}
                    />
                  )}
                </label>
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
              <GroupedFormRowTitle>{_("Button Placement")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div className="inline-flex items-center gap-1 rounded-[9px] bg-black/8 p-1 dark:bg-white/8">
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
                      onClick={() => updateButtonLayout({ left: opt.left })}
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
              <div className="inline-flex items-center gap-1 rounded-[9px] bg-black/8 p-1 dark:bg-white/8">
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
                      onClick={() =>
                        updateSettings({
                          desktopIconAlign: opt.id,
                          desktopIconPositions: {},
                        })
                      }
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

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Open Files & Folders")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div className="inline-flex items-center gap-1 rounded-[9px] bg-black/8 p-1 dark:bg-white/8">
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
