/**
 * Browser demo favicon that follows the desktop: the tile is the window
 * color of the current style (dark or light), the house is the accent color.
 * Redrawn when the root's class (`dark`), style (`--adw-active-accent`) or
 * interface theme changes.
 */

const HOUSE_PATHS =
  "<path d='M4.5 11L12 5l7.5 6'/><path d='M6 10.5v5h12v-5'/>";

function toCssColor(value: string, fallback: string): string {
  const v = value.trim();
  return v || fallback;
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
    `<rect width='24' height='24' rx='6' fill='${bg}' stroke='none'/>` +
    HOUSE_PATHS +
    dots +
    "</svg>";
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
    const dark = root.classList.contains("dark");
    const bg = toCssColor(
      style.getPropertyValue("--adw-window"),
      dark ? "#202024" : "#ffffff"
    );
    const fg = toCssColor(style.getPropertyValue("--adw-accent"), "#0088ff");
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
