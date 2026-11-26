/**
 * Browser demo favicon that follows the desktop: the Piloti symbol in the
 * accent color, filling the icon (no tile).
 * Redrawn when the root's class (`dark`), style (`--shell-active-accent`) or
 * interface theme changes.
 */

const HOUSE_PATHS =
  "<path d='M4.5 11L12 5l7.5 6'/><path d='M6 10.5v5h12v-5'/>";

function toCssColor(value: string, fallback: string): string {
  const v = value.trim();
  return v || fallback;
}

function buildFavicon(fg: string): string {
  const dots = [6.5, 10.9, 15.3]
    .map(
      (x) =>
        `<rect x='${x}' y='17.25' width='2.2' height='2.2' rx='0.4' fill='${fg}' stroke='none'/>`
    )
    .join("");
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${fg}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>` +
    // No tile: the symbol fills the whole 16px icon (measured), scaled to
    // the 24-unit box and stretched ~12% taller to fill the height.
    "<g transform='translate(12 12) scale(1.41 1.58) translate(-12 -11.9)'>" +
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
    const fg = toCssColor(style.getPropertyValue("--shell-accent"), "#0088ff");
    const href = buildFavicon(fg);
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
