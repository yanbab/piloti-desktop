import type { WebVfsEntry } from "@/core/files/vfs-paths";

const IMAGE_FILE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|ico|svg)$/i;

export function isImageVfsFile(name: string, content?: string): boolean {
  if (IMAGE_FILE_EXT_RE.test(name)) return true;
  return Boolean(content && content.startsWith("data:image/"));
}

export function getVfsContentType(
  entry?: Pick<WebVfsEntry, "content" | "metadata">
): string | undefined {
  if (!entry) return undefined;
  const metaType = entry.metadata?.["standard::content-type"];
  if (typeof metaType === "string" && metaType.trim()) {
    return metaType.split(";")[0]?.trim().toLowerCase();
  }
  if (entry.content?.startsWith("data:")) {
    const header = entry.content.slice(5, entry.content.indexOf(","));
    const mime = header.split(";")[0]?.trim().toLowerCase();
    if (mime) return mime;
  }
  return undefined;
}

export function getVfsImageThumbnailUrl(
  name: string,
  content?: string,
  metadata?: WebVfsEntry["metadata"],
): string | undefined {
  const metaThumb = metadata?.["metadata::thumbnail"];
  if (typeof metaThumb === "string" && metaThumb.startsWith("data:image/")) {
    return metaThumb;
  }
  if (!content) return undefined;
  if (content.startsWith("data:image/")) return content;
  if (name.toLowerCase().endsWith(".svg") && content.includes("<svg")) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
  }
  return undefined;
}


export function isZipVfsFile(name: string, content?: string): boolean {
  return (
    name.toLowerCase().endsWith(".zip") ||
    Boolean(content?.startsWith("data:application/zip;"))
  );
}

