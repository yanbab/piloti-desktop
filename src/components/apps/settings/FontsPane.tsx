import * as React from "react";
import { RotateCcwIcon } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { useDomicile } from "@domicile-desktop/react/domicile-provider";
import {
  useApps,
  useSettings,
  useWindowManager,
} from "@/context/DesktopStateContext";
import type {
  CssFontKerning,
  CssFontOpticalSizing,
  CssFontSmoothing,
  CssFontSynthesis,
  CssTextRendering,
} from "@/context/SettingsContext";
import {
  listInstalledFontFamilies,
  readGtk4CustomCss,
  readGtk4HintFontMetrics,
  setGtk4HintFontMetrics,
  writeGtk4CustomCss,
  type GtkFontAntialiasing,
  type GtkFontHinting,
  type GtkFontRgbaOrder,
} from "@/lib/gnome-bridge";

const SANS_PRESETS = [
  "Adwaita Sans",
  "Cantarell",
  "Inter",
  "Noto Sans",
  "Ubuntu",
  "system-ui",
] as const;

const MONO_PRESETS = [
  "Adwaita Mono",
  "JetBrains Mono",
  "Source Code Pro",
  "DejaVu Sans Mono",
  "monospace",
] as const;

const BROWSER_FALLBACK_FONTS = [
  ...SANS_PRESETS,
  ...MONO_PRESETS,
  "Liberation Sans",
  "DejaVu Sans",
];

function stripPangoSize(fontSpec: string): string {
  return fontSpec.replace(/\s+\d+(?:\.\d+)?$/, "").trim();
}

