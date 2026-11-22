import * as React from "react";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FilmIcon,
  PipetteIcon,
  SunMoonIcon,
} from "lucide-react";
import {
  DesktopBackgroundLayers,
  useResolvedDesktopBackgroundSpec,
} from "@/components/shell/DesktopBackgroundLayers";
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
import { useOptionalPlugins } from "@/context/PluginsContext";
import {
  ACCENT_COLORS,
  WALLPAPERS,
  resolveDynamicWallpaperCss,
  type WallpaperOption,
} from "@/data/catalog";
import {
  GNOME_PICTURE_OPTIONS,
  GNOME_SHADING_TYPES,
  type GnomeBackgroundSettings,
  type GnomeColorShadingType,
  type GnomePictureOptions,
  fileUriToLocalPath,
  normalizeBackgroundPictureUri,
  resolveBackgroundRenderSpec,
  selectGnomePictureUri,
  toHexColorInputValue,
} from "@/lib/gnome-background";
import { _ } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useThrottledColor } from "./use-throttled-color";

function WallpaperThumbnail({
  wp,
  resolvedTheme,
  accentHex,
}: {
  wp: WallpaperOption;
  resolvedTheme: "dark" | "light";
  accentHex: string;
}) {
  const domicile = useDomicile();
  const rawUri =
    resolvedTheme === "dark" && wp.imageUrlDark
      ? wp.imageUrlDark
      : wp.imageUrl;
  const localPath = rawUri ? fileUriToLocalPath(rawUri) : null;
  const [resolvedUrl, setResolvedUrl] = React.useState<string>(() =>
    localPath ? "" : rawUri ?? ""
  );

  React.useEffect(() => {
    if (!rawUri) {
      setResolvedUrl("");
      return;
    }
    if (!localPath) {
      setResolvedUrl(rawUri);
      return;
    }
    let cancelled = false;
    let objectUrl = "";
    void domicile.files.read(localPath).then((res) => {
      if (cancelled) return;
      res.match({
        Ok: (bytes) => {
          if (bytes.length === 0) return;
          const ext = localPath.split(".").pop()?.toLowerCase() ?? "";
          const mime =
            ext === "svg"
              ? "image/svg+xml"
              : ext === "png"
                ? "image/png"
                : ext === "webp"
                  ? "image/webp"
                  : "image/jpeg";
          objectUrl = URL.createObjectURL(
            new Blob([new Uint8Array(bytes)], { type: mime })
          );
          setResolvedUrl(objectUrl);
        },
        Err: () => undefined,
      });
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [domicile.files, localPath, rawUri]);

  const thumbSpec = React.useMemo(() => {
    const resolvedBgCss =
      resolveDynamicWallpaperCss(wp.id, accentHex) ??
      (resolvedTheme === "dark" && wp.backgroundCssDark
        ? wp.backgroundCssDark
        : wp.backgroundCss);

    return resolveBackgroundRenderSpec({
      wallpaperId: wp.id,
      customWallpaperUrl: resolvedUrl || undefined,
      gnomeBackground: {
        pictureUri: resolvedUrl,
        pictureUriDark: resolvedUrl,
        pictureOptions: resolvedUrl ? "zoom" : "none",
        primaryColor: "#023c88",
        secondaryColor: "#5789ca",
        colorShadingType: "solid",
        pictureOpacity: 100,
      },
      activeWallpaper: { ...wp, backgroundCss: resolvedBgCss },
      resolvedTheme,
      resolvedPictureSrc: resolvedUrl,
    });
  }, [accentHex, resolvedTheme, resolvedUrl, wp]);

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[8px] transition-transform duration-200 group-hover:scale-[1.02]">
      {wp.kind === "html" ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              resolvedTheme === "dark" && wp.backgroundCssDark
                ? wp.backgroundCssDark
                : wp.backgroundCss,
          }}
        />
      ) : (
        <DesktopBackgroundLayers spec={thumbSpec} />
      )}
    </div>
  );
}

