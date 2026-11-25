import { hostFiles } from "@/lib/engine/host-files";
import type { Piloti } from "@/lib/engine/piloti";
import { posixPathToFileUri } from "./xdg-recents";

export type XdgThumbnailSize = "normal" | "large" | "x-large" | "xx-large";

/**
 * Pure RFC 1321 MD5 implementation (UTF-8 input -> lowercase 32-char hex)
 * required by the FreeDesktop Thumbnail Managing Standard v0.8.
 */
export function md5Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const padLen = ((56 - ((bytes.length + 1) % 64)) + 64) % 64;
  const totalLen = bytes.length + 1 + padLen + 8;
  const buf = new Uint8Array(totalLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;

  const view = new DataView(buf.buffer);
  view.setUint32(totalLen - 8, bitLen >>> 0, true);
  view.setUint32(totalLen - 4, Math.floor(bitLen / 0x100000000) >>> 0, true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const shifts = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i += 1) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
  }

  const M = new Uint32Array(16);
  for (let offset = 0; offset < totalLen; offset += 64) {
    for (let j = 0; j < 16; j += 1) {
      M[j] = view.getUint32(offset + j * 4, true);
    }
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i += 1) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      const sum = (A + F + K[i] + M[g]) >>> 0;
      const s = shifts[i];
      const rotated = ((sum << s) | (sum >>> (32 - s))) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotated) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);

  return Array.from(out, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Computes the relative XDG cache path (`.cache/thumbnails/<size>/<md5>.png`)
 * for a POSIX file path or `file://` URI per FreeDesktop Thumbnail Managing Standard.
 */
export function getXdgThumbnailRelativePath(
  filePathOrUri: string,
  size: XdgThumbnailSize = "normal"
): string {
  const uri = posixPathToFileUri(filePathOrUri);
  const hash = md5Hex(uri);
  return `.cache/thumbnails/${size}/${hash}.png`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const thumbnailDataUrlCache = new Map<string, string | null>();

/**
 * Looks up a cached FreeDesktop thumbnail PNG from `~/.cache/thumbnails/{large,normal}/<md5>.png`
 * on a native Domicile host and returns a `data:image/png;base64,...` URL when present.
 */
export async function lookupXdgThumbnailDataUrl(
  piloti: Piloti,
  absolutePath: string,
  preferredSizes: readonly XdgThumbnailSize[] = ["large", "normal"]
): Promise<string | null> {
  if (!absolutePath.startsWith("/")) return null;
  if (thumbnailDataUrlCache.has(absolutePath)) {
    return thumbnailDataUrlCache.get(absolutePath) ?? null;
  }

  for (const size of preferredSizes) {
    const relPath = getXdgThumbnailRelativePath(absolutePath, size);
    try {
      const res = await hostFiles(piloti).read(relPath);
      const bytes = res.match({
        Ok: (b) => (b && b.length > 8 ? b : null),
        Err: () => null,
      });
      if (bytes) {
        const dataUrl = `data:image/png;base64,${bytesToBase64(bytes)}`;
        thumbnailDataUrlCache.set(absolutePath, dataUrl);
        return dataUrl;
      }
    } catch {
      // try next size
    }
  }

  thumbnailDataUrlCache.set(absolutePath, null);
  return null;
}

export function clearXdgThumbnailCache(): void {
  thumbnailDataUrlCache.clear();
}