function buildPangoSpec(family: string, existingSpec: string): string {
  const sizeMatch = /\s+(\d+(?:\.\d+)?)$/.exec(existingSpec.trim());
  const pt = sizeMatch ? sizeMatch[1] : "11";
  const primary = family.split(",")[0]?.trim().replace(/^["']|["']$/g, "") || "Sans";
  return `${primary} ${pt}`;
}

export function FontsPane() {
  const domicile = useDomicile();
  const { isBrowserRuntime, settings, updateSettings } = useSettings();
  const { installedXdgApps, launchXdgEntry } = useApps();
  const { openGnomeSettings } = useWindowManager();

  const [sampleText, setSampleText] = React.useState(
    "Sphinx of black quartz, judge my vow — Il1 O0 0123456789 != === ->"
  );
  const [installedFonts, setInstalledFonts] = React.useState<string[]>(
    BROWSER_FALLBACK_FONTS
  );
  const [gtkHintMetrics, setGtkHintMetricsState] = React.useState(false);
  const [gtkCustomCss, setGtkCustomCss] = React.useState("");
  const [gtkCssSavedMsg, setGtkCssSavedMsg] = React.useState<string | null>(
    null
  );
  const [computedBlinkFont, setComputedBlinkFont] = React.useState("");

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const style = getComputedStyle(document.body);
    const loadedFaces = Array.from(document.fonts)
      .filter((f) => f.status === "loaded")
      .map((f) => f.family.replace(/^["']|["']$/g, ""));
    const uniqueLoaded = Array.from(new Set(loadedFaces));
    const faceSuffix =
      uniqueLoaded.length > 0 ? ` · Loaded: ${uniqueLoaded.slice(0, 3).join(", ")}` : "";
    setComputedBlinkFont(`${style.fontFamily} (${style.fontSize})${faceSuffix}`);
  }, [settings.fontSansFamily, settings.fontMonoFamily, settings.fontScale]);

  React.useEffect(() => {
    if (isBrowserRuntime) return;
    let cancelled = false;
    void listInstalledFontFamilies(domicile).then((fonts) => {
      if (!cancelled && fonts.length > 0) {
        setInstalledFonts(fonts);
      }
    });
    void readGtk4HintFontMetrics(domicile).then((enabled) => {
      if (!cancelled) {
        setGtkHintMetricsState(enabled);
      }
    });
    void readGtk4CustomCss(domicile).then((css) => {
      if (!cancelled) {
        setGtkCustomCss(css);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [domicile, isBrowserRuntime]);

  const handleSaveGtkCss = async (nextCss: string) => {
    setGtkCustomCss(nextCss);
    if (isBrowserRuntime) {
      setGtkCssSavedMsg("Saved (Browser preview only)");
      return;
    }
    const ok = await writeGtk4CustomCss(domicile, nextCss);
    setGtkCssSavedMsg(
      ok
        ? "Saved to ~/.config/gtk-4.0/gtk.css — relaunch GTK4 apps to inspect"
        : "Failed to write ~/.config/gtk-4.0/gtk.css"
    );
  };

  const handleToggleGtkHintMetrics = async (checked: boolean) => {
    setGtkHintMetricsState(checked);
    if (!isBrowserRuntime) {
      await setGtk4HintFontMetrics(domicile, checked);
    }
  };

  const applyCssPreset = (
    preset: "default" | "subpixel" | "geometric" | "darkened"
  ) => {
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

  const launchGtkComparisonApp = () => {
    const preferred = installedXdgApps.find((entry) =>
      /adwaita.*demo|texteditor|gtk4-demo|tweaks/i.test(
        `${entry.desktopId} ${entry.name}`
      )
    );
    if (preferred) {
      launchXdgEntry(preferred);
    } else {
      openGnomeSettings("appearance");
    }
  };

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;

  return (
    <GroupedForm>
      <datalist id="piloti-sans-fonts">
        {installedFonts.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      {/* Live Preview Specimen */}
      <GroupedFormSection>
        <div className="mb-2 flex items-center justify-between px-1">
          <GroupedFormSectionTitle className="mb-0 px-0">
            Live Specimen &amp; Comparison
          </GroupedFormSectionTitle>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-adw-label-tertiary tabular-nums">
              DPR {dpr.toFixed(2)}× · Piloti (Blink/Skia)
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={launchGtkComparisonApp}
              className="h-6 px-2.5 text-[11px]"
            >
              Open GTK4 Window…
            </Button>
          </div>
        </div>

        <GroupedFormGroup>
          <div className="space-y-3 p-4">
            <Input
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              placeholder="Type custom comparison specimen…"
              className="h-7 text-[12px]"
            />

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[10px] border border-white/10 bg-[#202024] p-3 text-[#f6f5f4]">
                <div className="mb-1.5 flex items-center justify-between text-[10.5px] text-white/55">
                  <span>Dark Surface ({settings.fontSansFamily})</span>
                  <span>
                    {settings.cssFontSmoothing} · {settings.cssTextRendering}
                  </span>
                </div>
                <p className="text-adw-title-3 font-semibold">{sampleText}</p>
                <p className="mt-1 text-adw-body text-white/90">{sampleText}</p>
                <p className="mt-1 font-mono text-[12px] text-white/75">
                  {sampleText}
                </p>
              </div>

              <div className="rounded-[10px] border border-black/10 bg-[#fafafa] p-3 text-[#202024]">
                <div className="mb-1.5 flex items-center justify-between text-[10.5px] text-black/55">
                  <span>Light Surface ({settings.fontSansFamily})</span>
                  <span>
                    GTK4: {settings.gtkFontAntialiasing}/{settings.gtkFontHinting}
                  </span>
                </div>
                <p className="text-adw-title-3 font-semibold">{sampleText}</p>
                <p className="mt-1 text-adw-body text-black/85">{sampleText}</p>
                <p className="mt-1 font-mono text-[12px] text-black/70">
                  {sampleText}
                </p>
              </div>
            </div>

            {computedBlinkFont && (
              <div className="rounded-[8px] bg-black/5 px-2.5 py-1.5 font-mono text-[10.5px] text-adw-label-secondary dark:bg-white/6">
                Computed Blink font: {computedBlinkFont}
              </div>
            )}
          </div>
        </GroupedFormGroup>
      </GroupedFormSection>

      {/* Editable Font Family Inputs */}
      <GroupedFormSection>
        <div className="mb-2 flex items-center justify-between px-1">
          <GroupedFormSectionTitle className="mb-0 px-0">
            Piloti Shell Fonts (Chromium CSS)
          </GroupedFormSectionTitle>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              updateSettings({
                gtkFontName: buildPangoSpec(
                  settings.fontSansFamily,
                  settings.gtkFontName
                ),
                gtkMonospaceFontName: buildPangoSpec(
                  settings.fontMonoFamily,
                  settings.gtkMonospaceFontName
                ),
              })
            }
            className="h-6 px-2.5 text-[11px]"
          >
            Copy Font Names → GTK4
          </Button>
        </div>
        <GroupedFormGroup>
          <GroupedFormRow className="flex-col items-stretch gap-2 py-3">
            <div className="flex items-center justify-between gap-4">
              <GroupedFormRowLabel>
                <GroupedFormRowTitle>UI Font Family</GroupedFormRowTitle>
                <GroupedFormRowDescription>
                  Sets `--font-adw` across Piloti shell, menus, and Desktop Settings
                </GroupedFormRowDescription>
              </GroupedFormRowLabel>
              <GroupedFormRowControl className="w-60">
                <Input
                  list="piloti-sans-fonts"
                  value={settings.fontSansFamily}
                  onChange={(e) =>
                    updateSettings({ fontSansFamily: e.target.value })
                  }
                  placeholder="e.g. Adwaita Sans, Cantarell, Inter"
                  className="h-7"
                />
              </GroupedFormRowControl>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SANS_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => updateSettings({ fontSansFamily: preset })}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] transition-colors ${
                    settings.fontSansFamily === preset
                      ? "bg-adw-accent text-white"
                      : "bg-adw-fill text-adw-label-secondary hover:text-adw-label"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </GroupedFormRow>

          <GroupedFormRow className="flex-col items-stretch gap-2 py-3">
            <div className="flex items-center justify-between gap-4">
              <GroupedFormRowLabel>
                <GroupedFormRowTitle>Monospace Font Family</GroupedFormRowTitle>
                <GroupedFormRowDescription>
                  Sets `--font-adw-mono` for REPL, logs, shortcuts, and hints
                </GroupedFormRowDescription>
              </GroupedFormRowLabel>
              <GroupedFormRowControl className="w-60">
                <Input
                  list="piloti-sans-fonts"
                  value={settings.fontMonoFamily}
                  onChange={(e) =>
                    updateSettings({ fontMonoFamily: e.target.value })
                  }
                  placeholder="e.g. Adwaita Mono, JetBrains Mono"
                  className="h-7 font-mono"
                />
              </GroupedFormRowControl>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MONO_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => updateSettings({ fontMonoFamily: preset })}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] transition-colors ${
                    settings.fontMonoFamily === preset
                      ? "bg-adw-accent text-white"
                      : "bg-adw-fill text-adw-label-secondary hover:text-adw-label"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                Piloti UI Font Scale ({Math.round(settings.fontScale * 100)}%)
              </GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Scales semantic `--text-adw-*` sizes without altering Wayland bounds
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="w-48 gap-2">
              <Slider
                min={0.85}
                max={1.35}
                step={0.05}
                value={[settings.fontScale]}
                onValueChange={(val) => {
                  const next = Array.isArray(val) ? val[0] : val;
                  if (typeof next === "number") updateSettings({ fontScale: next });
                }}
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      {/* Chromium / Blink CSS Rendering Tweaks */}
      <GroupedFormSection>
        <div className="mb-2 flex items-center justify-between px-1">
          <GroupedFormSectionTitle className="mb-0 px-0">
            Chromium / Piloti CSS Font Rendering
          </GroupedFormSectionTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => applyCssPreset("default")}
            className="h-6 gap-1 px-2 text-[11px]"
          >
            <RotateCcwIcon className="size-3" />
            Reset CSS
          </Button>
        </div>

        <GroupedFormGroup>
          <GroupedFormRow className="py-2.5">
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>Quick Experiment Profiles</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Compare grayscale AA, RGB subpixel, unhinted geometry, and stem stroke
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <div className="flex flex-wrap justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => applyCssPreset("default")}
                  className="h-7 px-2.5 text-[11px]"
                >
                  Grayscale Default
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => applyCssPreset("subpixel")}
                  className="h-7 px-2.5 text-[11px]"
                >
                  Subpixel + Legibility
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => applyCssPreset("geometric")}
                  className="h-7 px-2.5 text-[11px]"
                >
                  Geometric Precision
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => applyCssPreset("darkened")}
                  className="h-7 px-2.5 text-[11px]"
                >
                  Stem Darkened
                </Button>
              </div>
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                Font Smoothing (`-webkit-font-smoothing`)
              </GroupedFormRowTitle>
              <GroupedFormRowDescription>
                `antialiased` forces grayscale AA; `subpixel-antialiased` / `auto` allows LCD subpixel AA when Skia enables it
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Select
                value={settings.cssFontSmoothing}
                onValueChange={(val) =>
                  updateSettings({ cssFontSmoothing: val as CssFontSmoothing })
                }
              >
                <SelectTrigger variant="borderless">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="antialiased">
                    antialiased (Grayscale AA)
                  </SelectItem>
                  <SelectItem value="subpixel-antialiased">
                    subpixel-antialiased (RGB Subpixel)
                  </SelectItem>
                  <SelectItem value="auto">auto (Platform Default)</SelectItem>
                </SelectContent>
              </Select>
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                Text Rendering (`text-rendering`)
              </GroupedFormRowTitle>
              <GroupedFormRowDescription>
                `optimizeLegibility` enforces HarfBuzz kerning/ligatures; `geometricPrecision` disables pixel-grid hinting
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Select
                value={settings.cssTextRendering}
                onValueChange={(val) =>
                  updateSettings({ cssTextRendering: val as CssTextRendering })
                }
              >
                <SelectTrigger variant="borderless">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">auto</SelectItem>
                  <SelectItem value="optimizeLegibility">
                    optimizeLegibility
                  </SelectItem>
                  <SelectItem value="geometricPrecision">
                    geometricPrecision (Unhinted)
                  </SelectItem>
                  <SelectItem value="optimizeSpeed">optimizeSpeed</SelectItem>
                </SelectContent>
              </Select>
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                Optical Sizing (`font-optical-sizing`)
              </GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Adjusts `opsz` axis on variable fonts like Adwaita Sans and Inter
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Select
                value={settings.cssFontOpticalSizing}
                onValueChange={(val) =>
                  updateSettings({
                    cssFontOpticalSizing: val as CssFontOpticalSizing,
                  })
                }
              >
                <SelectTrigger variant="borderless">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">auto</SelectItem>
                  <SelectItem value="none">none</SelectItem>
                </SelectContent>
              </Select>
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                Kerning &amp; Synthesis (`font-kerning` / `font-synthesis`)
              </GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Controls pair kerning and synthetic faux bold/italic generation
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="gap-2">
              <Select
                value={settings.cssFontKerning}
                onValueChange={(val) =>
                  updateSettings({ cssFontKerning: val as CssFontKerning })
                }
              >
                <SelectTrigger variant="borderless">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">kerning: auto</SelectItem>
                  <SelectItem value="normal">kerning: normal</SelectItem>
                  <SelectItem value="none">kerning: none</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={settings.cssFontSynthesis}
                onValueChange={(val) =>
                  updateSettings({ cssFontSynthesis: val as CssFontSynthesis })
                }
              >
                <SelectTrigger variant="borderless">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">synthesis: auto</SelectItem>
                  <SelectItem value="none">synthesis: none</SelectItem>
                </SelectContent>
              </Select>
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                Letter Spacing ({settings.cssLetterSpacingEm.toFixed(3)}em)
              </GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Fine-tune glyph tracking to match Pango/FreeType spacing
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="w-44">
              <Slider
                min={-0.02}
                max={0.04}
                step={0.005}
                value={[settings.cssLetterSpacingEm]}
                onValueChange={(val) => {
                  const next = Array.isArray(val) ? val[0] : val;
                  if (typeof next === "number") {
                    updateSettings({ cssLetterSpacingEm: next });
                  }
                }}
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                CSS Stem Darkening ({settings.cssTextStrokePx.toFixed(2)}px)
              </GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Applies `-webkit-text-stroke-width` in `currentColor` to thicken thin light-on-dark stems
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="w-44">
              <Slider
                min={0}
                max={0.35}
                step={0.05}
                value={[settings.cssTextStrokePx]}
                onValueChange={(val) => {
                  const next = Array.isArray(val) ? val[0] : val;
                  if (typeof next === "number") {
                    updateSettings({ cssTextStrokePx: next });
                  }
                }}
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      {/* GTK4 / GNOME GSettings & FreeType Controls */}
      <GroupedFormSection>
        <div className="mb-2 flex items-center justify-between px-1">
          <GroupedFormSectionTitle className="mb-0 px-0">
            GTK4 &amp; GNOME Typography (`gsettings`)
          </GroupedFormSectionTitle>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              updateSettings({
                fontSansFamily: stripPangoSize(settings.gtkFontName) || "Cantarell",
                fontMonoFamily:
                  stripPangoSize(settings.gtkMonospaceFontName) || "Adwaita Mono",
              })
            }
            className="h-6 px-2.5 text-[11px]"
          >
            Pull GTK4 Fonts → Piloti
          </Button>
        </div>

        <GroupedFormGroup>
          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>GTK Interface Font (`font-name`)</GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Pango font spec (`Family Size`) used live by GTK4 / Libadwaita windows
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="w-56">
              <Input
                value={settings.gtkFontName}
                onChange={(e) => updateSettings({ gtkFontName: e.target.value })}
                placeholder="Adwaita Sans 11"
                className="h-7"
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                GTK Document &amp; Monospace Fonts
              </GroupedFormRowTitle>
              <GroupedFormRowDescription>
                `document-font-name` and `monospace-font-name` in `org.gnome.desktop.interface`
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="w-80 gap-2">
              <Input
                value={settings.gtkDocumentFontName}
                onChange={(e) =>
                  updateSettings({ gtkDocumentFontName: e.target.value })
                }
                placeholder="Sans 11"
                className="h-7"
              />
              <Input
                value={settings.gtkMonospaceFontName}
                onChange={(e) =>
                  updateSettings({ gtkMonospaceFontName: e.target.value })
                }
                placeholder="Adwaita Mono 11"
                className="h-7 font-mono"
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                GTK Text Scaling ({settings.gtkTextScalingFactor.toFixed(2)}×)
              </GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Sets `text-scaling-factor` across GNOME / GTK4 clients
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="w-44">
              <Slider
                min={0.85}
                max={1.5}
                step={0.05}
                value={[settings.gtkTextScalingFactor]}
                onValueChange={(val) => {
                  const next = Array.isArray(val) ? val[0] : val;
                  if (typeof next === "number") {
                    updateSettings({ gtkTextScalingFactor: next });
                  }
                }}
              />
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                GTK4 Antialiasing, Hinting &amp; Subpixel Order
              </GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Live FreeType / Cairo settings in `org.gnome.desktop.interface`
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl className="gap-2">
              <Select
                value={settings.gtkFontAntialiasing}
                onValueChange={(val) =>
                  updateSettings({
                    gtkFontAntialiasing: val as GtkFontAntialiasing,
                  })
                }
              >
                <SelectTrigger variant="borderless">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">AA: none</SelectItem>
                  <SelectItem value="grayscale">AA: grayscale</SelectItem>
                  <SelectItem value="rgba">AA: rgba (subpixel)</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={settings.gtkFontHinting}
                onValueChange={(val) =>
                  updateSettings({ gtkFontHinting: val as GtkFontHinting })
                }
              >
                <SelectTrigger variant="borderless">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">hint: none</SelectItem>
                  <SelectItem value="slight">hint: slight</SelectItem>
                  <SelectItem value="medium">hint: medium</SelectItem>
                  <SelectItem value="full">hint: full</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={settings.gtkFontRgbaOrder}
                onValueChange={(val) =>
                  updateSettings({ gtkFontRgbaOrder: val as GtkFontRgbaOrder })
                }
              >
                <SelectTrigger variant="borderless">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rgb">rgb</SelectItem>
                  <SelectItem value="bgr">bgr</SelectItem>
                  <SelectItem value="vrgb">vrgb</SelectItem>
                  <SelectItem value="vbgr">vbgr</SelectItem>
                </SelectContent>
              </Select>
            </GroupedFormRowControl>
          </GroupedFormRow>

          <GroupedFormRow>
            <GroupedFormRowLabel>
              <GroupedFormRowTitle>
                GTK4 `gtk-hint-font-metrics` (`settings.ini`)
              </GroupedFormRowTitle>
              <GroupedFormRowDescription>
                Writes `~/.config/gtk-4.0/settings.ini`. Disabled by default in GTK4 for fractional scaling; enabling snaps glyph baselines to integer pixels on 1× displays (relaunch GTK4 apps to observe)
              </GroupedFormRowDescription>
            </GroupedFormRowLabel>
            <GroupedFormRowControl>
              <Switch
                checked={gtkHintMetrics}
                onCheckedChange={(checked) =>
                  void handleToggleGtkHintMetrics(Boolean(checked))
                }
              />
            </GroupedFormRowControl>
          </GroupedFormRow>
        </GroupedFormGroup>
      </GroupedFormSection>

      {/* Custom GTK4 gtk.css Scratchpad */}
      <GroupedFormSection>
        <div className="mb-2 flex items-center justify-between px-1">
          <GroupedFormSectionTitle className="mb-0 px-0">
            Custom `~/.config/gtk-4.0/gtk.css` Scratchpad
          </GroupedFormSectionTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              className="h-6 px-2 text-[10.5px]"
              onClick={() =>
                setGtkCustomCss(
                  "/* Slightly looser UI tracking & crisp font feature settings */\n* {\n  letter-spacing: 0.01em;\n}\n"
                )
              }
            >
              Loose Tracking
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-6 px-2 text-[10.5px]"
              onClick={() => setGtkCustomCss("")}
            >
              Clear
            </Button>
          </div>
        </div>
        <GroupedFormGroup>
          <div className="space-y-2.5 p-3.5">
            <textarea
              value={gtkCustomCss}
              onChange={(e) => {
                setGtkCustomCss(e.target.value);
                setGtkCssSavedMsg(null);
              }}
              rows={4}
              placeholder="/* Optional GTK4 CSS overrides, e.g. window, label { ... } */"
              className="w-full rounded-[8px] border border-adw-separator bg-black/5 p-2.5 font-mono text-[11.5px] text-adw-label outline-none focus-visible:adw-focus-ring dark:bg-white/6"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-adw-label-secondary">
                {gtkCssSavedMsg ??
                  "Applied to newly launched GTK4 / Libadwaita windows."}
              </span>
              <div className="flex items-center gap-1.5">
                {!isBrowserRuntime && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2.5 text-[11px]"
                    onClick={() => {
                      void readGtk4CustomCss(domicile).then((css) => {
                        setGtkCustomCss(css);
                        setGtkCssSavedMsg("Reloaded from ~/.config/gtk-4.0/gtk.css");
                      });
                    }}
                  >
                    Reload
                  </Button>
                )}
                <Button
                  size="sm"
                  className="h-7 px-3 text-[11px]"
                  onClick={() => void handleSaveGtkCss(gtkCustomCss)}
                >
                  Save gtk.css
                </Button>
              </div>
            </div>
          </div>
        </GroupedFormGroup>
      </GroupedFormSection>
    </GroupedForm>
  );
}