export function WallpaperPane() {
  const { settings, updateSettings, resolvedTheme } = useSettings();
  const baseSpec = useResolvedDesktopBackgroundSpec();
  const pluginsCtx = useOptionalPlugins();
  const gnomeBg = settings.gnomeBackground;

  const [showAdvanced, setShowAdvanced] = React.useState(false);
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

  const galleryWallpapers = React.useMemo<WallpaperOption[]>(() => {
    const builtin = WALLPAPERS.filter((wp) => wp.category !== "Solid");
    const fromPlugins: WallpaperOption[] = (
      pluginsCtx?.pluginWallpapers ?? []
    ).map((pw) => ({
      id: pw.fullId,
      name: pw.name,
      subtitle: pw.subtitle ?? "Plugin Wallpaper",
      category: "Dynamic",
      backgroundCss:
        pw.backgroundCss ??
        "linear-gradient(175deg, #050811 0%, #0c1424 100%)",
      backgroundCssDark: pw.backgroundCssDark,
      kind: pw.kind,
      cssAnimation: pw.cssAnimation,
      cssAnimationDark: pw.cssAnimationDark,
      htmlSrcDoc: pw.htmlSrcDoc,
      htmlSrcDocDark: pw.htmlSrcDocDark,
      imageUrl: pw.imageUrl,
      imageUrlDark: pw.imageUrlDark,
      pluginId: pw.pluginId,
    }));
    return [...fromPlugins, ...builtin];
  }, [pluginsCtx?.pluginWallpapers]);

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
        ...baseSpec,
        baseCss: customHexValue,
        overlayCss: undefined,
        animatedCss: undefined,
        htmlLayer: undefined,
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
      return { ...baseSpec, baseCss };
    }
    return baseSpec;
  }, [
    baseSpec,
    committedCustomHex,
    customHexValue,
    gnomeBg.colorShadingType,
    gnomeBg.primaryColor,
    gnomeBg.secondaryColor,
    primaryColorPicker.draft,
    secondaryColorPicker.draft,
  ]);

  const accentHex =
    ACCENT_COLORS.find((c) => c.id === settings.accentColor)?.hex ?? "#3584e4";

  const activeEntry = React.useMemo(() => {
    const match = galleryWallpapers.find(
      (w) =>
        w.id === settings.wallpaperId ||
        (w.id.includes(":") && w.id.split(":").slice(1).join(":") === settings.wallpaperId)
    );
    if (match) return match;
    if (settings.wallpaperId.startsWith("#")) {
      return { name: _("Custom Color"), subtitle: settings.wallpaperId };
    }
    const solid = solidWallpapers.find(
      (w) => w.id.toLowerCase() === settings.wallpaperId.toLowerCase()
    );
    if (solid) return solid;
    if (activePictureUri) {
      const fileName = activePictureUri.split("/").pop() || activePictureUri;
      return {
        name: fileName,
        subtitle: gnomeBg.pictureUriDark ? _("Light & Dark Adaptive") : _("Custom Wallpaper"),
      };
    }
    return galleryWallpapers[0];
  }, [
    activePictureUri,
    galleryWallpapers,
    gnomeBg.pictureUriDark,
    settings.wallpaperId,
    solidWallpapers,
  ]);

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Current Wallpaper")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <div className="flex flex-col items-center gap-2 p-3.5">
            <div className="relative aspect-[16/10] h-28 w-auto max-w-full overflow-hidden rounded-[10px] border border-black/10 shadow-xs dark:border-white/15">
              <DesktopBackgroundLayers spec={previewSpec} />
            </div>
            {activeEntry && (
              <div className="text-center">
                <div className="text-[12.5px] font-semibold text-adw-label">
                  {activeEntry.name}
                </div>
                {activeEntry.subtitle && (
                  <div className="text-[11px] text-adw-label-secondary">
                    {activeEntry.subtitle}
                  </div>
                )}
              </div>
            )}
          </div>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Wallpapers")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <div className="grid grid-cols-2 gap-3 p-3.5 sm:grid-cols-3">
            {galleryWallpapers.map((wp) => {
              const bareId = wp.id.includes(":")
                ? wp.id.split(":").slice(1).join(":")
                : wp.id;
              const selected =
                wp.imageUrl && !wp.kind
                  ? settings.wallpaperId === wp.id ||
                    activePictureUri === wp.imageUrl ||
                    (Boolean(wp.imageUrlDark) && activePictureUri === wp.imageUrlDark)
                  : !activePictureUri &&
                    (settings.wallpaperId === wp.id || settings.wallpaperId === bareId);

              const isAnimated = wp.kind === "css" || wp.kind === "html";
              const isAdaptive = Boolean(
                wp.imageUrlDark || wp.cssAnimationDark || wp.htmlSrcDocDark
              );

              return (
                <button
                  key={wp.id}
                  type="button"
                  title={`${wp.name}${wp.subtitle ? ` — ${wp.subtitle}` : ""}`}
                  aria-label={wp.name}
                  onClick={() => {
                    updateSettings({
                      wallpaperId: wp.id,
                      customWallpaperUrl: wp.imageUrl ?? "",
                      gnomeBackground: {
                        ...gnomeBg,
                        pictureUri: wp.imageUrl ?? "",
                        pictureUriDark: wp.imageUrlDark ?? wp.imageUrl ?? "",
                        pictureOptions: wp.imageUrl ? "zoom" : "none",
                      },
                    });
                  }}
                  className={cn(
                    "group relative overflow-hidden rounded-[8px] transition-all outline-none",
                    selected
                      ? "ring-2 ring-adw-accent ring-offset-2 ring-offset-adw-group"
                      : "opacity-90 hover:opacity-100"
                  )}
                >
                  <WallpaperThumbnail
                    wp={wp}
                    resolvedTheme={resolvedTheme}
                    accentHex={accentHex}
                  />
                  {(isAnimated || isAdaptive) && (
                    <span className="pointer-events-none absolute right-1.5 bottom-1.5 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-xs">
                      {isAnimated && <FilmIcon className="size-4" />}
                      {isAdaptive && <SunMoonIcon className="size-4" />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </GroupedFormGroup>
      </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Colors")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <div className="grid grid-cols-3 gap-3 p-3.5 sm:grid-cols-4 lg:grid-cols-6">
            {solidWallpapers.map((wp) => {
              const selected =
                !activePictureUri &&
                (settings.wallpaperId.toLowerCase() === wp.id.toLowerCase() ||
                  (settings.wallpaperId === "gnome" &&
                    gnomeBg.colorShadingType === "solid" &&
                    gnomeBg.primaryColor.toLowerCase() === wp.id.toLowerCase()));
              return (
                <button
                  key={wp.id}
                  type="button"
                  title={wp.name}
                  aria-label={wp.name}
                  onClick={() => applySolidColor(wp.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-[8px] transition-all outline-none",
                    selected
                      ? "ring-2 ring-adw-accent ring-offset-2 ring-offset-adw-group"
                      : "opacity-90 hover:opacity-100"
                  )}
                >
                  <div
                    className="h-12 w-full rounded-[8px] transition-transform duration-200 group-hover:scale-[1.02]"
                    style={{ background: wp.backgroundCss }}
                  />
                </button>
              );
            })}

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
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Custom & Advanced")}</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                {_("Custom light/dark image, HTML/CSS file URI, fit, and shading")}
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? (
                  <>
                    <ChevronDownIcon className="size-3.5" />
                    {_("Hide")}
                  </>
                ) : (
                  <>
                    <ChevronRightIcon className="size-3.5" />
                    {_("Configure")}
                  </>
                )}
              </Button>
            </GroupedFormRowControl>
          </GroupedFormRow>

          {showAdvanced && (
            <>
              <GroupedFormRow className="gap-2 py-3">
                <GroupedFormRowLabel>
                  <GroupedFormRowTitle>{_("Light Wallpaper")}</GroupedFormRowTitle>
                </GroupedFormRowLabel>
                <GroupedFormRowControl className="flex-1 justify-end gap-2">
                  <Input
                    placeholder="file:///usr/share/backgrounds/... (.svg, .jpg, .html, .css)"
                    value={lightUriDraft}
                    onChange={(e) => setLightUriDraft(e.target.value)}
                    className="min-w-[160px] flex-1"
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
                  <GroupedFormRowTitle>{_("Dark Wallpaper")}</GroupedFormRowTitle>
                </GroupedFormRowLabel>
                <GroupedFormRowControl className="flex-1 justify-end gap-2">
                  <Input
                    placeholder="file:///usr/share/backgrounds/...-d.svg"
                    value={darkUriDraft}
                    onChange={(e) => setDarkUriDraft(e.target.value)}
                    className="min-w-[160px] flex-1"
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
                  <GroupedFormRowTitle>{_("Fit")}</GroupedFormRowTitle>
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
                    <SelectTrigger className="w-[170px]">
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
                  <GroupedFormRowTitle>{_("Opacity")}</GroupedFormRowTitle>
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
                  <GroupedFormRowTitle>{_("Shading")}</GroupedFormRowTitle>
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
                    <SelectTrigger className="w-[160px]">
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
            </>
          )}
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}
