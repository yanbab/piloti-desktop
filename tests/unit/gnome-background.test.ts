import { describe, expect, test } from "bun:test";
import { WALLPAPERS } from "@/data/catalog";
import { resolveInitialSettings } from "@/context/SettingsContext";
import {
  DEFAULT_GNOME_BACKGROUND,
  buildGnomeShadingCss,
  fileUriToLocalPath,
  isGnomeBackgroundConfigured,
  localPathToFileUri,
  normalizeBackgroundPictureUri,
  normalizeGnomeColor,
  parseGnomeBackgroundPropertiesXml,
  parseGnomeBackgroundXml,
  resolveBackgroundRenderSpec,
  selectGnomePictureUri,
} from "@/lib/core/gnome-background";

describe("GNOME background spec helpers", () => {
  test("converts between file:// URIs and POSIX paths safely", () => {
    expect(localPathToFileUri("/home/alice/My Wallpapers/bg 1.png")).toBe(
      "file:///home/alice/My%20Wallpapers/bg%201.png"
    );
    expect(fileUriToLocalPath("file:///home/alice/My%20Wallpapers/bg%201.png")).toBe(
      "/home/alice/My Wallpapers/bg 1.png"
    );
    expect(fileUriToLocalPath("/usr/share/backgrounds/test.jpg")).toBe(
      "/usr/share/backgrounds/test.jpg"
    );
    expect(fileUriToLocalPath("https://example.com/bg.jpg")).toBeNull();
    expect(normalizeBackgroundPictureUri("/tmp/wall.png")).toBe(
      "file:///tmp/wall.png"
    );
  });

  test("normalizes GNOME colors across hex lengths and rgb()", () => {
    expect(normalizeGnomeColor("#abc")).toBe("#aabbcc");
    expect(normalizeGnomeColor("#3071AE")).toBe("#3071ae");
    expect(normalizeGnomeColor("#02023c3c8888")).toBe("#023c88");
    expect(normalizeGnomeColor("rgb(12, 34, 56)")).toBe("rgb(12, 34, 56)");
    expect(normalizeGnomeColor("not-a-color")).toBeNull();
  });

  test("extracts target image path from GNOME background XML", () => {
    const simpleXml = `
      <background>
        <static>
          <duration>86400.0</duration>
          <file>/usr/share/backgrounds/gnome/day.jpg</file>
        </static>
      </background>
    `;
    expect(parseGnomeBackgroundXml(simpleXml)).toBe(
      "/usr/share/backgrounds/gnome/day.jpg"
    );

    const multiSizeXml = `
      <background>
        <static>
          <file>
            <size width="1920" height="1080">fhd.png</size>
            <size width="3840" height="2160">uhd.png</size>
          </file>
        </static>
      </background>
    `;
    expect(
      parseGnomeBackgroundXml(multiSizeXml, "/usr/share/backgrounds/gnome")
    ).toBe("/usr/share/backgrounds/gnome/uhd.png");
  });

  test("selects light vs dark picture-uri and builds layered render specs", () => {
    const bg = {
      ...DEFAULT_GNOME_BACKGROUND,
      pictureUri: "file:///tmp/light.png",
      pictureUriDark: "file:///tmp/dark.png",
      pictureOptions: "scaled" as const,
      colorShadingType: "vertical" as const,
      primaryColor: "#112233",
      secondaryColor: "#445566",
      pictureOpacity: 80,
    };

    expect(selectGnomePictureUri(bg, "light")).toBe("file:///tmp/light.png");
    expect(selectGnomePictureUri(bg, "dark")).toBe("file:///tmp/dark.png");
    expect(
      selectGnomePictureUri({ ...bg, pictureOptions: "none" }, "dark")
    ).toBe("");

    expect(buildGnomeShadingCss(bg)).toBe(
      "linear-gradient(to bottom, #112233, #445566)"
    );

    const spec = resolveBackgroundRenderSpec({
      wallpaperId: "gnome",
      gnomeBackground: bg,
      activeWallpaper: WALLPAPERS[0],
      resolvedTheme: "dark",
      resolvedPictureSrc: "blob:dark-resolved",
    });

    expect(spec.baseCss).toBe("linear-gradient(to bottom, #112233, #445566)");
    expect(spec.pictureLayer).toEqual({
      backgroundImage: 'url("blob:dark-resolved")',
      backgroundSize: "contain",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      opacity: 0.8,
    });

    const opaqueZoomSpec = resolveBackgroundRenderSpec({
      wallpaperId: "gnome",
      gnomeBackground: {
        ...DEFAULT_GNOME_BACKGROUND,
        pictureUri: "file:///tmp/light.png",
        pictureUriDark: "file:///tmp/dark.png",
        pictureOptions: "zoom",
      },
      activeWallpaper: WALLPAPERS[0],
      resolvedTheme: "dark",
      resolvedPictureSrc: "",
    });
    expect(opaqueZoomSpec.baseCss).toBe("transparent");
    expect(opaqueZoomSpec.pictureLayer).toBeUndefined();
  });

  test("detects active GNOME GSettings configuration vs untouched schema defaults", () => {
    expect(isGnomeBackgroundConfigured({})).toBe(false);
    expect(isGnomeBackgroundConfigured(DEFAULT_GNOME_BACKGROUND)).toBe(false);
    expect(
      isGnomeBackgroundConfigured({
        ...DEFAULT_GNOME_BACKGROUND,
        pictureUri: "file:///usr/share/backgrounds/default.jpg",
      })
    ).toBe(true);
    expect(
      isGnomeBackgroundConfigured({
        ...DEFAULT_GNOME_BACKGROUND,
        pictureOptions: "none",
      })
    ).toBe(true);
  });

  test("preserves Piloti preset when initialized fresh and merges saved gnomeBackground", () => {
    const fresh = resolveInitialSettings(null, false);
    expect(fresh.wallpaperId).toBe("aurora-drift:aurora-drift");
    expect(fresh.gnomeBackground).toEqual(DEFAULT_GNOME_BACKGROUND);

    const legacyCustom = resolveInitialSettings(
      JSON.stringify({ customWallpaperUrl: "https://example.com/bg.webp" }),
      false
    );
    expect(legacyCustom.gnomeBackground.pictureUri).toBe(
      "https://example.com/bg.webp"
    );
  });

  test("parses gnome-background-properties XML and resolves CSS/HTML animated wallpapers", () => {
    const propsXml = `<?xml version="1.0" encoding="UTF-8"?>
<wallpapers>
  <wallpaper deleted="false">
    <name>Piloti Waves</name>
    <filename>/usr/share/backgrounds/piloti/piloti-waves-l.svg</filename>
    <filename-dark>/usr/share/backgrounds/piloti/piloti-waves-d.svg</filename-dark>
    <options>zoom</options>
  </wallpaper>
</wallpapers>`;
    expect(parseGnomeBackgroundPropertiesXml(propsXml)).toEqual([
      {
        name: "Piloti Waves",
        filename: "/usr/share/backgrounds/piloti/piloti-waves-l.svg",
        filenameDark: "/usr/share/backgrounds/piloti/piloti-waves-d.svg",
        options: "zoom",
      },
    ]);

    const cssSpec = resolveBackgroundRenderSpec({
      wallpaperId: "aurora-drift",
      gnomeBackground: DEFAULT_GNOME_BACKGROUND,
      activeWallpaper: {
        id: "aurora-drift",
        name: "Aurora Drift",
        subtitle: "Animated",
        category: "Dynamic",
        backgroundCss: "#dbeafe",
        kind: "css",
        cssAnimation: ".piloti-wp-anim { opacity: 0.9; }",
        cssAnimationDark: ".piloti-wp-anim { opacity: 0.7; }",
      },
      resolvedTheme: "dark",
    });
    expect(cssSpec.animatedCss).toEqual({
      id: "aurora-drift",
      cssText: ".piloti-wp-anim { opacity: 0.7; }",
    });

    const htmlSpec = resolveBackgroundRenderSpec({
      wallpaperId: "showcase-starlight",
      gnomeBackground: DEFAULT_GNOME_BACKGROUND,
      activeWallpaper: {
        id: "showcase-starlight",
        name: "Starlight",
        subtitle: "HTML",
        category: "Dynamic",
        backgroundCss: "#050811",
        kind: "html",
        htmlSrcDoc: "<html><body>stars</body></html>",
      },
      resolvedTheme: "light",
    });
    expect(htmlSpec.htmlLayer).toEqual({
      srcDoc: "<html><body>stars</body></html>",
    });
  });
});

