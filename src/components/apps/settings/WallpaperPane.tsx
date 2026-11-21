import * as React from "react";
import { PipetteIcon } from "lucide-react";
import { DesktopBackgroundLayers } from "@/components/shell/DesktopBackgroundLayers";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useSettings } from "@/context/DesktopStateContext";
import { ACCENT_COLORS, WALLPAPERS, resolveDynamicWallpaperCss } from "@/data/catalog";
import {
  GNOME_PICTURE_OPTIONS,
  GNOME_SHADING_TYPES,
  type GnomeBackgroundSettings,
  type GnomeColorShadingType,
  type GnomePictureOptions,
  normalizeBackgroundPictureUri,
  selectGnomePictureUri,
  toHexColorInputValue,
} from "@/lib/gnome-background";
import { _ } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useThrottledColor } from "./use-throttled-color";

export function WallpaperPane() {
  const { settings, updateSettings, resolvedTheme, backgroundSpec } = useSettings();
  const gnomeBg = settings.gnomeBackground;

  const [lightUriDraft, setLightUriDraft] = React.useState(
    gnomeBg.pictureUri || settings.customWallpaperUrl
  );
  const [darkUriDraft, setDarkUriDraft] = React.useState(gnomeBg.pictureUriDark);

  React.useEffect(() => {
    setLightUriDraft(gnomeBg.pictureUri || settings.customWallpaperUrl);
  }, [gnomeBg.pictureUri, settings.customWallpaperUrl]);

  React.useEffect(() => {
    setDarkUriDraft(gnomeBg.pictureUriDark);
  }, [gnomeBg.pictureUriDark]);

  const applySolidColor = React.useCallback(
    (hex: string) => {
      updateSettings({
        wallpaperId: hex,
        customWallpaperUrl: "",
        gnomeBackground: {
          ...settings.gnomeBackground,
          pictureUri: "",
          pictureUriDark: "",
          pictureOptions: "none",
          colorShadingType: "solid",
          primaryColor: hex,
        },
      });
    },
    [settings.gnomeBackground, updateSettings]
  );

  const solidWallpapers = React.useMemo(
    () => WALLPAPERS.filter((wp) => wp.category === "Solid"),
    []
  );

  const gradients = React.useMemo(
    () =>
      WALLPAPERS.filter(
        (wp) => wp.category === "Dynamic" || wp.category === "Minimal"
      ),
    []
  );

  const pictures = React.useMemo(
    () => WALLPAPERS.filter((wp) => wp.category === "Pictures"),
    []
  );

  const activePictureUri =
    selectGnomePictureUri(gnomeBg, resolvedTheme) || settings.customWallpaperUrl;

  const updateGnomeBg = React.useCallback(
    (patch: Partial<GnomeBackgroundSettings>) => {
      updateSettings({
        wallpaperId: "gnome",
        customWallpaperUrl: "",
        gnomeBackground: { ...settings.gnomeBackground, ...patch },
      });
    },
    [settings.gnomeBackground, updateSettings]
  );

  const isCustomSelected =
    !activePictureUri &&
    (settings.wallpaperId.startsWith("#") ||
      (settings.wallpaperId === "gnome" &&
        gnomeBg.colorShadingType === "solid")) &&
    !solidWallpapers.some(
      (w) =>
        w.id.toLowerCase() ===
        (settings.wallpaperId.startsWith("#")
          ? settings.wallpaperId
          : gnomeBg.primaryColor
        ).toLowerCase()
    );

  const committedCustomHex = toHexColorInputValue(
    settings.wallpaperId.startsWith("#")
      ? settings.wallpaperId
      : gnomeBg.primaryColor,
    "#4f46e5"
  );
  const customColorPicker = useThrottledColor(committedCustomHex, applySolidColor);
  const primaryColorPicker = useThrottledColor(
    toHexColorInputValue(gnomeBg.primaryColor, "#023c88"),
    (hex) => updateGnomeBg({ primaryColor: hex })
  );
  const secondaryColorPicker = useThrottledColor(
    toHexColorInputValue(gnomeBg.secondaryColor, "#5789ca"),
    (hex) => updateGnomeBg({ secondaryColor: hex })
  );
  const customHexValue = customColorPicker.draft;
  const previewSpec = React.useMemo(() => {
    const p = primaryColorPicker.draft;
    const s = secondaryColorPicker.draft;
    if (
      customHexValue !== committedCustomHex &&
      customHexValue !== toHexColorInputValue(gnomeBg.primaryColor, "#023c88")
    ) {
      return {
        ...backgroundSpec,
        baseCss: customHexValue,
        overlayCss: undefined,
        pictureLayer: undefined,
      };
    }
    if (
      p !== toHexColorInputValue(gnomeBg.primaryColor, "#023c88") ||
      s !== toHexColorInputValue(gnomeBg.secondaryColor, "#5789ca")
    ) {
      const baseCss =
        gnomeBg.colorShadingType === "horizontal"
          ? `linear-gradient(to right, ${p}, ${s})`
          : gnomeBg.colorShadingType === "vertical"
            ? `linear-gradient(to bottom, ${p}, ${s})`
            : p;
      return { ...backgroundSpec, baseCss };
    }
    return backgroundSpec;
  }, [
    backgroundSpec,
    committedCustomHex,
    customHexValue,
    gnomeBg.colorShadingType,
    gnomeBg.primaryColor,
    gnomeBg.secondaryColor,
    primaryColorPicker.draft,
    secondaryColorPicker.draft,
  ]);

  const renderWallpaperCard = (
    wp: (typeof WALLPAPERS)[number],
    isSolid = false
  ) => {
    const accentHex =
      ACCENT_COLORS.find((c) => c.id === settings.accentColor)?.hex ?? "#3584e4";
    const resolvedBgCss =
      resolveDynamicWallpaperCss(wp.id, accentHex) ?? wp.backgroundCss;
    const selected = isSolid
      ? !activePictureUri &&
        (settings.wallpaperId.toLowerCase() === wp.id.toLowerCase() ||
          (settings.wallpaperId === "gnome" &&
            gnomeBg.colorShadingType === "solid" &&
            gnomeBg.primaryColor.toLowerCase() === wp.id.toLowerCase()))
      : wp.imageUrl
        ? settings.wallpaperId === wp.id || activePictureUri === wp.imageUrl
        : !activePictureUri && settings.wallpaperId === wp.id;

    return (
      <button
        key={wp.id}
        type="button"
        title={wp.name}
        aria-label={wp.name}
        onClick={() => {
          if (isSolid) {
            applySolidColor(wp.id);
          } else {
            updateSettings({
              wallpaperId: wp.id,
              customWallpaperUrl: wp.imageUrl ?? "",
              gnomeBackground: {
                ...gnomeBg,
                pictureUri: wp.imageUrl ?? "",
                pictureUriDark: wp.imageUrl ?? "",
                pictureOptions: wp.imageUrl ? "zoom" : "none",
              },
            });
          }
        }}
        className={cn(
          "group relative overflow-hidden rounded-[8px] transition-all outline-none",
          selected
            ? "ring-2 ring-adw-accent ring-offset-2 ring-offset-adw-group"
            : "opacity-90 hover:opacity-100"
        )}
      >
        <div
          className={cn(
            "w-full rounded-[8px] transition-transform duration-200 group-hover:scale-[1.02]",
            isSolid ? "h-12" : "aspect-[16/10]"
          )}
          style={
            wp.imageUrl
              ? {
                  backgroundColor: wp.backgroundCss,
                  backgroundImage: `url("${wp.imageUrl}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : { background: resolvedBgCss }
          }
        />
      </button>
    );
  };

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Current Wallpaper")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <div className="flex justify-center p-3.5">
            <div className="relative aspect-[16/10] h-28 w-auto max-w-full overflow-hidden rounded-[8px] border border-black/10 dark:border-white/15">
              <DesktopBackgroundLayers spec={previewSpec} />
            </div>
          </div>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Gradients")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <div className="grid grid-cols-2 gap-3 p-3.5 sm:grid-cols-3">
            {gradients.map((wp) => renderWallpaperCard(wp, false))}
          </div>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Pictures")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <div className="grid grid-cols-2 gap-3 p-3.5 sm:grid-cols-3">
            {pictures.map((wp) => renderWallpaperCard(wp, false))}
          </div>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Colors")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <div className="grid grid-cols-3 gap-3 p-3.5 sm:grid-cols-4 lg:grid-cols-6">
            {solidWallpapers.map((wp) => renderWallpaperCard(wp, true))}

            {/* Custom Solid Color with HTML5 Color Selector */}
            <div
              className={cn(
                "group relative overflow-hidden rounded-[8px] transition-all",
                isCustomSelected
                  ? "ring-2 ring-adw-accent ring-offset-2 ring-offset-adw-group"
                  : "opacity-90 hover:opacity-100"
              )}
            >
              <div
                className="relative flex h-12 w-full items-center justify-center overflow-hidden rounded-[8px] transition-transform duration-200 group-hover:scale-[1.02]"
              style={{
                background: isCustomSelected
                  ? customHexValue
                  : "conic-gradient(from 180deg at 50% 50%, #ff3b30, #ff9500, #ffcc00, #34c759, #00c7be, #32ade6, #007aff, #5856d6, #af52de, #ff2d55, #ff3b30)",
              }}
            >
              <div className="pointer-events-none flex size-7 items-center justify-center rounded-full bg-black/35 text-white shadow-xs backdrop-blur-xs">
                <PipetteIcon className="size-3.5" />
              </div>
              <input
                type="color"
                aria-label={_("Custom Color Picker")}
                value={customHexValue}
                onChange={(e) => customColorPicker.onChange(e.target.value)}
                onBlur={customColorPicker.flush}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </div>
          </div>
          </div>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Advanced")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow className="gap-2 py-3">
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Picture URI")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="flex-1 justify-end gap-2">
              <Input
                placeholder="file:///usr/share/backgrounds/..."
                value={lightUriDraft}
                onChange={(e) => setLightUriDraft(e.target.value)}
                className="min-w-[180px] flex-1"
              />
              <Button
                size="sm"
                onClick={() =>
                  updateGnomeBg({
                    pictureUri: normalizeBackgroundPictureUri(lightUriDraft),
                    pictureOptions:
                      gnomeBg.pictureOptions === "none"
                        ? "zoom"
                        : gnomeBg.pictureOptions,
                  })
                }
              >
                {_("Apply")}
              </Button>
              {(gnomeBg.pictureUri || settings.customWallpaperUrl) && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setLightUriDraft("");
                    updateGnomeBg({ pictureUri: "" });
                  }}
                >
                  {_("Clear")}
                </Button>
              )}
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow className="gap-2 py-3">
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Dark Style Picture URI")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="flex-1 justify-end gap-2">
              <Input
                placeholder="file:///usr/share/backgrounds/...-d.jxl"
                value={darkUriDraft}
                onChange={(e) => setDarkUriDraft(e.target.value)}
                className="min-w-[180px] flex-1"
              />
              <Button
                size="sm"
                onClick={() =>
                  updateGnomeBg({
                    pictureUriDark: normalizeBackgroundPictureUri(darkUriDraft),
                    pictureOptions:
                      gnomeBg.pictureOptions === "none"
                        ? "zoom"
                        : gnomeBg.pictureOptions,
                  })
                }
              >
                {_("Apply")}
              </Button>
              {gnomeBg.pictureUriDark && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setDarkUriDraft("");
                    updateGnomeBg({ pictureUriDark: "" });
                  }}
                >
                  {_("Clear")}
                </Button>
              )}
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Picture Options")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Select
                value={gnomeBg.pictureOptions}
                items={GNOME_PICTURE_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: _(opt.label),
                }))}
                onValueChange={(value) =>
                  updateGnomeBg({ pictureOptions: value as GnomePictureOptions })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GNOME_PICTURE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {_(opt.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Picture Opacity")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="w-44">
              <Slider
                value={[gnomeBg.pictureOpacity]}
                min={0}
                max={100}
                step={5}
                onValueChange={(vals) => {
                  const next = Array.isArray(vals) ? vals[0] : vals;
                  if (typeof next === "number") {
                    updateGnomeBg({ pictureOpacity: next });
                  }
                }}
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Color Shading")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="gap-2">
              <Select
                value={gnomeBg.colorShadingType}
                items={GNOME_SHADING_TYPES.map((opt) => ({
                  value: opt.value,
                  label: _(opt.label),
                }))}
                onValueChange={(value) =>
                  updateGnomeBg({
                    colorShadingType: value as GnomeColorShadingType,
                  })
                }
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GNOME_SHADING_TYPES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {_(opt.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="color"
                aria-label="Primary Background Color"
                value={primaryColorPicker.draft}
                onChange={(e) => primaryColorPicker.onChange(e.target.value)}
                onBlur={primaryColorPicker.flush}
                className="h-8 w-8 cursor-pointer rounded-md border border-adw-separator bg-transparent p-0.5"
              />
              {gnomeBg.colorShadingType !== "solid" && (
                <input
                  type="color"
                  aria-label="Secondary Background Color"
                  value={secondaryColorPicker.draft}
                  onChange={(e) => secondaryColorPicker.onChange(e.target.value)}
                  onBlur={secondaryColorPicker.flush}
                  className="h-8 w-8 cursor-pointer rounded-md border border-adw-separator bg-transparent p-0.5"
                />
              )}
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}
