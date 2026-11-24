import * as React from "react";
import { useDisplays } from "@domicile-desktop/react/displays";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  ArrowUpIcon,
  FilmIcon,
  FolderIcon,
  ImageIcon,
  PlusIcon,
  SunMoonIcon,
  UploadIcon,
} from "lucide-react";
import { ComputerHardwareIllustration } from "@/components/shell/AboutComputerDialog";
import {
  DesktopBackgroundLayers,
  useResolvedDesktopBackgroundSpec,
} from "@/components/shell/DesktopBackgroundLayers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GroupedForm,
  GroupedFormExpanderRow,
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
import { useApps, useSettings } from "@/context/DesktopStateContext";
import { useOptionalPlugins } from "@/context/PluginsContext";
import {
  ACCENT_COLORS,
  WALLPAPERS,
  resolveDynamicWallpaperCss,
  type WallpaperOption,
} from "@/data/catalog";
import {
  WEB_VFS_HOME,
  importExternalFilesToVfs,
  listFsDir,
  toDomicilePath,
  type WebVfsEntry,
} from "@/lib/engine/fs-bridge";
import {
  GNOME_PICTURE_OPTIONS,
  GNOME_SHADING_TYPES,
  type GnomeBackgroundSettings,
  type GnomeColorShadingType,
  type GnomePictureOptions,
  type WallpaperColorMode,
  buildWallpaperColorCss,
  fileUriToLocalPath,
  localPathToFileUri,
  normalizeBackgroundPictureUri,
  resolveBackgroundRenderSpec,
  selectGnomePictureUri,
  toHexColorInputValue,
} from "@/lib/engine-native/gnome-background";

const MACOS_COLOR_SWATCHES = [
  "#000000",
  "#6a67ab",
  "#1ca9c9",
  "#e0666e",
  "#3b5bdb",
  "#fbd5bc",
  "#ebd6b5",
  "#cca04a",
  "#bc4184",
  "#e03c1f",
  "#efcbc5",
  "#e5e5e7",
  "#f6dce2",
  "#74767d",
  "#bdbec2",
  "#545456",
  "#007a78",
  "#6ecea3",
  "#f5b800",
] as const;

