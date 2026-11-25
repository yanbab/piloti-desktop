/**
 * Compress and extract real files with `bsdtar` (libarchive-tools): it reads
 * zip, tar.*, 7z and rar and writes zip. Names are passed as arguments, never
 * pasted into the script. Existing files are never overwritten: a free name
 * ("Archive 2.zip", "photos 2") is picked, and a failed run removes only what
 * it created.
 */
import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import { runText } from "./exec";

// $1 = folder, $2 = archive name without ".zip", rest = entries in the folder.
const COMPRESS_SCRIPT = `
cd -- "$1" || exit 1
base="$2"; shift 2
out="$base.zip"; n=2
while [ -e "./$out" ] || [ -L "./$out" ]; do out="$base $n.zip"; n=$((n+1)); done
bsdtar --format=zip -cf "./$out" -- "$@" || { rm -f -- "./$out"; exit 1; }
printf %s "$out"
`;

// $1 = folder, $2 = archive file name, $3 = destination folder name.
const EXTRACT_SCRIPT = `
cd -- "$1" || exit 1
dest="$3"; n=2
while ! mkdir "./$dest" 2>/dev/null; do
  [ -e "./$dest" ] || exit 1
  dest="$3 $n"; n=$((n+1))
done
bsdtar -xf "./$2" -C "./$dest" || { rm -rf -- "./$dest"; exit 1; }
printf %s "$dest"
`;

const dirOf = (path: string) => path.slice(0, path.lastIndexOf("/")) || "/";
const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const join = (dir: string, name: string) => `${dir === "/" ? "" : dir}/${name}`;

/** Folder name for an extracted archive: `a.tar.gz` → `a`. */
export function archiveStem(name: string): string {
  return name.replace(/\.(tar\.(gz|xz|bz2|zst)|tgz|txz|tbz2?|tar|zip|7z|rar)$/i, "") || "Archive";
}

/** Zips `paths` (siblings) next to them; returns the new archive's path, or null. */
export async function compressNative(
  domicile: Domicile,
  paths: readonly string[]
): Promise<string | null> {
  if (paths.length === 0) return null;
  const parent = dirOf(paths[0]!);
  // bsdtar reads "@name" as "include that archive": spell those "./@name".
  const names = paths.map(nameOf).map((n) => (n.startsWith("@") ? `./${n}` : n));
  const base = paths.length === 1 ? nameOf(paths[0]!) : "Archive";
  const out = await runText(domicile, ["sh", "-c", COMPRESS_SCRIPT, "sh", parent, base, ...names]);
  return out ? join(parent, out) : null;
}

/** Extracts an archive into a new folder next to it; returns the folder's path, or null. */
export async function extractNative(domicile: Domicile, path: string): Promise<string | null> {
  const parent = dirOf(path);
  const name = nameOf(path);
  const out = await runText(domicile, ["sh", "-c", EXTRACT_SCRIPT, "sh", parent, name, archiveStem(name)]);
  return out ? join(parent, out) : null;
}
