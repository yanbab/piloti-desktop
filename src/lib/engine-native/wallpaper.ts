import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import {
  fileUriToLocalPath,
  parseGnomeBackgroundXml,
} from "./background";
import { hashPathKey, runText } from "./exec";

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  gif: "image/gif",
  avif: "image/avif",
  bmp: "image/bmp",
  ico: "image/x-icon",
  jxl: "image/jxl",
};

function getMimeTypeForPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_MIME_BY_EXT[ext] ?? "image/jpeg";
}

/**
 * Loads a local wallpaper file (`file://` URI or POSIX path) via `domicile.files`,
 * resolving GNOME `<background>` XML descriptors and converting `.jxl` or large
 * images (`>= 1.5 MB`) into a display-sized cached JPEG.
 */
export async function readGnomeBackgroundBlob(
  domicile: Domicile,
  uriOrPath: string
): Promise<Blob | null> {
  let localPath = fileUriToLocalPath(uriOrPath);
  if (!localPath) return null;

  if (localPath.toLowerCase().endsWith(".xml")) {
    const xmlRes = await domicile.files.readText(localPath);
    const xml = xmlRes.match({ Ok: (t) => t, Err: () => "" });
    const lastSlash = localPath.lastIndexOf("/");
    const baseDir = lastSlash > 0 ? localPath.slice(0, lastSlash) : "/";
    const extracted = parseGnomeBackgroundXml(xml, baseDir);
    if (!extracted) return null;
    localPath = extracted;
  }

  const lower = localPath.toLowerCase();
  if (
    lower.endsWith(".jxl") ||
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".tiff") ||
    lower.endsWith(".bmp")
  ) {
    const cacheRel = `.cache/piloti/wallpapers/${hashPathKey(localPath)}_2560.jpg`;
    await runText(domicile, [
      "sh",
      "-c",
      'mkdir -p "$HOME/.cache/piloti/wallpapers" && src="$1" && dst="$HOME/$2" && { [ -s "$dst" ] && [ ! "$src" -nt "$dst" ] && exit 0; size=$(wc -c < "$src" 2>/dev/null || echo 0); case "$src" in *.jxl|*.JXL) ;; *) [ "$size" -lt 1500000 ] && exit 1 ;; esac; } && if command -v magick >/dev/null 2>&1; then magick "$src" -auto-orient -resize "2560x2560>" -quality 88 "$dst"; elif command -v convert >/dev/null 2>&1; then convert "$src" -auto-orient -resize "2560x2560>" -quality 88 "$dst"; elif command -v ffmpeg >/dev/null 2>&1; then ffmpeg -y -v error -i "$src" -vf "scale=min(2560\\,iw):min(2560\\,ih):force_original_aspect_ratio=decrease" -q:v 3 "$dst"; elif command -v djxl >/dev/null 2>&1 && { [ "${src%.jxl}" != "$src" ] || [ "${src%.JXL}" != "$src" ]; }; then tmp="$dst.png" && djxl "$src" "$tmp" && python3 -c "import sys,gi; gi.require_version(\x27GdkPixbuf\x27,\x272.0\x27); from gi.repository import GdkPixbuf; pb=GdkPixbuf.Pixbuf.new_from_file_at_scale(sys.argv[1],2560,2560,True); pb.savev(sys.argv[2],\x27jpeg\x27,[\x27quality\x27],[\x2788\x27])" "$tmp" "$dst" && rm -f "$tmp"; elif command -v python3 >/dev/null 2>&1; then python3 -c "import sys,gi; gi.require_version(\x27GdkPixbuf\x27,\x272.0\x27); from gi.repository import GdkPixbuf; pb=GdkPixbuf.Pixbuf.new_from_file_at_scale(sys.argv[1],2560,2560,True); pb.savev(sys.argv[2],\x27jpeg\x27,[\x27quality\x27],[\x2788\x27])" "$src" "$dst"; else exit 1; fi',
      "sh",
      localPath,
      cacheRel,
    ]);
    const cachedRes = await domicile.files.read(cacheRel);
    const cachedBytes = cachedRes.match({
      Ok: (b) => (b.length > 0 ? b : null),
      Err: () => null,
    });
    if (cachedBytes) {
      return new Blob([new Uint8Array(cachedBytes)], { type: "image/jpeg" });
    }
  }

  const fileRes = await domicile.files.read(localPath);
  const bytes = fileRes.match({
    Ok: (b) => (b.length > 0 ? b : null),
    Err: () => null,
  });
  if (!bytes) return null;
  return new Blob([new Uint8Array(bytes)], {
    type: getMimeTypeForPath(localPath),
  });
}

