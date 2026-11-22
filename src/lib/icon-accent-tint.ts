/**
 * Recolors canonical accent placeholders (`#5294e2` primary accent and `#4877b1`
 * shaded accent) inside SVG and Lottie `.json` data URLs so folder, file detail,
 * trash, and built-in app icons follow the active desktop accent color in real time.
 */

function parseHexRgb(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const n = Number.parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

function darkenRgb(
  [r, g, b]: [number, number, number],
  factor = 0.22
): [number, number, number] {
  const k = 1 - factor;
  return [r * k, g * k, b * k];
}

function toLottieRgbArray([r, g, b]: [number, number, number]): string {
  const fmt = (v: number) => Number((Math.max(0, Math.min(255, v)) / 255).toFixed(4));
  return `[${fmt(r)},${fmt(g)},${fmt(b)},1]`;
}

function decodeDataUrlPayload(dataUrl: string): {
  mime: "svg" | "json";
  text: string;
} | null {
  let mime: "svg" | "json" | null = null;
  if (dataUrl.startsWith("data:image/svg+xml")) {
    mime = "svg";
  } else if (dataUrl.startsWith("data:application/json")) {
    mime = "json";
  }
  if (!mime) return null;

  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const header = dataUrl.slice(0, comma).toLowerCase();
  const body = dataUrl.slice(comma + 1);

  try {
    if (header.includes(";base64")) {
      const bin = atob(body);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      return { mime, text: new TextDecoder().decode(bytes) };
    }
    return { mime, text: decodeURIComponent(body) };
  } catch {
    return null;
  }
}

export function tintIconDataUrl(
  dataUrl: string | undefined,
  accentHex: string
): string | undefined {
  if (!dataUrl) return undefined;
  const rgb = parseHexRgb(accentHex);
  if (!rgb) return dataUrl;

  const primaryHex = toHex(rgb);
  const darkRgb = darkenRgb(rgb, 0.22);
  const darkHex = toHex(darkRgb);

  const decoded = decodeDataUrlPayload(dataUrl);
  if (!decoded) return dataUrl;

  if (decoded.mime === "svg") {
    if (
      !/#5294e2|#4877b1|#3584e4|#1d99f3|#1c71d8/i.test(decoded.text)
    ) {
      return dataUrl;
    }
    const tinted = decoded.text
      .replace(/#5294e2|#3584e4|#1d99f3|#1c71d8/gi, primaryHex)
      .replace(/#4877b1/gi, darkHex);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tinted)}`;
  }

  // Lottie JSON: `[0.3216,0.5804,0.8863,1]` (#5294e2) and `[0.2824,0.4667,0.6941,1]` (#4877b1)
  if (
    !decoded.text.includes("0.3216,0.5804,0.8863") &&
    !decoded.text.includes("0.2824,0.4667,0.6941")
  ) {
    return dataUrl;
  }
  const primaryLottie = toLottieRgbArray(rgb);
  const darkLottie = toLottieRgbArray(darkRgb);
  const tintedJson = decoded.text
    .replace(/\[0\.3216,\s*0\.5804,\s*0\.8863,\s*1\]/g, primaryLottie)
    .replace(/\[0\.2824,\s*0\.4667,\s*0\.6941,\s*1\]/g, darkLottie);
  return `data:application/json;charset=utf-8,${encodeURIComponent(tintedJson)}`;
}

