import { liftGhost } from "@/ui/fx/drag-feedback";

/** Ghosts show a handful of items; the badge says how many there are. */
const MAX_GHOST_ITEMS = 8;

/**
 * Fills a `DragOverlay` with lifted clones of the dragged items' elements,
 * kept where they are relative to `origin` (the element in hand), so what you
 * drag is what you see. Items that aren't rendered are only counted.
 */
export function buildDragGhost(
  host: HTMLElement,
  options: {
    ids: readonly string[];
    primaryId: string;
    nodeOf: (id: string) => HTMLElement | null | undefined;
    origin: DOMRect;
  },
): void {
  const { ids, primaryId, nodeOf, origin } = options;
  if (host.childElementCount > 0) return;
  const ordered = [primaryId, ...ids.filter((id) => id !== primaryId)];
  for (const id of ordered.slice(0, MAX_GHOST_ITEMS)) {
    const node = nodeOf(id);
    if (!node) continue;
    const rect = node.getBoundingClientRect();
    const clone = node.cloneNode(true) as HTMLElement;
    clone.removeAttribute("id");
    clone.removeAttribute("data-vfs-drop-path");
    clone.removeAttribute("role");
    clone.tabIndex = -1;
    clone.style.cssText = [
      "position:absolute",
      `left:${rect.left - origin.left}px`,
      `top:${rect.top - origin.top}px`,
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      "margin:0",
    ].join(";");
    liftGhost(clone);
    host.appendChild(clone);
    if (id === primaryId && ids.length > 1) {
      const badge = document.createElement("span");
      badge.textContent = String(ids.length);
      badge.style.cssText =
        "position:absolute;top:2px;right:6px;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:var(--ui-accent);color:var(--ui-accent-foreground);font:700 11px/20px system-ui;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.35)";
      clone.appendChild(badge);
    }
  }
}

/** Longest icon an app sends the shell with a drag (it travels as a command's word). */
const MAX_ICON_URL = 40_000;

/**
 * The icon of a grid item's element as a `data:` URL, for the shell to draw a
 * drag that left the app's window; `undefined` when there is none or it is too big.
 */
export function iconSnapshot(node: HTMLElement | null | undefined): string | undefined {
  const icon = node?.querySelector("img, svg, canvas");
  if (!icon) return undefined;
  let url: string | undefined;
  try {
    if (icon instanceof SVGSVGElement) {
      const box = icon.getBoundingClientRect();
      const clone = icon.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", String(Math.round(box.width)));
      clone.setAttribute("height", String(Math.round(box.height)));
      const text = new XMLSerializer().serializeToString(clone);
      url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
    } else if (icon instanceof HTMLImageElement && icon.src.startsWith("data:")) {
      url = icon.src;
    } else if (icon instanceof HTMLImageElement || icon instanceof HTMLCanvasElement) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      canvas.getContext("2d")?.drawImage(icon, 0, 0, 64, 64);
      url = canvas.toDataURL("image/png");
    }
  } catch {
    return undefined;
  }
  return url && url.length <= MAX_ICON_URL ? url : undefined;
}
