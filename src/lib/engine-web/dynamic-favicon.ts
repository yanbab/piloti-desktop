/**
 * Browser demo favicon that follows the desktop: the tile is a muted accent
 * at 25% opacity, the house is the accent color.
 * Redrawn when the root's class (`dark`), style (`--adw-active-accent`) or
 * interface theme changes.
 */

const HOUSE_PATHS =
  "<path d='M4.5 11L12 5l7.5 6'/><path d='M6 10.5v5h12v-5'/>";

function toCssColor(value: string, fallback: string): string {
  const v = value.trim();
  return v || fallback;
}

/** Any CSS color as [r, g, b] (via the browser's own parser). */
function toRgb(color: string): [number, number, number] | null {
  const probe = document.createElement("span");
  probe.style.color = color;
  document.body.appendChild(probe);
  const m = getComputedStyle(probe).color.match(/(\d+(?:\.\d+)?)/g);
  probe.remove();
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : null;
}

/** Halfway to gray: a quieter version of the accent for the tile. */
function mutedHex([r, g, b]: [number, number, number]): string {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  const mix = (c: number) => Math.round(c + (gray - c) * 0.5);
  return `#${[mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function buildFavicon(bg: string, fg: string): string {
  const dots = [6.5, 10.9, 15.3]
    .map(
      (x) =>
        `<rect x='${x}' y='17.25' width='2.2' height='2.2' rx='0.4' fill='${fg}' stroke='none'/>`
    )
    .join("");
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${fg}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>` +
    `<rect width='24' height='24' rx='6' fill='${bg}' fill-opacity='0.25' stroke='none'/>` +
    // The symbol fills 14×14 of the 16px icon (1px margin on every side,
    // measured): scaled to 21 units wide, stretched ~6% taller to fill.
    "<g transform='translate(12 12) scale(1.235 1.31) translate(-12 -11.75)'>" +
    HOUSE_PATHS +
    dots +
    "</g></svg>";
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function installDynamicFavicon(): () => void {
  if (typeof document === "undefined") return () => undefined;
  const root = document.documentElement;
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/svg+xml";

  let last = "";
  let frame = 0;
  const update = () => {
    frame = 0;
    const style = getComputedStyle(root);
    const fg = toCssColor(style.getPropertyValue("--adw-accent"), "#0088ff");
    const rgb = document.body ? toRgb(fg) : null;
    const bg = rgb ? mutedHex(rgb) : fg;
    const href = buildFavicon(bg, fg);
    if (href !== last) {
      last = href;
      link!.href = href;
    }
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  update();
  const observer = new MutationObserver(schedule);
  observer.observe(root, {
    attributes: true,
    attributeFilter: ["class", "style", "data-interface-theme"],
  });
  return () => {
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
}
