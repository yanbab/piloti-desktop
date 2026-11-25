import * as React from "react";
import { useCapabilities } from "@/hooks/use-capabilities";
import { Popover } from "@base-ui/react/popover";
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import { usePiloti } from "@/lib/engine/piloti";
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
import type { CssFontStyle } from "@/context/SettingsContext";
import { listInstalledFontFamilies } from "@/lib/engine-native";
import { _ } from "@/lib/core/i18n";
import { cn } from "@/lib/core/utils";

const SANS_PRESETS = [
  "Adwaita Sans",
  "Cantarell",
  "Inter",
  "Noto Sans",
  "Ubuntu",
  "Liberation Sans",
  "DejaVu Sans",
  "system-ui",
] as const;

const MONO_PRESETS = [
  "Adwaita Mono",
  "JetBrains Mono",
  "Source Code Pro",
  "DejaVu Sans Mono",
  "monospace",
] as const;

const FONT_STYLE_OPTIONS: Array<{ value: CssFontStyle; label: string }> = [
  { value: "light", label: "Light" },
  { value: "regular", label: "Regular" },
  { value: "medium", label: "Medium" },
  { value: "semibold", label: "Semibold" },
  { value: "italic", label: "Italic" },
];

type RenderingStylePreset = "default" | "subpixel" | "geometric" | "darkened";

const RENDERING_STYLE_OPTIONS: Array<{
  value: RenderingStylePreset;
  label: string;
}> = [
    { value: "default", label: "Default (Antialiased)" },
    { value: "subpixel", label: "Subpixel (LCD)" },
    { value: "geometric", label: "Geometric Precision" },
    { value: "darkened", label: "Darkened" },
  ];

function inferRenderingStyle(settings: {
  cssFontSmoothing: string;
  cssTextRendering: string;
  cssTextStrokePx: number;
}): RenderingStylePreset {
  if (settings.cssTextStrokePx > 0) return "darkened";
  if (settings.cssFontSmoothing === "subpixel-antialiased") return "subpixel";
  if (settings.cssTextRendering === "geometricPrecision") return "geometric";
  return "default";
}

interface FontPopoverSelectorProps {
  value: string;
  fonts: string[];
  summary: string;
  onSelectFont: (family: string) => void;
  sizePx?: number;
  fontScale?: number;
  onChangeScale?: (scale: number) => void;
  fontStyle?: CssFontStyle;
  onChangeStyle?: (style: CssFontStyle) => void;
}