const IMAGE_FILE_EXT_RE = /\.(png|jpe?g|webp|svg|avif|gif|bmp)$/i;
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";
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
  const domicile = useDomicile();
  const displays = useDisplays() ?? [];
  const primaryDisplayName =
    displays[0]?.name?.trim() || _("Built-in Display");
  const { isBrowserRuntime, settings, updateSettings, resolvedTheme } =
    useSettings();
  const { xdgUserDirs } = useApps();
  const baseSpec = useResolvedDesktopBackgroundSpec();
  const pluginsCtx = useOptionalPlugins();
  const gnomeBg = settings.gnomeBackground;
  const colorMode: WallpaperColorMode = settings.wallpaperColorMode ?? "solid";

  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [lightUriDraft, setLightUriDraft] = React.useState(
    gnomeBg.pictureUri || settings.customWallpaperUrl
  );
  const [darkUriDraft, setDarkUriDraft] = React.useState(gnomeBg.pictureUriDark);

  const homeDir = React.useMemo(() => {
    const dir = xdgUserDirs.find((d) => d.key === "HOME");
    if (dir?.absolutePath) return dir.absolutePath;
    if (dir?.relativeHomePath) {
      return `${WEB_VFS_HOME}/${dir.relativeHomePath.replace(/^\/+/, "")}`;
    }
    return WEB_VFS_HOME;
  }, [xdgUserDirs]);

  const picturesDir = React.useMemo(() => {
    const dir = xdgUserDirs.find((d) => d.key === "PICTURES");
    if (dir?.absolutePath) return dir.absolutePath;
    if (dir?.relativeHomePath) {
      return `${homeDir}/${dir.relativeHomePath.replace(/^\/+/, "")}`;
    }
    return `${homeDir}/Pictures`;
  }, [homeDir, xdgUserDirs]);

  const [imagePickerOpen, setImagePickerOpen] = React.useState(false);
  const [pickerCwd, setPickerCwd] = React.useState(picturesDir);
  const [pickerEntries, setPickerEntries] = React.useState<WebVfsEntry[]>([]);
  const [pickerLoading, setPickerLoading] = React.useState(false);
  const [selectedPickerPath, setSelectedPickerPath] = React.useState<string>("");
  const hostFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const customColorInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setLightUriDraft(gnomeBg.pictureUri || settings.customWallpaperUrl);
  }, [gnomeBg.pictureUri, settings.customWallpaperUrl]);

  React.useEffect(() => {
    setDarkUriDraft(gnomeBg.pictureUriDark);
  }, [gnomeBg.pictureUriDark]);

  React.useEffect(() => {
    if (!imagePickerOpen) return;
    let active = true;
    setPickerLoading(true);
    void listFsDir(domicile, pickerCwd)
      .then((entries) => {
        if (!active) return;
        const filtered = entries
          .filter(
            (e) =>
              !e.name.startsWith(".") &&
              (e.kind === "directory" || IMAGE_FILE_EXT_RE.test(e.name))
          )
          .sort((a, b) =>
            a.kind !== b.kind
              ? a.kind === "directory"
                ? -1
                : 1
              : a.name.localeCompare(b.name)
          );
        setPickerEntries(filtered);
      })
      .finally(() => {
        if (active) setPickerLoading(false);
      });
    return () => {
      active = false;
    };
  }, [domicile, imagePickerOpen, isBrowserRuntime, pickerCwd]);

  const applyPictureUri = React.useCallback(
    (uri: string) => {
      updateSettings({
        wallpaperId: "gnome",
        customWallpaperUrl: uri,
        gnomeBackground: {
          ...settings.gnomeBackground,
          pictureUri: uri,
          pictureUriDark: uri,
          pictureOptions:
            settings.gnomeBackground.pictureOptions === "none"
              ? "zoom"
              : settings.gnomeBackground.pictureOptions,
        },
      });
    },
    [settings.gnomeBackground, updateSettings]
  );

  const openImagePicker = React.useCallback(() => {
    setPickerCwd(picturesDir);
    setSelectedPickerPath("");
    setImagePickerOpen(true);
  }, [picturesDir]);

  const handleHostImageUpload = React.useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (isBrowserRuntime) {
        const imported = await importExternalFilesToVfs(picturesDir, files);
        const firstImage = imported.find((e) => IMAGE_FILE_EXT_RE.test(e.name)) ?? imported[0];
        if (firstImage) {
          applyPictureUri(localPathToFileUri(firstImage.path));
          setImagePickerOpen(false);
        }
        return;
      }
      const file = files[0];
      const safeName = file.name.replace(/[/\\]/g, "_") || `wallpaper-${Date.now()}.png`;
      const targetPath = `${picturesDir.replace(/\/+$/, "")}/${safeName}`;
      const buf = new Uint8Array(await file.arrayBuffer());
      await domicile.files.write(toDomicilePath(targetPath), buf);
      applyPictureUri(localPathToFileUri(targetPath));
      setImagePickerOpen(false);
    },
    [applyPictureUri, domicile.files, isBrowserRuntime, picturesDir]
  );

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

  const commitCustomColor = React.useCallback(
    (rawHex: string) => {
      const normalized = toHexColorInputValue(rawHex, "").toLowerCase();
      if (!normalized) return;
      const existing = settings.customWallpaperColors ?? [];
      const alreadyExists =
        MACOS_COLOR_SWATCHES.some((c) => c.toLowerCase() === normalized) ||
        existing.some((c) => c.toLowerCase() === normalized);
      updateSettings({
        ...(alreadyExists
          ? {}
          : { customWallpaperColors: [...existing, normalized] }),
        wallpaperId: normalized,
        customWallpaperUrl: "",
        gnomeBackground: {
          ...settings.gnomeBackground,
          pictureUri: "",
          pictureUriDark: "",
          pictureOptions: "none",
          colorShadingType: "solid",
          primaryColor: normalized,
        },
      });
    },
    [settings.customWallpaperColors, settings.gnomeBackground, updateSettings]
  );

  const allColorSwatches = React.useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const hex of [
      ...MACOS_COLOR_SWATCHES,
      ...(settings.customWallpaperColors ?? []),
    ]) {
      const norm = hex.trim().toLowerCase();
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      out.push(norm);
    }
    return out;
  }, [settings.customWallpaperColors]);

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

  const dynamicWallpapers = React.useMemo(
    () =>
      galleryWallpapers.filter(
        (wp) => wp.category !== "Pictures" && !(Boolean(wp.imageUrl) && !wp.kind)
      ),
    [galleryWallpapers]
  );

  const pictureWallpapers = React.useMemo(
    () =>
      galleryWallpapers.filter(
        (wp) => wp.category === "Pictures" || (Boolean(wp.imageUrl) && !wp.kind)
      ),
    [galleryWallpapers]
  );

  const activePictureUri =
    selectGnomePictureUri(gnomeBg, resolvedTheme) || settings.customWallpaperUrl;

  const customSelectedPictureOption = React.useMemo<WallpaperOption | null>(() => {
    if (!activePictureUri) return null;
    const matchesGallery = pictureWallpapers.some(
      (wp) =>
        wp.imageUrl === activePictureUri ||
        (Boolean(wp.imageUrlDark) && wp.imageUrlDark === activePictureUri)
    );
    if (matchesGallery) return null;
    const fileName =
      activePictureUri.split("/").pop()?.split("?")[0] || _("Custom Picture");
    return {
      id: `custom-picture:${activePictureUri}`,
      name: decodeURIComponent(fileName),
      subtitle: _("Custom Image"),
      category: "Pictures",
      backgroundCss: "#0f172a",
      imageUrl: activePictureUri,
    };
  }, [activePictureUri, pictureWallpapers]);

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
    !allColorSwatches.some(
      (hex) =>
        hex.toLowerCase() ===
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

  React.useEffect(() => {
    const el = customColorInputRef.current;
    if (!el) return;
    const handleNativeChange = () => {
      commitCustomColor(el.value);
    };
    el.addEventListener("change", handleNativeChange);
    return () => {
      el.removeEventListener("change", handleNativeChange);
    };
  }, [commitCustomColor]);

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
        baseCss: buildWallpaperColorCss(customHexValue, colorMode),
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
            : buildWallpaperColorCss(p, colorMode);
      return { ...baseSpec, baseCss };
    }
    return baseSpec;
  }, [
    baseSpec,
    colorMode,
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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Fixed macOS-style headerbar-like preview strip */}
      <div className="flex shrink-0 items-center justify-center gap-4 border-b border-adw-separator bg-adw-window/60 px-6 pt-3 pb-4">
        <ComputerHardwareIllustration
          className="h-24 w-38 shrink-0 drop-shadow-md"
          screenContent={<DesktopBackgroundLayers spec={previewSpec} />}
        />
        <div className="text-adw-body font-semibold text-adw-label">
          {primaryDisplayName}
        </div>
      </div>

      {/* Scrollable wallpaper pickers below */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <GroupedForm>
          <GroupedFormSection>
            <GroupedFormSectionTitle>{_("Wallpapers")}</GroupedFormSectionTitle>
            <GroupedFormGroup>
              <div className="grid grid-cols-2 gap-3 p-3.5 sm:grid-cols-3">
                {dynamicWallpapers.map((wp) => {
                  const bareId = wp.id.includes(":")
                    ? wp.id.split(":").slice(1).join(":")
                    : wp.id;
                  const selected =
                    !activePictureUri &&
                    (settings.wallpaperId === wp.id ||
                      settings.wallpaperId === bareId);

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
                        <span className="pointer-events-none absolute right-1.5 bottom-1.5 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-adw-subheadline font-medium text-white backdrop-blur-xs">
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
            <div className="flex items-center justify-between gap-2">
              <GroupedFormSectionTitle>{_("Pictures")}</GroupedFormSectionTitle>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={openImagePicker}
              >
                {_("+ Add image")}
              </Button>
            </div>
            <GroupedFormGroup>
              <div className="grid grid-cols-2 gap-3 p-3.5 sm:grid-cols-3">
                {[
                  ...(customSelectedPictureOption
                    ? [customSelectedPictureOption]
                    : []),
                  ...pictureWallpapers,
                ].map((wp) => {
                  const selected =
                    settings.wallpaperId === wp.id ||
                    activePictureUri === wp.imageUrl ||
                    (Boolean(wp.imageUrlDark) &&
                      activePictureUri === wp.imageUrlDark);
                  const isAdaptive = Boolean(wp.imageUrlDark);

                  return (
                    <button
                      key={wp.id}
                      type="button"
                      title={`${wp.name}${wp.subtitle ? ` — ${wp.subtitle}` : ""}`}
                      aria-label={wp.name}
                      onClick={() => {
                        updateSettings({
                          wallpaperId: wp.id.startsWith("custom-picture:")
                            ? "gnome"
                            : wp.id,
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
                      {isAdaptive && (
                        <span className="pointer-events-none absolute right-1.5 bottom-1.5 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-adw-subheadline font-medium text-white backdrop-blur-xs">
                          <SunMoonIcon className="size-4" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </GroupedFormGroup>
          </GroupedFormSection>

          <GroupedFormSection>
            <div className="flex items-center justify-between gap-2">
              <GroupedFormSectionTitle>{_("Colors")}</GroupedFormSectionTitle>
              <div
                role="radiogroup"
                aria-label={_("Color Mode")}
                className="inline-flex rounded-adw-item bg-black/8 p-0.5 dark:bg-white/10"
              >
                {(["solid", "linear", "circular"] as const).map((mode) => {
                  const selected = colorMode === mode;
                  const label =
                    mode === "solid"
                      ? _("Solid")
                      : mode === "linear"
                        ? _("Linear")
                        : _("Circular");
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() =>
                        updateSettings({ wallpaperColorMode: mode })
                      }
                      className={cn(
                        "rounded-adw-control px-3 py-1 text-adw-callout font-medium transition-all",
                        selected
                          ? "bg-white text-black shadow-xs dark:bg-white/16 dark:text-white"
                          : "text-adw-label-secondary hover-fill:text-adw-label"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <GroupedFormGroup>
              <div className="flex flex-wrap gap-3 p-3.5">
                <div
                  className={cn(
                    "group relative size-10 shrink-0 overflow-hidden rounded-full transition-all",
                    isCustomSelected
                      ? "ring-2 ring-adw-accent ring-offset-2 ring-offset-adw-group"
                      : "opacity-90 hover:opacity-100"
                  )}
                >
                  <div
                    className="relative flex size-full items-center justify-center overflow-hidden rounded-full bg-black/10 transition-transform duration-200 group-hover:scale-[1.04] dark:bg-white/12"
                    style={
                      isCustomSelected
                        ? {
                            background: buildWallpaperColorCss(
                              customHexValue,
                              colorMode
                            ),
                          }
                        : undefined
                    }
                  >
                    <PlusIcon className="pointer-events-none size-5 text-adw-label" />
                    <input
                      ref={customColorInputRef}
                      type="color"
                      aria-label={_("Custom Color Picker")}
                      value={customHexValue}
                      onChange={(e) => customColorPicker.onChange(e.target.value)}
                      onBlur={() => {
                        customColorPicker.flush();
                        commitCustomColor(customColorPicker.draft);
                      }}
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                    />
                  </div>
                </div>

                {allColorSwatches.map((hex) => {
                  const selected =
                    !activePictureUri &&
                    (settings.wallpaperId.toLowerCase() === hex.toLowerCase() ||
                      (settings.wallpaperId === "gnome" &&
                        gnomeBg.colorShadingType === "solid" &&
                        gnomeBg.primaryColor.toLowerCase() ===
                          hex.toLowerCase()));
                  return (
                    <button
                      key={hex}
                      type="button"
                      title={hex.toUpperCase()}
                      aria-label={hex.toUpperCase()}
                      onClick={() => applySolidColor(hex)}
                      className={cn(
                        "group relative size-10 shrink-0 overflow-hidden rounded-full transition-all outline-none",
                        selected
                          ? "ring-2 ring-adw-accent ring-offset-2 ring-offset-adw-group"
                          : "opacity-90 hover:opacity-100"
                      )}
                    >
                      <div
                        className="size-full rounded-full border border-black/10 transition-transform duration-200 group-hover:scale-[1.04] dark:border-white/10"
                        style={{
                          background: buildWallpaperColorCss(hex, colorMode),
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </GroupedFormGroup>
          </GroupedFormSection>

      <GroupedFormSection>
        <GroupedFormGroup>
          <GroupedFormExpanderRow
            title={_("Custom & Advanced")}
            description={_("Custom light/dark image, HTML/CSS file URI, fit, and shading")}
            expanded={showAdvanced}
            onToggle={() => setShowAdvanced((v) => !v)}
          />

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
                    className="h-8 w-8 cursor-pointer rounded-adw-control border border-adw-separator bg-transparent p-0.5"
                  />
                  {gnomeBg.colorShadingType !== "solid" && (
                    <input
                      type="color"
                      aria-label="Secondary Background Color"
                      value={secondaryColorPicker.draft}
                      onChange={(e) => secondaryColorPicker.onChange(e.target.value)}
                      onBlur={secondaryColorPicker.flush}
                      className="h-8 w-8 cursor-pointer rounded-adw-control border border-adw-separator bg-transparent p-0.5"
                    />
                  )}
                </GroupedFormRowControl>
              </GroupedFormRow>
            </>
          )}
        </GroupedFormGroup>
      </GroupedFormSection>
        </GroupedForm>
      </div>

      <Dialog open={imagePickerOpen} onOpenChange={setImagePickerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{_("Choose Wallpaper Image")}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pickerCwd === "/" || pickerCwd === homeDir}
                  onClick={() => {
                    const parent =
                      pickerCwd.split("/").slice(0, -1).join("/") || "/";
                    setPickerCwd(parent);
                    setSelectedPickerPath("");
                  }}
                >
                  <ArrowUpIcon className="size-3.5" />
                </Button>
                <span className="truncate text-adw-callout text-adw-label-secondary">
                  {pickerCwd}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={pickerCwd === picturesDir ? "default" : "secondary"}
                  onClick={() => {
                    setPickerCwd(picturesDir);
                    setSelectedPickerPath("");
                  }}
                >
                  {_("Pictures")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => hostFileInputRef.current?.click()}
                >
                  <UploadIcon className="size-3.5" />
                  {_("Upload")}
                </Button>
                <input
                  ref={hostFileInputRef}
                  type="file"
                  accept="image/*,.png,.jpg,.jpeg,.webp,.svg,.avif"
                  className="hidden"
                  onChange={(e) => {
                    void handleHostImageUpload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            <div className="max-h-64 min-h-40 overflow-y-auto rounded-adw-item border border-adw-separator bg-adw-group p-1.5">
              {pickerLoading ? (
                <div className="flex h-36 items-center justify-center text-adw-body text-adw-label-secondary">
                  {_("Loading...")}
                </div>
              ) : pickerEntries.length === 0 ? (
                <div className="flex h-36 items-center justify-center text-adw-body text-adw-label-secondary">
                  {_("No images found in this folder")}
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {pickerEntries.map((entry) => {
                    const isSelected = selectedPickerPath === entry.path;
                    return (
                      <button
                        key={entry.path}
                        type="button"
                        onClick={() => {
                          if (entry.kind === "directory") {
                            setPickerCwd(entry.path);
                            setSelectedPickerPath("");
                          } else {
                            setSelectedPickerPath(entry.path);
                          }
                        }}
                        onDoubleClick={() => {
                          if (entry.kind === "file") {
                            applyPictureUri(localPathToFileUri(entry.path));
                            setImagePickerOpen(false);
                          }
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-adw-control px-2.5 py-1.5 text-left text-adw-body transition-colors",
                          isSelected
                            ? "bg-adw-accent text-white"
                            : "text-adw-label hover-fill:bg-black/5 dark:hover-fill:bg-white/8"
                        )}
                      >
                        {entry.kind === "directory" ? (
                          <FolderIcon className="size-4 shrink-0 opacity-80" />
                        ) : (
                          <ImageIcon className="size-4 shrink-0 opacity-80" />
                        )}
                        <span className="truncate">{entry.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setImagePickerOpen(false)}
            >
              {_("Cancel")}
            </Button>
            <Button
              type="button"
              disabled={!selectedPickerPath}
              onClick={() => {
                if (!selectedPickerPath) return;
                applyPictureUri(localPathToFileUri(selectedPickerPath));
                setImagePickerOpen(false);
              }}
            >
              {_("Choose")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