function FontPopoverSelector({
  value,
  fonts,
  summary,
  onSelectFont,
  fontScale,
  onChangeScale,
  fontStyle,
  onChangeStyle,
}: FontPopoverSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filteredFonts = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? fonts.filter((f) => f.toLowerCase().includes(q))
      : fonts;
    if (value && !list.includes(value) && (!q || value.toLowerCase().includes(q))) {
      return [value, ...list];
    }
    return list;
  }, [fonts, search, value]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <Popover.Trigger data-slot="select-trigger" className="inline-flex h-7 max-w-[260px] items-center gap-1.5 rounded-adw-item px-2.5 text-adw-body font-medium text-adw-label transition-colors hover-fill:bg-black/6 focus-visible:outline-none dark:hover-fill:bg-white/10">
        <span className="truncate">{summary}</span>
        <ChevronsUpDownIcon className="size-3.5 shrink-0 text-adw-label-secondary" />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
          <Popover.Popup className="w-72 overflow-hidden rounded-adw-popover p-2 text-adw-label shadow-adw-menu adw-material-menu outline-none">
            <div className="relative mb-2">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-adw-label-tertiary" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && search.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    setSearch("");
                  }
                }}
                placeholder={_("Search fonts…")}
                className="h-7 pl-8 text-adw-callout"
              />
            </div>

            <div className="max-h-52 overflow-y-auto pr-0.5">
              {filteredFonts.length === 0 ? (
                <div className="px-2 py-4 text-center text-adw-callout text-adw-label-secondary">
                  {_("No matching fonts")}
                </div>
              ) : (
                filteredFonts.map((family) => {
                  const selected = value === family;
                  return (
                    <button
                      key={family}
                      type="button"
                      onClick={() => onSelectFont(family)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-adw-item px-2.5 py-1.5 text-left text-adw-callout transition-colors",
                        selected
                          ? "bg-adw-accent/15 font-medium text-adw-label"
                          : "hover-fill:bg-black/6 dark:hover-fill:bg-white/8",
                      )}
                    >
                      <span className="truncate">{family}</span>
                      {selected && (
                        <CheckIcon className="size-3.5 shrink-0 text-adw-accent" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {fontScale !== undefined && onChangeScale && (
              <div className="mt-2 border-t border-adw-separator pt-2">
                <div className="mb-1 flex items-center justify-between text-adw-subheadline text-adw-label-secondary">
                  <span>{_("Size")}</span>
                  <span className="tabular-nums">
                    {Math.round(13 * fontScale)}px ({Math.round(fontScale * 100)}%)
                  </span>
                </div>
                <Slider
                  min={0.85}
                  max={1.35}
                  step={0.05}
                  value={[fontScale]}
                  onValueChange={(val) => {
                    const next = Array.isArray(val) ? val[0] : val;
                    if (typeof next === "number") onChangeScale(next);
                  }}
                />
              </div>
            )}

            {fontStyle !== undefined && onChangeStyle && (
              <div className="mt-2 border-t border-adw-separator pt-2">
                <div className="mb-1.5 text-adw-subheadline text-adw-label-secondary">
                  {_("Style")}
                </div>
                <div className="flex flex-wrap gap-1">
                  {FONT_STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onChangeStyle(opt.value)}
                      className={cn(
                        "rounded-adw-control px-2 py-0.5 text-adw-subheadline font-medium transition-colors",
                        fontStyle === opt.value
                          ? "bg-adw-accent text-white"
                          : "bg-black/6 text-adw-label-secondary hover-fill:text-adw-label dark:bg-white/8",
                      )}
                    >
                      {_(opt.label)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function FontsPane() {
  const piloti = usePiloti();
  const { settings, updateSettings } = useSettings();
  const { systemServices } = useCapabilities();
  const [installedFonts, setInstalledFonts] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!systemServices) return;
    let cancelled = false;
    void listInstalledFontFamilies(piloti).then((fonts) => {
      if (!cancelled && fonts.length > 0) {
        setInstalledFonts(fonts);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [piloti, systemServices]);

  const sansFonts = React.useMemo(() => {
    const set = new Set<string>([...SANS_PRESETS, ...installedFonts]);
    return Array.from(set);
  }, [installedFonts]);

  const monoFonts = React.useMemo(() => {
    const set = new Set<string>([...MONO_PRESETS, ...installedFonts]);
    return Array.from(set);
  }, [installedFonts]);

  const renderingPreset = inferRenderingStyle(settings);

  const applyRenderingPreset = (preset: RenderingStylePreset) => {
    if (preset === "default") {
      updateSettings({
        cssFontSmoothing: "antialiased",
        cssTextRendering: "auto",
        cssFontOpticalSizing: "auto",
        cssFontKerning: "auto",
        cssFontSynthesis: "auto",
        cssLetterSpacingEm: 0,
        cssTextStrokePx: 0,
      });
    } else if (preset === "subpixel") {
      updateSettings({
        cssFontSmoothing: "subpixel-antialiased",
        cssTextRendering: "optimizeLegibility",
        cssFontOpticalSizing: "auto",
        cssFontKerning: "normal",
        cssFontSynthesis: "auto",
        cssLetterSpacingEm: 0,
        cssTextStrokePx: 0,
      });
    } else if (preset === "geometric") {
      updateSettings({
        cssFontSmoothing: "antialiased",
        cssTextRendering: "geometricPrecision",
        cssFontOpticalSizing: "auto",
        cssFontKerning: "normal",
        cssFontSynthesis: "none",
        cssLetterSpacingEm: 0,
        cssTextStrokePx: 0,
      });
    } else {
      updateSettings({
        cssFontSmoothing: "antialiased",
        cssTextRendering: "optimizeLegibility",
        cssFontOpticalSizing: "auto",
        cssFontKerning: "normal",
        cssFontSynthesis: "auto",
        cssLetterSpacingEm: 0.005,
        cssTextStrokePx: 0.15,
      });
    }
  };

  const styleLabel = _(
    FONT_STYLE_OPTIONS.find((o) => o.value === settings.fontSansStyle)?.label ??
      "Regular"
  );

  const translatedRenderingOptions = RENDERING_STYLE_OPTIONS.map((opt) => ({
    value: opt.value,
    label: _(opt.label),
  }));

  return (
    <GroupedForm>
      <GroupedFormSection>
        <GroupedFormSectionTitle>{_("Fonts")}</GroupedFormSectionTitle>
        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Interface Font")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <FontPopoverSelector
                value={settings.fontSansFamily}
                fonts={sansFonts}
                summary={`${settings.fontSansFamily} · ${Math.round(13 * settings.fontScale)}px · ${styleLabel}`}
                onSelectFont={(fontSansFamily) =>
                  updateSettings({ fontSansFamily })
                }
                fontScale={settings.fontScale}
                onChangeScale={(fontScale) => updateSettings({ fontScale })}
                fontStyle={settings.fontSansStyle}
                onChangeStyle={(fontSansStyle) =>
                  updateSettings({ fontSansStyle })
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Monospace Font")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <FontPopoverSelector
                value={settings.fontMonoFamily}
                fonts={monoFonts}
                summary={`${settings.fontMonoFamily} · ${Math.round(13 * settings.fontScale)}px`}
                onSelectFont={(fontMonoFamily) =>
                  updateSettings({ fontMonoFamily })
                }
                fontScale={settings.fontScale}
                onChangeScale={(fontScale) => updateSettings({ fontScale })}
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>{_("Rendering")}</GroupedFormRowTitle>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Select
                value={renderingPreset}
                items={translatedRenderingOptions}
                onValueChange={(val) => {
                  if (
                    val === "default" ||
                    val === "subpixel" ||
                    val === "geometric" ||
                    val === "darkened"
                  ) {
                    applyRenderingPreset(val);
                  }
                }}
              >
                <SelectTrigger variant="borderless">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {translatedRenderingOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}
